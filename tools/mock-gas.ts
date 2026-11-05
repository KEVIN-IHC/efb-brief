// 개발용 Mock Apps Script 백엔드 (vite dev / vite preview 전용, 메모리 저장. 배포 빌드에는 포함되지 않음).
// apps-script/Code.gs 와 같은 요청·응답 규격을 흉내낸다. 토큰: "dev-token"
import type { Connect, Plugin } from 'vite';

interface Row {
  logId: string;
  [k: string]: unknown;
}

export function mockGasPlugin(): Plugin {
  const rows = new Map<string, Row>();
  const log = (msg: string) => console.log(`[mock-gas] ${msg}`);
  const handler: Connect.NextHandleFunction = (req, res) => {
        const send = (obj: unknown) => {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(obj));
        };
        if (req.method === 'GET') return send({ ok: true, service: 'efb-mock-gas', rows: rows.size });
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const r = JSON.parse(body);
            if (r.token !== 'dev-token') return send({ ok: false, error: 'unauthorized' });
            if (r.op === 'ping') return send({ ok: true, pong: true });
            if (r.op === 'listLogs') {
              return send({ ok: true, logs: [...rows.values()].filter((x) => !r.flightId || x.flightId === r.flightId) });
            }
            if (r.op === 'upsertLog') {
              const results = (r.records ?? []).map((rec: Row) => {
                if (!rec?.logId) return { logId: rec?.logId, status: 'error', error: 'missing logId' };
                if (rows.has(rec.logId)) return { logId: rec.logId, status: 'duplicate' };
                rows.set(rec.logId, { ...rec, receivedAt: new Date().toISOString() });
                return { logId: rec.logId, status: 'inserted' };
              });
              log(`upsertLog ${JSON.stringify(results)} (total ${rows.size})`);
              return send({ ok: true, results });
            }
            send({ ok: false, error: 'unknown op' });
          } catch (e) {
            send({ ok: false, error: String(e) });
          }
        });
  };
  return {
    name: 'efb-mock-gas',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/mock-gas', handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/mock-gas', handler);
    },
  };
}
