const http = require('http');
const WebSocket = require('ws');

const endpoint = process.argv[2] || 'http://127.0.0.1:9336';
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
  const applications = await evaluate('focusGuardian.getRunningApplications()');
  const wechat = applications.find((item) => item.name === '微信' && /\\Weixin\\Weixin\.exe$/i.test(item.path));
  if (!wechat) throw new Error(`微信未被识别。当前应用：${applications.map((item) => `${item.name} (${item.processName})`).join(', ')}`);
  if (applications.some((item) => /^(WeChatAppEx|WeChatOCR|WXWorkWeb)$/i.test(item.processName))) throw new Error('微信辅助进程没有被正确过滤。');
  console.log(JSON.stringify({ name: wechat.name, processName: wechat.processName, path: wechat.path, windowTitle: wechat.windowTitle }));
  socket.close();
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
