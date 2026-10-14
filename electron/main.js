const { app, BrowserWindow, ipcMain, shell, Menu, Tray, Notification, dialog, powerMonitor } = require('electron');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const fsSync = require('fs');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const execFileAsync = promisify(execFile);
const ALL_WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const monitoredRules = new Map();
const blockedNotifications = new Map();
const startInBackground = process.argv.includes('--background');
let monitorBusy = false;
let lastMonitorAt = Date.now();
let monitorTimer = null;
let monitorDiagnostics = { cycles: 0, lastProcessCount: 0, lastError: null };
let mainWindow = null;
let tray = null;
let isQuitting = false;
let backgroundNoticeShown = false;
let protectionSettings = { startup: false, idle: true, reset: true, clock: true };
let lastWallAt = Date.now();
let lastMonotonicAt = process.uptime() * 1000;
let lastClockWarningAt = 0;
let database = null;
let databasePath = '';

function runTransaction(callback) {
  database.exec('BEGIN IMMEDIATE');
  try {
    callback();
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function initializeDatabase() {
  const dataDirectory = process.env.SHIZHIJIE_DATA_DIR || path.join(app.getPath('appData'), 'ShiZhiJie');
  fsSync.mkdirSync(dataDirectory, { recursive: true });
  databasePath = path.join(dataDirectory, 'data.sqlite');
  database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS usage_history (
      date TEXT NOT NULL,
      app_id TEXT NOT NULL,
      used_seconds INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (date, app_id)
    );
    CREATE INDEX IF NOT EXISTS idx_usage_history_date ON usage_history(date);
  `);
}

function safeJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function saveSettingsToDatabase(settings) {
  const statement = database.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('protection', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`);
  statement.run(JSON.stringify(settings || {}));
}

function saveApplicationsToDatabase(applications) {
  const statement = database.prepare('INSERT INTO applications (id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
  runTransaction(() => {
    database.exec('DELETE FROM applications');
    (Array.isArray(applications) ? applications : []).forEach((item) => {
      if (item?.id) statement.run(String(item.id), JSON.stringify(item));
    });
  });
}

function saveHistoryToDatabase(history) {
  const statement = database.prepare('INSERT INTO usage_history (date, app_id, used_seconds, data, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(date, app_id) DO UPDATE SET used_seconds = excluded.used_seconds, data = excluded.data, updated_at = CURRENT_TIMESTAMP');
  runTransaction(() => {
    (Array.isArray(history) ? history : []).forEach((record) => {
      if (record?.date && record?.appId) statement.run(String(record.date), String(record.appId), Math.max(0, Number(record.usedSeconds) || 0), JSON.stringify(record));
    });
    const cutoff = getDateKey(new Date(Date.now() - 180 * 24 * 60 * 60 * 1000));
    database.prepare('DELETE FROM usage_history WHERE date < ?').run(cutoff);
  });
}

function loadDatabaseState() {
  const settingsRow = database.prepare("SELECT value FROM settings WHERE key = 'protection'").get();
  return {
    settings: settingsRow ? safeJson(settingsRow.value, {}) : null,
    applications: database.prepare('SELECT data FROM applications ORDER BY updated_at, id').all().map((row) => safeJson(row.data, null)).filter(Boolean),
    usageHistory: database.prepare('SELECT data FROM usage_history ORDER BY date, app_id').all().map((row) => safeJson(row.data, null)).filter(Boolean)
  };
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    if (app.isReady()) createWindow();
    return;
  }
  mainWindow.setSkipTaskbar(false);
  mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

app.on('second-instance', showMainWindow);

function getDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function normalizeExecutablePath(executablePath) {
  return path.normalize(String(executablePath || '')).toLowerCase();
}

function broadcast(channel, payload) {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) window.webContents.send(channel, payload);
  });
}

ipcMain.handle('limits:sync', (_event, incomingRules) => {
  const nextIds = new Set();
  const today = getDateKey();
  (Array.isArray(incomingRules) ? incomingRules : []).forEach((incoming) => {
    if (!incoming?.id || !incoming?.path) return;
    const id = String(incoming.id);
    const previous = monitoredRules.get(id);
    const incomingDate = incoming.usageDate || today;
    const incomingSeconds = incomingDate === today
      ? Math.max(0, Number(incoming.usedSeconds ?? Number(incoming.used || 0) * 60) || 0)
      : 0;
    monitoredRules.set(id, {
      id,
      name: String(incoming.name || path.basename(incoming.path, path.extname(incoming.path))),
      icon: incoming.icon || 'desktop-outline',
      color: incoming.color || '#64748B',
      path: path.normalize(String(incoming.path)),
      normalizedPath: normalizeExecutablePath(incoming.path),
      limit: Math.max(1, Number(incoming.limit) || 1),
      quotaUsedSeconds: previous?.usageDate === today
        ? Math.max(previous.quotaUsedSeconds || previous.usedSeconds, Number(incoming.quotaUsedSeconds ?? incomingSeconds) || 0)
        : (protectionSettings.reset ? incomingSeconds : Math.max(0, Number(incoming.quotaUsedSeconds ?? incomingSeconds) || 0)),
      usedSeconds: previous?.usageDate === today
        ? Math.max(previous.usedSeconds, incomingSeconds)
        : incomingSeconds,
      usageDate: today,
      enabled: incoming.enabled !== false,
      weekdays: Array.isArray(incoming.weekdays) && incoming.weekdays.length ? incoming.weekdays : ALL_WEEKDAYS,
      startTime: /^\d{2}:\d{2}$/.test(incoming.startTime || '') ? incoming.startTime : '00:00',
      endTime: /^\d{2}:\d{2}$/.test(incoming.endTime || '') ? incoming.endTime : '24:00',
      warningMinutes: Math.max(0, Number(incoming.warningMinutes) || 0),
      warningDate: previous?.warningDate,
      extraSeconds: previous?.usageDate === today ? Math.max(previous.extraSeconds || 0, Number(incoming.extraSeconds) || 0) : 0,
      extensionDate: previous?.extensionDate,
      extensionCount: previous?.extensionDate === today ? previous.extensionCount || 0 : 0,
      mode: incoming.mode === 'gentle' ? 'gentle' : 'standard',
      status: incomingSeconds > 0 ? incoming.status : '尚未使用'
    });
    nextIds.add(id);
  });
  [...monitoredRules.keys()].forEach((id) => {
    if (!nextIds.has(id)) monitoredRules.delete(id);
  });
  return { activeRules: monitoredRules.size };
});

ipcMain.handle('limits:debug', () => ({
  ...monitorDiagnostics,
  rules: [...monitoredRules.values()].map((rule) => ({
    id: rule.id,
    path: rule.path,
    usedSeconds: rule.usedSeconds,
    quotaUsedSeconds: rule.quotaUsedSeconds,
    startTime: rule.startTime,
    endTime: rule.endTime,
    warningMinutes: rule.warningMinutes,
    mode: rule.mode,
    status: rule.status
  }))
}));

function minutesSinceMidnight(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function parseClock(value, fallback) {
  if (value === '24:00') return 1440;
  const match = /^(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : fallback;
}

function isWithinSchedule(rule, date = new Date()) {
  const start = parseClock(rule.startTime, 0);
  const end = parseClock(rule.endTime, 1440);
  const current = minutesSinceMidnight(date);
  if (start === 0 && end === 1440) return true;
  if (start === end) return true;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

function showNotification(title, body) {
  if (!Notification.isSupported()) return;
  new Notification({ title, body, icon: path.join(__dirname, '..', 'assets', 'icon.png') }).show();
}

function applyLoginSetting(enabled) {
  if (process.platform !== 'win32') return;
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    path: process.execPath,
    args: app.isPackaged ? ['--background'] : [path.join(__dirname, 'main.js'), '--background']
  });
}

ipcMain.handle('settings:get', () => ({
  ...protectionSettings,
  startup: process.platform === 'win32' ? app.getLoginItemSettings().openAtLogin : protectionSettings.startup
}));

ipcMain.handle('settings:update', (_event, incoming) => {
  protectionSettings = { ...protectionSettings, ...(incoming || {}) };
  applyLoginSetting(protectionSettings.startup);
  return protectionSettings;
});

ipcMain.handle('storage:hydrate', (_event, fallback) => {
  const migration = database.prepare("SELECT value FROM metadata WHERE key = 'local_storage_migrated'").get();
  if (!migration) {
    const existing = loadDatabaseState();
    if (!existing.settings && existing.applications.length === 0 && existing.usageHistory.length === 0) {
      saveSettingsToDatabase(fallback?.settings || protectionSettings);
      saveApplicationsToDatabase(fallback?.applications || []);
      saveHistoryToDatabase(fallback?.usageHistory || []);
    }
    database.prepare("INSERT INTO metadata (key, value) VALUES ('local_storage_migrated', ?)").run(new Date().toISOString());
  }
  const state = loadDatabaseState();
  protectionSettings = { ...protectionSettings, ...(state.settings || {}) };
  return {
    ...state,
    settings: protectionSettings,
    databasePath
  };
});

ipcMain.handle('storage:save-settings', (_event, settings) => {
  saveSettingsToDatabase(settings);
  return { ok: true };
});

ipcMain.handle('storage:save-applications', (_event, applications) => {
  saveApplicationsToDatabase(applications);
  return { ok: true };
});

ipcMain.handle('storage:save-history', (_event, history) => {
  saveHistoryToDatabase(history);
  return { ok: true };
});

ipcMain.handle('limits:extend', (_event, id) => {
  const rule = monitoredRules.get(String(id));
  const today = getDateKey();
  if (!rule || rule.mode !== 'gentle') return { ok: false, reason: '当前规则不支持临时延长' };
  if (rule.extensionDate === today && rule.extensionCount >= 1) return { ok: false, reason: '今天的临时延长机会已经使用' };
  rule.extraSeconds = (rule.extraSeconds || 0) + 5 * 60;
  rule.extensionDate = today;
  rule.extensionCount = 1;
  rule.status = '已延长5分钟';
  blockedNotifications.delete(rule.id);
  return { ok: true, extraSeconds: rule.extraSeconds, extensionDate: today, extensionCount: 1 };
});

ipcMain.handle('data:export', async (_event, payload) => {
  const storedHistory = database ? loadDatabaseState().usageHistory : [];
  const history = storedHistory.length > 0 ? storedHistory : (Array.isArray(payload?.history) ? payload.history : []);
  const result = await dialog.showSaveDialog({
    title: '导出使用记录',
    defaultPath: `时之界使用记录-${getDateKey()}.csv`,
    filters: [{ name: 'CSV 表格', extensions: ['csv'] }]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [['日期', '应用', '分类', '使用分钟', '当日额度分钟']];
  history.forEach((record) => rows.push([record.date, record.name, record.category || '其他', Math.round((Number(record.usedSeconds) || 0) / 60), record.limit || '']));
  await fs.writeFile(result.filePath, `\uFEFF${rows.map((row) => row.map(escape).join(',')).join('\r\n')}`, 'utf8');
  return { canceled: false, filePath: result.filePath };
});

async function getProcessSnapshot() {
  const script = `
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class NativeMethods { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId); }'
    [uint32]$foregroundPid = 0
    $handle = [NativeMethods]::GetForegroundWindow()
    if ($handle -ne [IntPtr]::Zero) { [void][NativeMethods]::GetWindowThreadProcessId($handle, [ref]$foregroundPid) }
    Get-Process | ForEach-Object {
      try {
        if ($_.Path -and [System.IO.Path]::GetExtension($_.Path) -ieq '.exe') {
          [PSCustomObject]@{ Id = $_.Id; Path = $_.Path; IsForeground = ($_.Id -eq $foregroundPid) }
        }
      } catch {}
    } | ConvertTo-Json -Compress
  `;
  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script
  ], { encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 2 * 1024 * 1024 });
  if (!stdout.trim()) return [];
  const parsed = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
  return (Array.isArray(parsed) ? parsed : [parsed]).map((item) => ({
    pid: Number(item.Id),
    path: path.normalize(String(item.Path)),
    normalizedPath: normalizeExecutablePath(item.Path),
    foreground: Boolean(item.IsForeground)
  }));
}

async function terminateProcesses(processes) {
  const taskkillPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');
  await Promise.all(processes.map(async ({ pid }) => {
    try {
      await execFileAsync(
        taskkillPath,
        ['/PID', String(pid), '/T', '/F'],
        { windowsHide: true, timeout: 5000 }
      );
      return true;
    } catch (error) {
      console.error(`Unable to terminate process ${pid}:`, error.message);
      return false;
    }
  }));
}

async function monitorLimits() {
  if (monitorBusy || monitoredRules.size === 0) return;
  monitorBusy = true;
  const now = Date.now();
  const monotonicNow = process.uptime() * 1000;
  const wallDelta = now - lastWallAt;
  const monotonicDelta = monotonicNow - lastMonotonicAt;
  const elapsedSeconds = Math.min(5, Math.max(0, monotonicDelta / 1000));
  if (protectionSettings.clock && Math.abs(wallDelta - monotonicDelta) > 60000 && now - lastClockWarningAt > 60000) {
    lastClockWarningAt = now;
    showNotification('检测到系统时间变化', '为保证限制准确，本次异常时间变化不会计入应用额度。');
  }
  lastMonitorAt = now;
  lastWallAt = now;
  lastMonotonicAt = monotonicNow;
  try {
    const today = getDateKey();
    const weekday = DAY_LABELS[new Date().getDay()];
    const idle = protectionSettings.idle && powerMonitor.getSystemIdleTime() >= 300;
    const processes = await getProcessSnapshot();
    monitorDiagnostics = {
      cycles: monitorDiagnostics.cycles + 1,
      lastProcessCount: processes.length,
      lastError: null
    };
    const updates = [];

    for (const rule of monitoredRules.values()) {
      if (rule.usageDate !== today) {
        rule.usageDate = today;
        rule.usedSeconds = 0;
        if (protectionSettings.reset) rule.quotaUsedSeconds = 0;
        rule.extraSeconds = 0;
        rule.extensionDate = null;
        rule.extensionCount = 0;
        rule.warningDate = null;
        rule.status = '尚未使用';
      }

      const matchingProcesses = processes.filter((process) => process.normalizedPath === rule.normalizedPath);
      const foreground = matchingProcesses.some((process) => process.foreground);
      const activeToday = rule.weekdays.includes(weekday);
      const activeNow = isWithinSchedule(rule);
      const limitSeconds = rule.limit * 60 + (rule.extraSeconds || 0);
      const quotaUsedSeconds = Math.max(0, rule.quotaUsedSeconds || 0);

      if (rule.enabled && activeToday && activeNow && !idle && foreground && quotaUsedSeconds < limitSeconds) {
        rule.usedSeconds = Math.min(limitSeconds, rule.usedSeconds + elapsedSeconds);
        rule.quotaUsedSeconds = Math.min(limitSeconds, quotaUsedSeconds + elapsedSeconds);
      }

      const exhausted = (rule.quotaUsedSeconds || 0) >= limitSeconds;
      const remainingSeconds = Math.max(0, limitSeconds - (rule.quotaUsedSeconds || 0));
      if (rule.enabled && activeToday && activeNow && foreground && !exhausted && rule.warningMinutes > 0 && remainingSeconds <= rule.warningMinutes * 60 && rule.warningDate !== today) {
        rule.warningDate = today;
        showNotification(`${rule.name} 即将达到限制`, `今天还可使用约 ${Math.max(1, Math.ceil(remainingSeconds / 60))} 分钟。`);
      }
      if (rule.enabled && activeToday && activeNow && exhausted) {
        rule.status = rule.mode === 'standard' ? '已限制' : '额度已用完';
        if (foreground && matchingProcesses.length) {
          if (rule.mode === 'standard') await terminateProcesses(matchingProcesses);
          const lastNotification = blockedNotifications.get(rule.id) || 0;
          if (now - lastNotification > 30000) {
            blockedNotifications.set(rule.id, now);
            showMainWindow();
            broadcast('limits:blocked', { id: rule.id, name: rule.name, icon: rule.icon, color: rule.color, limit: Math.round(limitSeconds / 60), mode: rule.mode, extensionCount: rule.extensionCount || 0 });
          }
        }
      } else if (!rule.enabled) {
        rule.status = '已暂停';
      } else if (!activeToday) {
        rule.status = '今日不生效';
      } else if (!activeNow) {
        rule.status = '当前时段不生效';
      } else if (idle) {
        rule.status = '空闲暂停计时';
      } else if (foreground) {
        rule.status = '使用中';
      } else if ((rule.quotaUsedSeconds || 0) > 0) {
        rule.status = `还剩${Math.max(0, Math.ceil(remainingSeconds / 60))}分`;
      } else {
        rule.status = '尚未使用';
      }

      updates.push({
        id: rule.id,
        usedSeconds: Math.floor(rule.usedSeconds),
        used: Math.floor(rule.usedSeconds / 60),
        quotaUsedSeconds: Math.floor(rule.quotaUsedSeconds || 0),
        extraSeconds: rule.extraSeconds || 0,
        extensionDate: rule.extensionDate,
        extensionCount: rule.extensionCount || 0,
        usageDate: rule.usageDate,
        status: rule.status
      });
    }
    broadcast('limits:usage', updates);
  } catch (error) {
    monitorDiagnostics = { ...monitorDiagnostics, lastError: error.message };
    console.error('Limit monitor failed:', error);
  } finally {
    monitorBusy = false;
  }
}

ipcMain.handle('app:info', () => ({
  name: '时之界',
  version: app.getVersion(),
  platform: process.platform === 'win32' ? 'Windows' : process.platform,
  architecture: process.arch,
  dataPath: databasePath || app.getPath('userData')
}));

ipcMain.handle('processes:list', async () => {
  const script = [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    "$trayApps = @('Weixin', 'WeChat', 'WXWork', 'QQ', 'TIM', 'Telegram', 'Discord', 'Spotify', 'Steam')",
    "Get-Process | ForEach-Object { try { if ($_.Path -and [System.IO.Path]::GetExtension($_.Path) -ieq '.exe' -and ($_.MainWindowTitle -or $trayApps -contains $_.ProcessName)) { $version = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($_.Path); [PSCustomObject]@{ Id = $_.Id; ProcessName = $_.ProcessName; Path = $_.Path; MainWindowTitle = $_.MainWindowTitle; FileDescription = $version.FileDescription; ProductName = $version.ProductName } } } catch {} } | ConvertTo-Json -Compress"
  ].join('; ');
  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script
  ], { encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 });

  if (!stdout.trim()) return [];
  const parsed = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
  const processes = Array.isArray(parsed) ? parsed : [parsed];
  const seen = new Set();
  const ownProcessNames = new Set([
    path.basename(process.execPath, path.extname(process.execPath)).toLowerCase(),
    'focus-guardian',
    '专注守门员',
    '时之界'
  ]);
  const hiddenSystemProcesses = new Set([
    'applicationframehost', 'explorer', 'lockapp', 'searchhost',
    'shellexperiencehost', 'startmenuexperiencehost', 'systemsettings', 'textinputhost'
  ]);
  const helperProcesses = new Set(['wechatappex', 'wechatocr', 'wxworkweb']);
  const friendlyNames = new Map([
    ['weixin', '微信'],
    ['wechat', '微信'],
    ['wxwork', '企业微信'],
    ['qq', 'QQ'],
    ['tim', 'TIM']
  ]);

  return processes
    .filter((item) => {
      const processName = String(item.ProcessName || '').toLowerCase();
      return item.Path && item.Id !== process.pid &&
        path.normalize(item.Path) !== path.normalize(process.execPath) &&
        !ownProcessNames.has(processName) && !hiddenSystemProcesses.has(processName) && !helperProcesses.has(processName);
    })
    .map((item) => {
      const executablePath = path.normalize(item.Path);
      const processName = String(item.ProcessName || path.basename(executablePath, path.extname(executablePath)));
      const name = friendlyNames.get(processName.toLowerCase()) || String(item.ProductName || item.FileDescription || processName).trim();
      return {
        id: `file:${executablePath.toLowerCase()}`,
        pid: item.Id,
        name,
        processName,
        windowTitle: item.MainWindowTitle || `${name}（后台运行）`,
        hasWindow: Boolean(item.MainWindowTitle),
        path: executablePath
      };
    })
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((left, right) => Number(right.hasWindow) - Number(left.hasWindow) || left.name.localeCompare(right.name, 'zh-CN'));
});

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showMainWindow();
    return mainWindow;
  }

  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#F5F7FB',
    title: '时之界',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow = window;

  window.once('ready-to-show', () => {
    if (!startInBackground) window.show();
  });
  window.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    window.hide();
    window.setSkipTaskbar(true);
    if (!backgroundNoticeShown && tray && process.platform === 'win32') {
      backgroundNoticeShown = true;
      tray.displayBalloon({
        title: '时之界正在后台运行',
        content: '应用限制仍在生效，可从系统托盘重新打开。',
        iconType: 'info'
      });
    }
  });
  window.on('closed', () => {
    mainWindow = null;
  });
  window.loadFile(path.join(__dirname, '..', 'web-build', 'index.html'));

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  return window;
}

function createTray() {
  if (tray) return;
  tray = new Tray(path.join(__dirname, '..', 'assets', 'icon.png'));
  tray.setToolTip('时之界 · 保护服务运行中');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开时之界', click: showMainWindow },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
  tray.on('click', showMainWindow);
}

app.whenReady().then(() => {
  try {
    initializeDatabase();
  } catch (error) {
    console.error('Unable to initialize persistent SQLite database:', error);
    databasePath = '内存临时数据库（本机存储初始化失败）';
    database = new DatabaseSync(':memory:');
    database.exec(`CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP); CREATE TABLE applications (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP); CREATE TABLE usage_history (date TEXT NOT NULL, app_id TEXT NOT NULL, used_seconds INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (date, app_id));`);
  }
  createWindow();
  createTray();
  lastMonitorAt = Date.now();
  lastWallAt = Date.now();
  lastMonotonicAt = process.uptime() * 1000;
  monitorTimer = setInterval(monitorLimits, 2000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Keep monitoring in the system tray after the main window is closed.
});

app.on('before-quit', () => {
  isQuitting = true;
  if (monitorTimer) clearInterval(monitorTimer);
  try { database?.close(); } catch {}
});
