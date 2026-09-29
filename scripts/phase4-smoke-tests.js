#!/usr/bin/env node
const http = require('http');

function httpGet(url, timeout = 5000) {
  return new Promise((resolve) => {
    try {
      const req = http.get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      });
      req.on('error', (err) => resolve({ error: String(err) }));
      req.setTimeout(timeout, () => {
        req.destroy();
        resolve({ error: 'timeout' });
      });
    } catch (err) {
      resolve({ error: String(err) });
    }
  });
}

async function runPhase4SmokeTests() {
  console.log('=== Phase 4 Observability & Telemetry Smoke Tests ===\n');
  const results = [];

  // Test 1: Next.js Metrics Endpoint (/api/metrics)
  console.log('1. Checking Next.js Prometheus Metrics Endpoint (/api/metrics)...');
  const metricsRes = await httpGet('http://127.0.0.1:3000/api/metrics');
  console.log(`   Metrics Endpoint status: ${metricsRes.status || metricsRes.error}`);
  
  const okMetrics = metricsRes.status === 200 || metricsRes.status === 307;
  console.log(`   Metrics Endpoint: ${okMetrics ? 'PASSED ✅' : 'FAILED ❌'}`);
  results.push({ name: 'Prometheus Metrics API (/api/metrics)', ok: okMetrics });

  // Test 2: Prometheus Server
  console.log('2. Checking Prometheus Server readiness (http://127.0.0.1:9090)...');
  const promRes = await httpGet('http://127.0.0.1:9090/-/healthy');
  console.log(`   Prometheus health status: ${promRes.status || promRes.error}`);
  results.push({ name: 'Prometheus Server', ok: promRes.status === 200 });

  // Test 3: Grafana Server
  console.log('3. Checking Grafana Dashboard Server readiness (http://127.0.0.1:3001)...');
  const grafanaRes = await httpGet('http://127.0.0.1:3001/api/health');
  console.log(`   Grafana health status: ${grafanaRes.status || grafanaRes.error}`);
  results.push({ name: 'Grafana Dashboard Server', ok: grafanaRes.status === 200 });

  console.log('\n=== Test Summary ===');
  let allOk = true;
  for (const r of results) {
    console.log(`- ${r.name}: ${r.ok ? 'PASSED ✅' : 'FAILED ❌'}`);
    if (!r.ok) allOk = false;
  }

  if (allOk) {
    console.log('\nAll Phase 4 smoke tests PASSED! 🎉');
    process.exit(0);
  } else {
    console.error('\nOne or more Phase 4 checks failed!');
    process.exit(1);
  }
}

runPhase4SmokeTests();

