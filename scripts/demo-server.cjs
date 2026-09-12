/*
 * 仅用于本地预览的静态服务器（不进生产、不被 Spring Boot 打包）。
 *
 *   node scripts/demo-server.cjs   ->   http://localhost:8124
 *
 * 路由:
 *   /                  -> scripts/demo/demo-compare.html (新旧对比)
 *   /demo-*.html       -> scripts/demo/
 *   其他               -> src/main/resources/static/
 *   /old/**            -> 原仓库(Desktop)的旧版图片,仅供对比页使用
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const mimes = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.ico': 'image/x-icon' };

const projectRoot = path.join(__dirname, '..');
const staticRoot = path.join(projectRoot, 'src', 'main', 'resources', 'static');
const demoRoot = path.join(__dirname, 'demo');
const legacyRoot = path.join(os.homedir(), 'Desktop', '求职', 'Tongshengbolg', 'src', 'main', 'resources', 'static');

function resolve(urlPath) {
  if (urlPath === '/' ) return path.join(demoRoot, 'demo-compare.html');
  if (urlPath.startsWith('/old/')) return path.join(legacyRoot, urlPath.slice('/old'.length));
  if (/^\/demo-.*\.html$/.test(urlPath)) return path.join(demoRoot, path.basename(urlPath));
  return path.join(staticRoot, urlPath);
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const fp = resolve(urlPath);
  try {
    const data = fs.readFileSync(fp);
    res.writeHead(200, { 'Content-Type': mimes[path.extname(fp)] || 'text/plain' });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 ' + urlPath);
  }
}).listen(8124, () => console.log('http://localhost:8124 ready'));
