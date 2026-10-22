import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { openStore, AppError, MAX_PDF_BYTES } from './store.mjs';

const publicRoot = fileURLToPath(new URL('./web/', import.meta.url));
const vendorRoot = fileURLToPath(new URL('../../node_modules/pdfjs-dist/', import.meta.url));
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.bcmap': 'application/octet-stream', '.ttf': 'font/ttf', '.pfb': 'application/octet-stream' };
export async function startApp({ directory = resolve('.local/app'), port = 4173 } = {}) {
  const store = await openStore(directory);
  const token = randomBytes(32).toString('hex');
  let origin;
  const server = createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self'; img-src 'self' data: blob:; font-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    const send = (status, data, type = 'application/json') => {
      response.writeHead(status, { 'Content-Type': type });
      response.end(type === 'application/json' ? JSON.stringify(data) : data);
    };
    try {
      if (request.headers.host !== new URL(origin).host) throw new AppError(403, 'Unrecognised host');
      const url = new URL(request.url, origin);
      if (request.headers.origin && request.headers.origin !== origin) throw new AppError(403, 'Unrecognised origin');
      const write = !['GET','HEAD'].includes(request.method);
      if (write) {
        const provided = Buffer.from(request.headers['x-fire-token'] || '');
        const expected = Buffer.from(token);
        if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw new AppError(403, 'Session token required');
      }
      let body;
      async function readBody(limit) {
        const chunks = []; let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > limit) throw new AppError(413, 'Upload exceeds local size limit');
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      }
      if (write && request.headers['content-type']?.startsWith('application/json')) {
        try { body = JSON.parse((await readBody(8192)).toString()); }
        catch (error) { if (error.status) throw error; throw new AppError(400, 'Invalid JSON'); }
      }
      if (request.method === 'GET' && url.pathname === '/api/session') return send(200, { token });
      if (request.method === 'GET' && url.pathname === '/api/state') return send(200, store.snapshot());
      if (request.method === 'POST' && url.pathname === '/api/entities') {
        if (!body || typeof body !== 'object') throw new AppError(400, 'JSON object required');
        return send(201, store.create(body.kind, body.parentId, body.name));
      }
      const upload = url.pathname.match(/^\/api\/disciplines\/([\w-]+)\/drawings$/);
      if (request.method === 'POST' && upload) {
        if (request.headers['content-type'] !== 'application/pdf') throw new AppError(415, 'PDF upload required');
        return send(201, await store.importPdf(upload[1], url.searchParams.get('name'), await readBody(MAX_PDF_BYTES)));
      }
      const source = url.pathname.match(/^\/api\/drawings\/([\w-]+)\/source$/);
      if (request.method === 'GET' && source) return send(200, await store.source(source[1]), 'application/pdf');
      const drawing = url.pathname.match(/^\/api\/drawings\/([\w-]+)$/);
      if (request.method === 'DELETE' && drawing) { store.deleteDrawing(drawing[1]); return send(200, { deleted: true }); }
      if (request.method !== 'GET' || url.pathname.startsWith('/api/')) throw new AppError(404, 'Not found');
      const vendor = url.pathname.startsWith('/vendor/');
      const base = vendor ? vendorRoot : publicRoot;
      const relative = vendor ? url.pathname.slice(8) : url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const path = resolve(base, decodeURIComponent(relative));
      if (!path.startsWith(resolve(base) + sep)) throw new AppError(403, 'Invalid path');
      const content = await readFile(path).catch(() => { throw new AppError(404, 'Not found'); });
      send(200, content, types[extname(path)] || 'application/octet-stream');
    } catch (error) {
      if (!response.headersSent) send(error.status || 500, { error: error.status ? error.message : 'The operation could not be completed' });
      else response.end();
    }
  });
  try { await new Promise((ready, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', ready); }); }
  catch (error) { store.close(); throw error; }
  origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, store, close: async () => { await new Promise(done => server.close(done)); store.close(); } };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await startApp({ directory: process.env.FIRE_TAKE_OFF_DATA || resolve('.local/app'), port: Number(process.env.PORT || 4173) });
  console.log(`Fire Take Off: ${app.origin}`);
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
}
