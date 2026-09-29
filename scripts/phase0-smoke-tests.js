#!/usr/bin/env node
const http = require('http');
const https = require('https');
const net = require('net');
const fs = require('fs');

function parseEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  const s = fs.readFileSync(path, 'utf8');
  return Object.fromEntries(
    s.split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .map(l => {
        const idx = l.indexOf('=');
        if (idx === -1) return [l, ''];
        return [l.slice(0, idx), l.slice(idx + 1)];
      })
  );
}

const env = Object.assign({}, process.env, parseEnvFile('.env.local'));

const endpoints = [
  { name: 'Next.js', url: env.NEXT_URL || 'http://127.0.0.1:3000' },
  { name: 'Prometheus', url: env.PROMETHEUS_URL || 'http://127.0.0.1:9090' },
  { name: 'Grafana', url: env.GRAFANA_URL || 'http://127.0.0.1:3001' }
];

function httpGet(url, timeout = 5000) {
  return new Promise((resolve) => {
    try {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.get(url, (res) => {
        res.resume();
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
      });
      req.on('error', (err) => resolve({ ok: false, error: String(err) }));
      req.setTimeout(timeout, () => {
        req.abort();
        resolve({ ok: false, error: 'timeout' });
      });
    } catch (err) {
      resolve({ ok: false, error: String(err) });
    }
  });
}

function tcpConnect(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    sock.setTimeout(timeout);
    sock.on('connect', () => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve({ ok: true });
    });
    sock.on('error', (e) => { if (!done) { done = true; resolve({ ok: false, error: String(e) }); } });
    sock.on('timeout', () => { if (!done) { done = true; resolve({ ok: false, error: 'timeout' }); sock.destroy(); } });
    sock.connect(port, host);
  });
}

function parseDatabaseUrl(url) {
  try {
    // support postgres:// and postgresql://
    if (!url) return null;
    let u = url;
    if (u.startsWith('postgres://') || u.startsWith('postgresql://')) {
      const parsed = new URL(u);
      return { host: parsed.hostname, port: parseInt(parsed.port || '5432', 10) };
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function run() {
  console.log('Phase 0 smoke tests — starting');
  const results = [];

  for (const e of endpoints) {
    const url = e.url.replace(/\/$/, '');
    process.stdout.write(`Checking ${e.name} at ${url} ... `);
    const r = await httpGet(url);
    if (r.ok) {
      console.log('OK');
    } else {
      console.log('FAIL', r.status || r.error);
    }
    results.push({ type: 'http', name: e.name, url, result: r });
  }

  // Check Postgres TCP
  let dbHost = env.DATABASE_HOST || null;
  let dbPort = env.DATABASE_PORT || null;
  if (!dbHost && env.DATABASE_URL) {
    const parsed = parseDatabaseUrl(env.DATABASE_URL);
    if (parsed) {
      dbHost = parsed.host;
      dbPort = parsed.port;
    }
  }
  dbHost = dbHost || 'localhost';
  dbPort = dbPort || 5432;

  process.stdout.write(`Checking Postgres at ${dbHost}:${dbPort} ... `);
  const pg = await tcpConnect(dbHost, dbPort);
  if (pg.ok) console.log('OK'); else console.log('FAIL', pg.error);
  results.push({ type: 'tcp', name: 'Postgres', host: dbHost, port: dbPort, result: pg });

  const failures = results.filter(r => !r.result.ok);
  console.log('\nSummary:');
  for (const r of results) {
    if (r.type === 'http') {
      console.log(`- ${r.name}: ${r.result.ok ? 'OK' : `FAIL (${r.result.status || r.result.error})`}`);
    } else {
      console.log(`- ${r.name}: ${r.result.ok ? 'OK' : `FAIL (${r.result.error})`}`);
    }
  }

  if (failures.length) {
    console.error('\nOne or more checks failed. See above for details.');
    process.exit(2);
  } else {
    console.log('\nAll checks passed.');
    process.exit(0);
  }
}

run();
