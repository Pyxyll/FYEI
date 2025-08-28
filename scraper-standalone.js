import puppeteer from 'puppeteer';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function scrapeBalance() {
  let browser;
  
  try {
    console.log('Starting balance scrape...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote'
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });

    const loginUrl = process.env.PROVIDER_LOGIN_URL;
    console.log(`Navigating to: ${loginUrl}`);
    
    await page.goto(loginUrl, { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });

    // Login
    console.log('Logging in...');
    
    // Find and fill username
    const usernameSelectors = [
      'input[type="email"]',
      'input[type="text"][name="username"]',
      'input#username',
      'input[name="email"]'
    ];
    
    let usernameField = null;
    for (const selector of usernameSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        usernameField = selector;
        break;
      } catch (e) {
        continue;
      }
    }
    
    if (!usernameField) throw new Error('Username field not found');
    
    await page.click(usernameField, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(usernameField, process.env.ELECTRICITY_USERNAME, { delay: 100 });
    
    // Find and fill password
    const passwordField = 'input[type="password"]';
    await page.waitForSelector(passwordField, { timeout: 5000 });
    await page.click(passwordField, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(passwordField, process.env.ELECTRICITY_PASSWORD, { delay: 100 });
    
    // Submit
    await new Promise(resolve => setTimeout(resolve, 1000));
    const submitButton = await page.$('button[type="submit"]') || await page.$('input[type="submit"]');
    await Promise.all([
      submitButton.click(),
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 })
    ]);
    
    // Wait for dashboard
    console.log('Waiting for dashboard...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Debug: Check current page
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);
    
    // Debug: Take screenshot for troubleshooting
    try {
      await page.screenshot({ path: 'debug-dashboard.png', fullPage: true });
      console.log('Debug screenshot saved');
    } catch (e) {
      console.log('Could not save screenshot:', e.message);
    }
    
    // Debug: List all elements with 'balance' in ID or class
    const balanceElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements
        .filter(el => el.id.toLowerCase().includes('balance') || el.className.toLowerCase().includes('balance'))
        .map(el => ({ 
          tag: el.tagName, 
          id: el.id, 
          className: el.className, 
          text: el.textContent.trim().substring(0, 50) 
        }));
    });
    console.log('Elements with "balance":', JSON.stringify(balanceElements, null, 2));
    
    // Try multiple balance selectors
    const balanceSelectors = [
      '#prepayBalanceAmt',
      '.prepay-balance',
      '.balance-amount',
      '.current-balance',
      '[data-testid="balance"]',
      '*[id*="balance" i]',
      '*[class*="balance" i]'
    ];
    
    let balanceSelector = null;
    for (const selector of balanceSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        balanceSelector = selector;
        console.log(`Found balance element with selector: ${selector}`);
        break;
      } catch (e) {
        console.log(`Selector failed: ${selector}`);
        continue;
      }
    }
    
    if (!balanceSelector) {
      throw new Error('Could not find balance element with any selector');
    }
    
    const balance = await page.$eval(balanceSelector, el => {
      const text = el.textContent.trim();
      const cleanText = text.replace(/[€\s]/g, '');
      const match = cleanText.match(/[\d.,]+/);
      return match ? parseFloat(match[0].replace(',', '.')) : null;
    });
    
    console.log(`Balance scraped: €${balance}`);
    
    // Try to get days remaining
    let daysRemaining = null;
    try {
      const daysText = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('small'));
        for (const el of elements) {
          if (el.textContent.includes('day')) {
            const match = el.textContent.match(/\d+/);
            return match ? parseInt(match[0]) : null;
          }
        }
        return null;
      });
      if (daysText) {
        daysRemaining = daysText;
        console.log(`Days remaining: ${daysRemaining}`);
      }
    } catch (e) {
      console.log('Days remaining not found');
    }
    
    // Save data
    const dataDir = join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const data = {
      balance,
      daysRemaining,
      lastUpdated: new Date().toISOString(),
      error: null
    };
    
    fs.writeFileSync(
      join(dataDir, 'balance.json'),
      JSON.stringify(data, null, 2)
    );
    
    console.log('Data saved successfully');
    
  } catch (error) {
    console.error('Scraping error:', error);
    
    // Save error state
    const dataDir = join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const errorData = {
      balance: null,
      daysRemaining: null,
      lastUpdated: new Date().toISOString(),
      error: error.message
    };
    
    fs.writeFileSync(
      join(dataDir, 'balance.json'),
      JSON.stringify(errorData, null, 2)
    );
    
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the scraper
scrapeBalance();