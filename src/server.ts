import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { ReconciliationService } from './engine.js';
import { fixture } from './fixtures.js';
import { Store } from './store.js';
import type { Kitchen, Order, Settlement } from './domain.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const storePath = process.env.STORE_PATH || 'data/store.json';
const staticRoot = `${process.cwd()}/apps/demo/dist`;
const service = new ReconciliationService(new Store(storePath));
const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function seedBaseline() {
  if (service.list().sourceRecords.length > 0) return;
  service.ingestOrders(fixture.orders);
  service.ingestKitchen(fixture.kitchen.map(([externalId, orderRef]) => ({
    source: 'kitchen', externalId, orderRef, cookedAt: `${fixture.date}T18:00:00.000Z`
  })));
}

function resetBaseline() {
  service.store.reset();
  seedBaseline();
}

function send(res: any, status: number, body: unknown) {
  res.writeHead(status, jsonHeaders);
  res.end(JSON.stringify(body));
}

function readJson(req: any): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error('Request body exceeds 1 MB'));
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : []); } catch { reject(new Error('Request body must be valid JSON')); }
    });
    req.on('error', reject);
  });
}

function rows<T>(body: unknown): T[] {
  if (!Array.isArray(body)) throw new Error('Request body must be a JSON array');
  return body as T[];
}

function serveStatic(url: URL, res: any) {
  const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
  if (requestPath.includes('..')) return send(res, 404, { error: 'not found' });
  const requested = `${staticRoot}${requestPath}`;
  const fallback = `${staticRoot}/index.html`;
  const file = existsSync(requested) ? requested : fallback;
  if (!existsSync(file)) return send(res, 404, { error: 'frontend build not found' });
  const extension = file.slice(file.lastIndexOf('.') + 1);
  const contentType: Record<string, string> = {
    html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
    svg: 'image/svg+xml', png: 'image/png', ico: 'image/x-icon'
  };
  res.writeHead(200, { 'content-type': contentType[extension] || 'application/octet-stream' });
  res.end(readFileSync(file));
}

seedBaseline();

createServer(async (req: any, res: any) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const date = url.searchParams.get('date') || fixture.date;
  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });
  if (!url.pathname.startsWith('/api/')) return serveStatic(url, res);

  try {
    if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, service.list());
    if (req.method === 'GET' && url.pathname === '/api/reconciliation') return send(res, 200, service.reconcile(date));
    if (req.method === 'GET' && url.pathname === '/api/exceptions') return send(res, 200, service.list().exceptions.filter(item => item.date === date));
    if (req.method === 'GET' && url.pathname === '/api/closes') return send(res, 200, service.list().closes);
    if (req.method === 'GET' && url.pathname === '/api/adjustments') return send(res, 200, service.list().adjustments);
    if (req.method === 'POST' && url.pathname === '/api/close') return send(res, 200, service.close(date));
    if (req.method === 'POST' && url.pathname === '/api/adjust') {
      // The bundled UI is a deterministic simulation: settlement evidence arrives only
      // after the close. Production clients use POST /api/ingest/settlements instead.
      if (service.list().settlements.length === 0) service.ingestSettlements(fixture.settlements);
      return send(res, 200, service.adjust());
    }
    if (req.method === 'POST' && url.pathname === '/api/reset') {
      resetBaseline(); return send(res, 200, { ok: true, state: service.list() });
    }
    if (req.method === 'POST' && url.pathname === '/api/ingest/orders') return send(res, 200, service.ingestOrders(rows<Omit<Order, 'id' | 'ingestedAt'>>(await readJson(req))));
    if (req.method === 'POST' && url.pathname === '/api/ingest/kitchen') return send(res, 200, service.ingestKitchen(rows<Omit<Kitchen, 'id' | 'ingestedAt'>>(await readJson(req))));
    if (req.method === 'POST' && url.pathname === '/api/ingest/settlements') return send(res, 200, service.ingestSettlements(rows<Omit<Settlement, 'id'>>(await readJson(req))));
    return send(res, 404, { error: 'not found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'internal server error';
    return send(res, 400, { error: message });
  }
}).listen(port, host, () => console.log(`Listening on http://${host}:${port}`));
