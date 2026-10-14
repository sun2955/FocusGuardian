const http = require('http');
const WebSocket = require('ws');

const endpoint = process.argv[2] || 'http://127.0.0.1:9337';
const readOnly = process.argv.includes('--read-only');
let sequence = 0;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getJson(pathname) {
  return new Promise((resolve, reject) => {
    http.get(`${endpoint}${pathname}`, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
    }).on('error', reject);
  });
}

function dateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function run() {
  let pages;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { pages = await getJson('/json'); if (pages.some((page) => page.type === 'page')) break; } catch {}
    await wait(500);
  }
  const page = pages?.find((item) => item.type === 'page');
  if (!page) throw new Error('Electron page was not available.');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString());
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  });
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  const evaluate = (expression) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, (message) => {
      if (message.result?.exceptionDetails) reject(new Error(message.result.exceptionDetails.text));
      else resolve(message.result?.result?.value);
    });
    socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
  });

  const settings = { startup: false, idle: false, reset: true, clock: true };
  const applications = [{ id: 'sqlite-test', name: 'SQLite 测试应用', path: 'C:\\Missing\\sqlite-test.exe', category: '其他', icon: 'desktop-outline', color: '#64748B', limit: 45, usedSeconds: 900, quotaUsedSeconds: 900, used: 15, usageDate: dateKey(), status: '还剩30分', enabled: true, weekdays: ['一', '二', '三', '四', '五', '六', '日'], startTime: '00:00', endTime: '24:00', warningMinutes: 5, mode: 'standard' }];
  const usageHistory = [{ date: dateKey(), appId: 'sqlite-test', name: 'SQLite 测试应用', category: '其他', icon: 'desktop-outline', color: '#64748B', limit: 45, usedSeconds: 900 }];
  if (!readOnly) {
    await evaluate(`Promise.all([focusGuardian.saveSettings(${JSON.stringify(settings)}), focusGuardian.saveApplications(${JSON.stringify(applications)}), focusGuardian.saveUsageHistory(${JSON.stringify(usageHistory)})])`);
    await evaluate(`localStorage.clear(); location.reload(); true`);
    await wait(1800);
  }

  const restored = await evaluate(`({ settings: JSON.parse(localStorage.getItem('focus-guardian.settings')), applications: JSON.parse(localStorage.getItem('focus-guardian.applications')), history: JSON.parse(localStorage.getItem('focus-guardian.usage-history')) })`);
  const appInfo = await evaluate('focusGuardian.getAppInfo()');
  if (restored.settings.idle !== false || restored.settings.reset !== true) throw new Error('Settings were not restored from SQLite.');
  if (restored.applications.length !== 1 || restored.applications[0].id !== 'sqlite-test' || restored.applications[0].limit !== 45) throw new Error('Applications were not restored from SQLite.');
  if (restored.history.length !== 1 || restored.history[0].usedSeconds !== 900) throw new Error('Usage history was not restored from SQLite.');
  if (!/data\.sqlite$/i.test(appInfo.dataPath)) throw new Error(`Unexpected database path: ${appInfo.dataPath}`);
  console.log(JSON.stringify({ settings: 'restored', applications: 'restored', history: 'restored', databasePath: appInfo.dataPath }));
  socket.close();
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
