const fs = require('fs');
const { chromium } = require('playwright');

async function run() {
  const report = { start: new Date().toISOString(), steps: [], console: [], errors: [], requestsFailed: [] };

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', m => report.console.push({type: m.type(), text: m.text()}));
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('requestfailed', r => report.requestsFailed.push({url: r.url(), err: r.failure()?.errorText}));

  // Jimpitan: open and perform mock submit
  await page.goto('http://127.0.0.1:3000/jimpitan/index.html', { waitUntil: 'networkidle' });
  report.steps.push('Opened jimpitan page');

  // Intercept Apps Script calls and respond with success mock
  await page.route('**script.google.com/**', async route => {
    const req = route.request();
    const post = req.postData();
    report.steps.push('Intercepted call to ' + req.url());
    report.steps.push('Captured payload: ' + (post ? post.slice(0, 200) : ''));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });

  // Ensure admin mode
  await page.evaluate(() => localStorage.setItem('bn2-isAdmin', 'true'));
  await page.reload({ waitUntil: 'networkidle' });
  report.steps.push('Enabled admin via localStorage and reloaded');

  // Open add modal and fill form via DOM (no visibility wait)
  await page.evaluate(() => {
    const btn = document.querySelector('#addDataBtn');
    if (btn) btn.click();
  });
  await page.waitForSelector('#entryForm', { timeout: 2000 });
  await page.evaluate(() => {
    const today = new Date().toISOString().split('T')[0];
    const dateEl = document.querySelector('#entryDate');
    const typeEl = document.querySelector('#entryType');
    const nomEl = document.querySelector('#entryNominal');
    const ketEl = document.querySelector('#entryKeterangan');
    if (dateEl) dateEl.value = today;
    if (typeEl) typeEl.value = 'JIMPITAN';
    if (nomEl) nomEl.value = '12345';
    if (ketEl) ketEl.value = 'Automated test';
  });
  report.steps.push('Filled jimpitan entry form');

  // Submit and wait for interception
  await Promise.all([
    page.waitForResponse(r => r.url().includes('script.google.com') && r.status() === 200, { timeout: 5000 }).catch(() => null),
    page.evaluate(() => {
      const f = document.querySelector('#entryForm');
      if (!f) return;
      if (typeof f.requestSubmit === 'function') f.requestSubmit();
      else f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    })
  ]);
  report.steps.push('Submitted jimpitan entry (mocked)');

  // Verify optimistic UI update
  await page.waitForTimeout(300);
  const found = await page.evaluate(() => document.body.innerText.includes('Automated test'));
  report.steps.push('Optimistic UI shows new entry: ' + (found ? 'yes' : 'no'));

  // Inventaris: open and capture counts
  const page2 = await context.newPage();
  await page2.goto('http://127.0.0.1:3000/inventaris/index.html', { waitUntil: 'networkidle' });
  report.steps.push('Opened inventaris page');
  await page2.waitForTimeout(800);
  const invCount = await page2.evaluate(() => document.getElementById('inventoryGrid') ? document.getElementById('inventoryGrid').children.length : 0);
  report.steps.push('Inventory items on page: ' + invCount);

  // Service worker registrations
  try {
    const swInfo = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { registered: false };
      const regs = await navigator.serviceWorker.getRegistrations();
      return { registered: regs.length > 0, count: regs.length };
    });
    report.steps.push('Service worker registrations: ' + JSON.stringify(swInfo));
  } catch (e) {
    report.errors.push('SW check failed: ' + e.message);
  }

  // finalize report
  report.end = new Date().toISOString();
  const markdown = [
    '# Automated Test Report',
    '',
    `Start: ${report.start}`,
    `End: ${report.end}`,
    '',
    '## Steps',
    '',
    report.steps.map(s => '- ' + s).join('\n'),
    '',
    '## Console (last 20)',
    '',
    '```json',
    JSON.stringify(report.console.slice(-20), null, 2),
    '```',
    '',
    '## Errors',
    '',
    '```json',
    JSON.stringify(report.errors.slice(-20), null, 2),
    '```',
    '',
    '## Failed Requests',
    '',
    '```json',
    JSON.stringify(report.requestsFailed.slice(-20), null, 2),
    '```'
  ].join('\n');

  fs.mkdirSync('tests', { recursive: true });
  fs.writeFileSync('tests/report.md', markdown, 'utf8');

  await browser.close();
  console.log('Automation finished — report written to tests/report.md');
}

run().catch(e => { console.error(e); process.exit(1); });
