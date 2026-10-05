/**
 * Local server: the same handlers as the Vercel functions, plus the static
 * pages from public/.
 *
 *   npm run dev               # against Supabase (needs .env)
 *   npm run dev -- --demo     # in-memory demo data, stubbed model: no keys at all
 */
import 'dotenv/config';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createHandler } from '../src/http.js';
import { supabaseStore } from '../src/store.js';
import { demoSetup } from '../src/demo.js';

const demo = process.argv.includes('--demo');
const port = Number(process.env.PORT ?? 3000);
const publicDir = new URL('../public/', import.meta.url).pathname;

const { store, deps, links } = demo
  ? await demoSetup()
  : { store: supabaseStore(), deps: {}, links: [] as string[] };
const handle = createHandler(store, deps);

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);

  if (url.pathname.startsWith('/api/')) {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const r = await handle(
      new Request(url, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
      }),
    );
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }

  const path = normalize(join(publicDir, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!path.startsWith(publicDir)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => {
  console.log(`http://localhost:${port}${demo ? '  (demo: in-memory data, stubbed model)' : ''}`);
  for (const l of links) console.log(`  ${l.replace('{base}', `http://localhost:${port}`)}`);
});
