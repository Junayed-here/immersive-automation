import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const SCREENSHOT_DIR = '/private/tmp/claude-501/-Users-junayedahmed-Documents-work-immersive-automation/3ce08325-201f-4492-ba86-3c7996ade21b/scratchpad';

const errors = [];

function attachErrorListeners(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[${label}] console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[${label}] pageerror: ${err.message}`));
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  attachErrorListeners(page, 'nav');

  // 1. Login
  await page.goto(`${BASE}/login`);
  await page.fill('#email', 'sarah.chen@example.com');
  await page.fill('#password', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 5000 });
  await page.waitForTimeout(500);
  const dashboardText = await page.textContent('body');
  console.log('DASHBOARD_HAS_WELCOME:', dashboardText.includes('Welcome back'));
  console.log('DASHBOARD_HAS_STAT_LABELS:', dashboardText.includes('Clients') && dashboardText.includes('Automations'));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/01-dashboard.png`, fullPage: true });

  // 2. Clients page - add a client through the real UI
  await page.goto(`${BASE}/clients`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/02-clients-empty.png`, fullPage: true });
  await page.click('text=Add client');
  await page.waitForTimeout(200);
  await page.fill('#name', 'Playwright Test Client');
  await page.fill('#email', 'playwright.test@example.com');
  await page.fill('#zip', '11373');
  await page.fill('#bedrooms', '3');
  await page.fill('#familySize', '4');
  await page.click('button[type="submit"]:has-text("Add client")');
  await page.waitForTimeout(700);
  const clientsText = await page.textContent('body');
  console.log('CLIENT_ADDED_VISIBLE:', clientsText.includes('Playwright Test Client'));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/03-clients-added.png`, fullPage: true });

  // 3. Integrations page
  await page.goto(`${BASE}/integrations`);
  await page.waitForTimeout(500);
  const integrationsText = await page.textContent('body');
  console.log('INTEGRATIONS_RENDERED:', integrationsText.includes('Connect a Google Sheet'));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/04-integrations.png`, fullPage: true });

  // 4. Automations list (empty state expected)
  await page.goto(`${BASE}/automations`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/05-automations-empty.png`, fullPage: true });

  // 5. Wizard: create an automation end to end
  await page.goto(`${BASE}/automations/new`);
  await page.waitForTimeout(300);
  await page.fill('#name', 'Playwright Digest');
  await page.click('button[type="submit"]:has-text("Next")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/06-wizard-step2.png`, fullPage: true });

  await page.click('text=All active clients');
  await page.click('button:has-text("Next: Match rules")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/07-wizard-step3.png`, fullPage: true });

  await page.click('button:has-text("Preview matches")');
  await page.waitForTimeout(1200);
  const step3Text = await page.textContent('body');
  console.log('PREVIEW_MATCHES_SHOWN:', step3Text.includes('Matches'));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/08-wizard-step3-preview.png`, fullPage: true });

  await page.click('button:has-text("Next: Email template")');
  await page.waitForTimeout(600);
  await page.click('button:has-text("Refresh preview")');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/09-wizard-step4-preview.png`, fullPage: true });

  await page.click('button:has-text("Save & activate")');
  await page.waitForTimeout(800);
  const detailUrl = page.url();
  console.log('REDIRECTED_TO_DETAIL:', /\/automations\/[a-f0-9]+$/.test(detailUrl));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/10-automation-detail.png`, fullPage: true });

  // 6. Run it for real, then view the run + email
  await page.click('button:has-text("Run now")');
  await page.waitForTimeout(1500);
  const afterRunText = await page.textContent('body');
  console.log('RUN_MESSAGE_SHOWN:', afterRunText.includes('Run complete'));
  await page.click('text=/^\\d{1,2}\\/\\d{1,2}\\/\\d{4}/').catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/11-run-detail.png`, fullPage: true });

  const viewEmailButton = await page.$('text=View email');
  if (viewEmailButton) {
    await viewEmailButton.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/12-email-viewer.png`, fullPage: true });
  }
  console.log('VIEW_EMAIL_BUTTON_PRESENT:', !!viewEmailButton);

  await browser.close();

  console.log('---ERRORS---');
  if (errors.length === 0) {
    console.log('none');
  } else {
    errors.forEach((e) => console.log(e));
  }
}

main().catch((err) => {
  console.error('SCRIPT_FAILED:', err);
  process.exit(1);
});
