const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:8080/');

  // Wait for the app to render the dashboard
  await page.waitForSelector('.stats-grid');

  // Extract values from the DOM
  const stats = await page.$$eval('.card.stat h3', els => els.map(el => el.textContent));
  const labels = await page.$$eval('.card.stat p', els => els.map(el => el.textContent));

  const statsMap = {};
  labels.forEach((label, i) => {
    statsMap[label.trim()] = stats[i].trim();
  });

  console.log('Rendered Dashboard Stats:', statsMap);

  // Verify that numbers are valid and not NaN/Undefined
  const moneyKeys = ['Rent due this month', 'Payments received', 'Deductions', 'Agent fees'];
  let allValid = true;
  for (const key of moneyKeys) {
    if (!statsMap[key] || statsMap[key] === '$NaN' || statsMap[key] === '$0.00' && key !== 'Agent fees') {
       console.log(`Issue with ${key}: ${statsMap[key]}`);
       allValid = false;
    }
  }

  if (allValid) {
    console.log('Success! Dashboard rendered totals correctly.');
  } else {
    console.log('Failed! Issue with dashboard totals.');
    process.exit(1);
  }

  await browser.close();
})();
