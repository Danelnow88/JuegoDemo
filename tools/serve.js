// Servidor estático mínimo SOLO PARA DESARROLLO/PRUEBAS (no se usa en producción).
// Uso:  node tools/serve.js [puerto]   (por defecto 8080)
// Sirve la carpeta del proyecto con los MIME básicos para poder abrir el juego
// desde el teléfono en la red local y probar la capa móvil con la MÍSMA URL.
// No es un build ni una segunda versión del juego.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.argv[2] || '8080', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    fs.stat(filePath, (err, st) => {
      if (err || !st.isFile()) {
        // Flat redirect para el caso más simple: "/" -> index.html y fallback amable.
        if (urlPath === '/') {
          filePath = path.join(ROOT, 'index.html');
        } else {
          res.writeHead(404).end('Not found'); return;
        }
      }
      const ext = path.extname(filePath).toLowerCase();
      const type = MIME[ext] || 'application/octet-stream';
      const stream = fs.createReadStream(filePath);
      res.writeHead(200, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      if (req.method === 'HEAD') { res.end(); return; }
      stream.pipe(res);
    });
  } catch (e) {
    res.writeHead(500).end(String(e && e.message || e));
  }
}).listen(PORT, () => {
  console.log('[serve] http://localhost:' + PORT + '/  (root: ' + ROOT + ')');
});