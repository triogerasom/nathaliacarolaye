const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/config') { res.setHeader('Content-Type', 'application/json'); res.end('{}'); return; }
  if (url.pathname === '/api/fiemg-import') {
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 8192) { res.writeHead(413).end(); return; } }
    req.body = body;
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (value) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
    return require('../api/fiemg-import.js')(req, res);
  }
  if (url.pathname === '/api/fiemg-detail') {
    req.query = Object.fromEntries(url.searchParams);
    req.status = (code) => { res.statusCode = code; return res; };
    req.json = (value) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
    res.status = req.status;
    res.json = req.json;
    return require('../api/fiemg-detail.js')(req, res);
  }
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    const data = await fs.promises.readFile(file);
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(data);
  } catch { res.writeHead(404).end('Not found'); }
});
server.listen(Number(process.env.PORT || 4178), '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}`));
