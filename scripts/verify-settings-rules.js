const http = require('http');
const WebSocket = require('ws');

const endpoint = process.argv[2] || 'http://127.0.0.1:9335';
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
  const command = (method, params = {}) => new Promise((resolve) => {
    const id = ++sequence;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text);
    return response.result?.result?.value;
  };
  const clickText = (text) => evaluate(`(() => { const node = [...document.querySelectorAll('*')].find((item) => item.textContent.trim() === ${JSON.stringify(text)} && item.children.length === 0); const target = node?.closest('[role="button"]') || node?.parentElement; if (!target) return false; target.click(); return true; })()`);

  const settings = { startup: false, idle: false, reset: false, clock: false };
  const applications = [
    { id: 'gentle-test', name: '视频应用', path: 'C:\\Missing\\video.exe', category: '影音', icon: 'play-circle', color: '#5965F2', limit: 60, usedSeconds: 600, quotaUsedSeconds: 600, used: 10, usageDate: dateKey(), status: '还剩50分', enabled: true, weekdays: ['一', '二', '三', '四', '五'], startTime: '18:00', endTime: '23:00', warningMinutes: 10, mode: 'gentle' },
    { id: 'standard-test', name: '游戏应用', path: 'C:\\Missing\\game.exe', category: '游戏', icon: 'game-controller', color: '#F97316', limit: 30, usedSeconds: 0, quotaUsedSeconds: 0, used: 0, usageDate: dateKey(), status: '尚未使用', enabled: true, weekdays: ['一', '二', '三', '四', '五', '六', '日'], startTime: '22:00', endTime: '02:00', warningMinutes: 5, mode: 'standard' }
  ];
  await evaluate(`localStorage.setItem('focus-guardian.settings', ${JSON.stringify(JSON.stringify(settings))}); localStorage.setItem('focus-guardian.applications', ${JSON.stringify(JSON.stringify(applications))}); location.reload(); true`);
  await wait(2200);

  const applied = await evaluate('focusGuardian.getSettings()');
  for (const [key, value] of Object.entries(settings)) if (applied[key] !== value) throw new Error(`Setting was not applied: ${key}`);
  const debug = await evaluate('focusGuardian.getLimitDebug()');
  const gentle = debug.rules.find((rule) => rule.id === 'gentle-test');
  const standard = debug.rules.find((rule) => rule.id === 'standard-test');
  if (!gentle || gentle.startTime !== '18:00' || gentle.endTime !== '23:00' || gentle.warningMinutes !== 10 || gentle.mode !== 'gentle') throw new Error('Gentle rule was not synchronized correctly.');
  if (!standard || standard.startTime !== '22:00' || standard.endTime !== '02:00' || standard.mode !== 'standard') throw new Error('Overnight standard rule was not synchronized correctly.');

  await clickText('应用限制');
  await wait(300);
  const limits = await evaluate('document.body.innerText');
  ['周一、周二、周三、周四、周五 18:00—23:00', '提前10分钟提醒', '每天 22:00—02:00', '提前5分钟提醒'].forEach((text) => { if (!limits.includes(text)) throw new Error(`Limits page is missing: ${text}`); });

  const firstExtension = await evaluate(`focusGuardian.extendLimit('gentle-test')`);
  const secondExtension = await evaluate(`focusGuardian.extendLimit('gentle-test')`);
  const standardExtension = await evaluate(`focusGuardian.extendLimit('standard-test')`);
  if (!firstExtension.ok || firstExtension.extraSeconds !== 300) throw new Error('Gentle extension did not add five minutes.');
  if (secondExtension.ok) throw new Error('Gentle extension was allowed more than once.');
  if (standardExtension.ok) throw new Error('Standard mode incorrectly allowed an extension.');

  await clickText('设置');
  await wait(300);
  const switches = await evaluate(`[...document.querySelectorAll('[role="switch"]')].map((node) => Boolean(node.checked))`);
  if (switches.length !== 4 || switches.some(Boolean)) throw new Error(`Settings switches do not match saved values: ${switches.join(',')}`);
  await evaluate(`(() => { const switches = [...document.querySelectorAll('[role="switch"]')]; switches[1].click(); return true; })()`);
  await wait(400);
  const stored = await evaluate(`JSON.parse(localStorage.getItem('focus-guardian.settings'))`);
  const updated = await evaluate('focusGuardian.getSettings()');
  if (!stored.idle || !updated.idle) throw new Error('Settings switch did not persist and reach the main process.');

  console.log(JSON.stringify({ settingsPersistence: 'passed', ruleSchedule: 'passed', reminders: 'passed', gentleExtension: 'passed', standardProtection: 'passed' }));
  socket.close();
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
