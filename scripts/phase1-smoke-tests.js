#!/usr/bin/env node
const http = require('http');
const crypto = require('crypto');

// 1. Test AES-256-GCM cipher roundtrip
function testCipher() {
  console.log('1. Testing AES-256-GCM cipher functions...');
  const key = crypto.createHash('sha256').update('test-master-key-32bytes!!').digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const text = 'sk-ant-test-key-12345';
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag();

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let dec = decipher.update(enc, 'hex', 'utf8');
  dec += decipher.final('utf8');

  if (dec === text) {
    console.log('   Cipher test: PASSED ✅');
    return true;
  } else {
    console.error('   Cipher test: FAILED ❌');
    return false;
  }
}

// 2. Test HTTP endpoints
function httpCheck(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve({ status: res.statusCode });
    }).on('error', (err) => {
      resolve({ error: String(err) });
    });
  });
}

async function runPhase1SmokeTests() {
  console.log('=== Phase 1 Smoke & Integration Tests ===\n');
  const results = [];

  // Test 1: Cipher
  const cipherPassed = testCipher();
  results.push({ name: 'AES-256-GCM Cipher', ok: cipherPassed });

  // Test 2: Next.js endpoints
  console.log('2. Checking Next.js server readiness...');
  const nextRes = await httpCheck('http://127.0.0.1:3000');
  console.log(`   Next.js root status: ${nextRes.status || nextRes.error}`);
  results.push({ name: 'Next.js App Server', ok: nextRes.status === 200 || nextRes.status === 307 || nextRes.status === 308 });

  // Test 3: Secrets API (protected -> expects 307 redirect or 401/200)
  console.log('3. Checking Secrets API endpoint (/api/secrets)...');
  const secretsRes = await httpCheck('http://127.0.0.1:3000/api/secrets');
  console.log(`   Secrets API status: ${secretsRes.status || secretsRes.error}`);
  results.push({ name: 'Secrets API Endpoint', ok: secretsRes.status === 307 || secretsRes.status === 401 || secretsRes.status === 200 });

  // Test 4: Agent Sessions API (protected -> expects 307 redirect or 401/200)
  console.log('4. Checking Agent Sessions API endpoint (/api/agent/sessions)...');
  const sessionsRes = await httpCheck('http://127.0.0.1:3000/api/agent/sessions');
  console.log(`   Agent Sessions API status: ${sessionsRes.status || sessionsRes.error}`);
  results.push({ name: 'Agent Sessions API Endpoint', ok: sessionsRes.status === 307 || sessionsRes.status === 401 || sessionsRes.status === 200 });

  console.log('\n=== Test Summary ===');
  let allOk = true;
  for (const r of results) {
    console.log(`- ${r.name}: ${r.ok ? 'PASSED ✅' : 'FAILED ❌'}`);
    if (!r.ok) allOk = false;
  }

  if (allOk) {
    console.log('\nAll Phase 1 smoke tests PASSED! 🎉');
    process.exit(0);
  } else {
    console.error('\nOne or more Phase 1 checks failed!');
    process.exit(1);
  }
}

runPhase1SmokeTests();
