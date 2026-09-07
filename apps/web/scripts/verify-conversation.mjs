import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const SCREENSHOT_DIR = '/private/tmp/claude-501/-Users-junayedahmed-Documents-work-immersive-automation/3ce08325-201f-4492-ba86-3c7996ade21b/scratchpad';
const moreInfoUrl = fs.readFileSync('/tmp/moreinfo_url.txt', 'utf8').trim();

const errors = [];
function attach(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[${label}] console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[${label}] pageerror: ${err.message}`));
}

async function main() {
  const browser = await chromium.launch();

  // --- Client side: visit the real link, submit an inquiry ---
  const clientPage = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  attach(clientPage, 'client');

  await clientPage.goto(moreInfoUrl);
  await clientPage.waitForTimeout(500);
  const listingPageText = await clientPage.textContent('body');
  console.log('LISTING_PAGE_HAS_REALTOR_CARD:', listingPageText.includes('Sarah Chen') && listingPageText.includes('Elmhurst Realty Group'));
  console.log('LISTING_PAGE_HAS_PREFILLED_MESSAGE:', (await clientPage.inputValue('#message')).includes("I'd like more information"));
  await clientPage.screenshot({ path: `${SCREENSHOT_DIR}/20-listing-page.png`, fullPage: true });

  await clientPage.fill('#message', 'Hi, is this still available? Can we schedule a showing?');
  await clientPage.click('button[type="submit"]:has-text("Send message")');
  await clientPage.waitForTimeout(600);
  const afterSubmitText = await clientPage.textContent('body');
  console.log('INQUIRY_CONFIRMATION_SHOWN:', afterSubmitText.includes('Message sent to'));
  await clientPage.screenshot({ path: `${SCREENSHOT_DIR}/21-listing-page-submitted.png`, fullPage: true });

  const threadLink = await clientPage.getAttribute('a:has-text("view the thread now")', 'href');
  console.log('THREAD_LINK_CAPTURED:', !!threadLink);

  // --- Realtor side: log in, see it in the inbox, reply ---
  const realtorPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  attach(realtorPage, 'realtor');
  await realtorPage.goto(`${BASE}/login`);
  await realtorPage.fill('#email', 'sarah.chen@example.com');
  await realtorPage.fill('#password', 'password123');
  await realtorPage.click('button[type="submit"]');
  await realtorPage.waitForURL(`${BASE}/dashboard`, { timeout: 5000 });

  await realtorPage.goto(`${BASE}/inbox`);
  await realtorPage.waitForTimeout(600);
  const inboxText = await realtorPage.textContent('body');
  console.log('INBOX_SHOWS_CLIENT:', inboxText.includes('Taylor Buyer'));
  await realtorPage.screenshot({ path: `${SCREENSHOT_DIR}/22-inbox-list.png`, fullPage: true });

  await realtorPage.click('text=Taylor Buyer');
  await realtorPage.waitForTimeout(500);
  const threadOpenText = await realtorPage.textContent('body');
  console.log('INBOX_THREAD_SHOWS_CLIENT_MESSAGE:', threadOpenText.includes('Can we schedule a showing'));
  await realtorPage.screenshot({ path: `${SCREENSHOT_DIR}/23-inbox-thread.png`, fullPage: true });

  await realtorPage.fill('input[placeholder="Type a reply…"]', 'Absolutely! How about this Saturday at 11am?');
  await realtorPage.click('button:has-text("Send")');
  await realtorPage.waitForTimeout(700);
  const afterReplyText = await realtorPage.textContent('body');
  console.log('INBOX_SHOWS_REALTOR_REPLY:', afterReplyText.includes('Saturday at 11am'));
  await realtorPage.screenshot({ path: `${SCREENSHOT_DIR}/24-inbox-after-reply.png`, fullPage: true });

  // --- Client side again: visit thread link, see the reply, reply back ---
  await clientPage.goto(threadLink);
  await clientPage.waitForTimeout(500);
  const threadPageText = await clientPage.textContent('body');
  console.log('THREAD_PAGE_SHOWS_REALTOR_REPLY:', threadPageText.includes('Saturday at 11am'));
  await clientPage.fill('input[placeholder="Type a reply…"]', 'Saturday at 11am works for me!');
  await clientPage.click('button:has-text("Send")');
  await clientPage.waitForTimeout(600);
  const clientThreadAfterReply = await clientPage.textContent('body');
  console.log('CLIENT_SECOND_REPLY_VISIBLE:', clientThreadAfterReply.includes('works for me'));
  await clientPage.screenshot({ path: `${SCREENSHOT_DIR}/25-client-thread-final.png`, fullPage: true });

  await browser.close();

  console.log('---ERRORS---');
  console.log(errors.length === 0 ? 'none' : errors.join('\n'));
}

main().catch((err) => {
  console.error('SCRIPT_FAILED:', err);
  process.exit(1);
});
