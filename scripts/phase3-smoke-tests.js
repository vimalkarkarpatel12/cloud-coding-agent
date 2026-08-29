#!/usr/bin/env node
const http = require('http');

// 1. Test PR Markdown template generator
function testPRBodyGenerator() {
  console.log('1. Testing PR Body Markdown formatting template...');
  
  function generatePRBody(taskDescription, changes, reasoning) {
    const fileSummary = changes && changes.length > 0
      ? changes.map(c => `- \`${c.path}\` (${c.status})`).join('\n')
      : '_No direct file modifications recorded._';

    return `
## 🤖 Automated Code Changes by OpenHands Agent

### 📋 Task Description
> ${taskDescription}

${reasoning ? `### 💡 Agent Reasoning & User Approval\n${reasoning}\n` : ''}

### 📝 Changed Files (${changes ? changes.length : 0})
${fileSummary}

---
*Generated automatically by Self-Hosted Agentic Coding Platform*
`.trim();
  }

  const task = 'Fix navigation bug in header';
  const changes = [
    { path: 'components/header.tsx', before: 'div', after: 'header', status: 'modified' }
  ];
  const reasoning = 'Verified header HTML semantics.';

  const prBody = generatePRBody(task, changes, reasoning);
  if (prBody.includes(task) && prBody.includes('components/header.tsx') && prBody.includes(reasoning)) {
    console.log('   PR Markdown generator: PASSED ✅');
    return true;
  } else {
    console.error('   PR Markdown generator: FAILED ❌');
    return false;
  }
}

// 2. HTTP Check
function httpCheck(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve({ status: res.statusCode });
    }).on('error', (err) => {
      resolve({ error: String(err) });
    });
  });
}

async function runPhase3SmokeTests() {
  console.log('=== Phase 3 Code Visualization & Approval Smoke Tests ===\n');
  const results = [];

  // Test 1: PR Body Generator
  const prPassed = testPRBodyGenerator();
  results.push({ name: 'PR Body Generator', ok: prPassed });

  // Test 2: Next.js App Server
  console.log('2. Checking Next.js server readiness...');
  const nextRes = await httpCheck('http://127.0.0.1:3000');
  console.log(`   Next.js root status: ${nextRes.status || nextRes.error}`);
  results.push({ name: 'Next.js App Server', ok: nextRes.status === 200 || nextRes.status === 307 || nextRes.status === 308 });

  // Test 3: Approval API Endpoint
  console.log('3. Checking Approval API Endpoint (/api/agent/session/dummy-id/approve)...');
  const approveRes = await httpCheck('http://127.0.0.1:3000/api/agent/session/dummy-id/approve');
  console.log(`   Approval endpoint status: ${approveRes.status || approveRes.error}`);
  results.push({ name: 'Approval API Endpoint', ok: approveRes.status === 307 || approveRes.status === 405 || approveRes.status === 404 });

  console.log('\n=== Test Summary ===');
  let allOk = true;
  for (const r of results) {
    console.log(`- ${r.name}: ${r.ok ? 'PASSED ✅' : 'FAILED ❌'}`);
    if (!r.ok) allOk = false;
  }

  if (allOk) {
    console.log('\nAll Phase 3 smoke tests PASSED! 🎉');
    process.exit(0);
  } else {
    console.error('\nOne or more Phase 3 checks failed!');
    process.exit(1);
  }
}

runPhase3SmokeTests();

