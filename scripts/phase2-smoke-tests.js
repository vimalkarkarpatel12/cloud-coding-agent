#!/usr/bin/env node
const http = require('http');
const net = require('net');

function tcpCheck(host, port, timeout = 3000) {
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
    sock.on('error', (e) => {
      if (!done) {
        done = true;
        resolve({ ok: false, error: String(e) });
      }
    });
    sock.on('timeout', () => {
      if (!done) {
        done = true;
        sock.destroy();
        resolve({ ok: false, error: 'timeout' });
      }
    });
    sock.connect(port, host);
  });
}

function httpCheck(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve({ status: res.statusCode });
    }).on('error', (err) => {
      resolve({ error: String(err) });
    });
  });
}

async function runPhase2SmokeTests() {
  console.log('=== Phase 2 Reliability & Queueing Smoke Tests ===\n');
  const results = [];

  // Test 1: Redis TCP Connection
  console.log('1. Checking Redis Queue TCP connectivity (127.0.0.1:6379)...');
  const redisRes = await tcpCheck('127.0.0.1', 6379);
  console.log(`   Redis connection: ${redisRes.ok ? 'OK' : `FAIL (${redisRes.error})`}`);
  results.push({ name: 'Redis Queue Service', ok: redisRes.ok });

  // Test 2: Next.js App Server
  console.log('2. Checking Next.js server readiness...');
  const nextRes = await httpCheck('http://127.0.0.1:3000');
  console.log(`   Next.js root status: ${nextRes.status || nextRes.error}`);
  results.push({ name: 'Next.js App Server', ok: nextRes.status === 200 || nextRes.status === 307 || nextRes.status === 308 });

  // Test 3: Agent Session GET endpoint
  console.log('3. Checking Agent Session Detail Endpoint (/api/agent/session/dummy-id)...');
  const sessionRes = await httpCheck('http://127.0.0.1:3000/api/agent/session/dummy-id');
  console.log(`   Session detail status: ${sessionRes.status || sessionRes.error}`);
  results.push({ name: 'Agent Session Detail Endpoint', ok: sessionRes.status === 307 || sessionRes.status === 404 });

  console.log('\n=== Test Summary ===');
  let allOk = true;
  for (const r of results) {
    console.log(`- ${r.name}: ${r.ok ? 'PASSED ✅' : 'FAILED ❌'}`);
    if (!r.ok) allOk = false;
  }

  if (allOk) {
    console.log('\nAll Phase 2 smoke tests PASSED! 🎉');
    process.exit(0);
  } else {
    console.error('\nOne or more Phase 2 checks failed!');
    process.exit(1);
  }
}

runPhase2SmokeTests();

