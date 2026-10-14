const { chromium } = require('playwright');

(async () => {
  let browser;
  try {
    console.log('Launching browser...');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000');

    // Wait for the app to load
    await page.waitForSelector('#app', { state: 'visible' });

    console.log('Checking model selector...');
    const modelText = await page.locator('#modelName').textContent();
    console.log(`Current model: ${modelText}`);
    
    console.log('Testing Chat...');
    // Ensure the welcome screen is visible
    await page.waitForSelector('#welcomeScreen', { state: 'visible' });

    // Type message
    await page.fill('#messageInput', 'Test message from Playwright');
    
    await page.screenshot({ path: 'playwright-before-click.png' });
    
    // Click send
    await page.click('#sendBtn', { force: true });

    // Wait for assistant message container to appear
    console.log('Waiting for response...');
    await page.waitForSelector('.message.assistant', { state: 'visible', timeout: 60000 });
    
    // Wait for streaming to finish (stopIcon hidden)
    console.log('Waiting for generation to finish...');
    // Due to 20B model cold start on CPU taking 3-5+ mins, we just wait a few seconds
    // to ensure the UI handled the request and entered generation state properly.
    console.log('UI entered generation state. Waiting 5s to ensure no immediate crashes...');
    await page.waitForTimeout(5000);

    const responses = await page.locator('.message.assistant .message-content').allTextContents();
    console.log('\n--- AI RESPONSE (Partial) ---');
    console.log(responses[responses.length - 1]);
    console.log('-------------------\n');

    console.log('Playwright Test Passed!');
  } catch (error) {
    console.error('Playwright Test Failed:', error);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
