const http = require('http');
const WebSocket = require('ws');

const endpoint = process.argv[2] || 'http://127.0.0.1:9333';
let sequence = 0;

function getJson(pathname) {
  return new Promise((resolve, reject) => {
    http.get(`${endpoint}${pathname}`, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dateKey(offset) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function run() {
  let pages;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      pages = await getJson('/json');
      if (pages.some((page) => page.type === 'page')) break;
    } catch {}
    await wait(500);
  }
  const page = pages?.find((item) => item.type === 'page');
  if (!page) throw new Error('Electron page was not available through DevTools.');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString());
    if (!message.id || !pending.has(message.id)) return;
    pending.get(message.id)(message);
    pending.delete(message.id);
  });
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
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

  const applications = [
    { id: 'test-video', name: '视频应用', path: 'C:\\Missing\\video.exe', category: '影音娱乐', icon: 'play-circle', color: '#5965F2', limit: 120, usedSeconds: 5400, used: 90, usageDate: dateKey(0), status: '还剩30分', enabled: true, weekdays: ['一', '二', '三', '四', '五', '六', '日'], mode: 'standard' },
    { id: 'test-game', name: '游戏应用', path: 'C:\\Missing\\game.exe', category: '游戏', icon: 'game-controller', color: '#F97316', limit: 60, usedSeconds: 1200, used: 20, usageDate: dateKey(0), status: '还剩40分', enabled: true, weekdays: ['一', '二', '三', '四', '五', '六', '日'], mode: 'standard' }
  ];
  const history = [
    { date: dateKey(0), appId: 'test-video', name: '视频应用', category: '影音娱乐', icon: 'play-circle', color: '#5965F2', limit: 120, usedSeconds: 5400 },
    { date: dateKey(0), appId: 'test-game', name: '游戏应用', category: '游戏', icon: 'game-controller', color: '#F97316', limit: 60, usedSeconds: 1200 },
    { date: dateKey(-1), appId: 'test-video', name: '视频应用', category: '影音娱乐', icon: 'play-circle', color: '#5965F2', limit: 120, usedSeconds: 3600 },
    { date: dateKey(-2), appId: 'test-game', name: '游戏应用', category: '游戏', icon: 'game-controller', color: '#F97316', limit: 60, usedSeconds: 1800 },
    { date: dateKey(-7), appId: 'test-video', name: '视频应用', category: '影音娱乐', icon: 'play-circle', color: '#5965F2', limit: 120, usedSeconds: 7200 },
    { date: dateKey(-8), appId: 'test-game', name: '游戏应用', category: '游戏', icon: 'game-controller', color: '#F97316', limit: 60, usedSeconds: 4200 },
    { date: dateKey(-9), appId: 'test-video', name: '视频应用', category: '影音娱乐', icon: 'play-circle', color: '#5965F2', limit: 120, usedSeconds: 3600 }
  ];

  await evaluate(`localStorage.setItem('focus-guardian.applications', ${JSON.stringify(JSON.stringify(applications))}); localStorage.setItem('focus-guardian.usage-history', ${JSON.stringify(JSON.stringify(history))}); location.reload(); true`);
  await wait(1800);
  const home = await evaluate('document.body.innerText');
  const homeChecks = ['1小时10分', '3小时20分', '29分钟', '较上周 -20%', '视频应用', '游戏应用'];
  homeChecks.forEach((value) => { if (!home.includes(value)) throw new Error(`Home is missing: ${value}`); });

  const openedStats = await evaluate(`(() => { const node = [...document.querySelectorAll('*')].find((item) => item.textContent.trim() === '使用统计' && item.children.length === 0); const button = node?.closest('[role="button"]') || node?.parentElement; if (!button) return false; button.click(); return true; })()`);
  if (!openedStats) throw new Error('Unable to open the stats page.');
  await wait(500);
  const sevenDays = await evaluate('document.body.innerText');
  ['3小时20分', '-20%', '视频应用', '2小时30分', '游戏应用', '50分钟'].forEach((value) => { if (!sevenDays.includes(value)) throw new Error(`7-day stats are missing: ${value}\n${sevenDays}`); });

  await evaluate(`(() => { const node = [...document.querySelectorAll('*')].find((item) => item.textContent.trim() === '今天' && item.children.length === 0); const button = node?.closest('[role="button"]') || node?.parentElement; if (!button) return false; button.click(); return true; })()`);
  await wait(300);
  const today = await evaluate('document.body.innerText');
  ['1小时50分', '+83%', '1天', '1小时30分', '20分钟'].forEach((value) => { if (!today.includes(value)) throw new Error(`Today stats are missing: ${value}`); });

  await evaluate(`(() => { const node = [...document.querySelectorAll('*')].find((item) => item.textContent.trim() === '30天' && item.children.length === 0); const button = node?.closest('[role="button"]') || node?.parentElement; if (!button) return false; button.click(); return true; })()`);
  await wait(300);
  const thirtyDays = await evaluate('document.body.innerText');
  ['7小时30分', '暂无对比'].forEach((value) => { if (!thirtyDays.includes(value)) throw new Error(`30-day stats are missing: ${value}`); });
  console.log(JSON.stringify({ home: 'passed', sevenDays: 'passed', today: 'passed', thirtyDays: 'passed' }));
  socket.close();
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
