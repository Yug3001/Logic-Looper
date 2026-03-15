const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ executablePath: "C:\\\\Program Files\\\\BraveSoftware\\\\Brave-Browser\\\\Application\\\\brave.exe", headless: "new" });
  const page = await browser.newPage();
  
  const logs = [];
  page.on('console', msg => logs.push('LOG: ' + msg.text()));
  page.on('pageerror', err => logs.push('ERROR: ' + err.message));
  
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  
  // click analytics button directly
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.nav-item'));
    for(let b of buttons) {
      if(b.textContent && b.textContent.includes('Analytics')) {
         console.log('CLICKING ANALYTICS BUTTON');
         b.click();
         return;
      }
    }
    console.log('DID NOT FIND ANALYTICS BUTTON');
  });

  await new Promise(r => setTimeout(r, 2000));
  console.log(logs.join('\n'));
  await browser.close();
})();
