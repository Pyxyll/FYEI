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
    
    console.log('Filled credentials, looking for submit button...');
    
    // Find submit button with better debugging
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button[class*="submit"]',
      'button[class*="login"]',
      'button[class*="sign-in"]',
      '.login-button',
      '#login-button'
    ];
    
    let submitButton = null;
    for (const selector of submitSelectors) {
      const element = await page.$(selector);
      if (element) {
        submitButton = element;
        console.log(`Found submit button: ${selector}`);
        break;
      } else {
        console.log(`Submit selector failed: ${selector}`);
      }
    }
    
    if (!submitButton) {
      console.log('No submit button found, checking all buttons...');
      const buttons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button, input[type="submit"]')).map(btn => ({
          tag: btn.tagName,
          type: btn.type,
          id: btn.id,
          className: btn.className,
          text: btn.textContent.trim()
        }));
      });
      console.log('Available buttons:', JSON.stringify(buttons, null, 2));
      throw new Error('No submit button found');
    }
    
    // Submit
    console.log('Clicking submit button...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      await Promise.all([
        submitButton.click(),
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 })
      ]);
      console.log('Login submitted successfully');
    } catch (navError) {
      console.log('Navigation after login failed:', navError.message);
      console.log('Current URL after submit:', page.url());
      // Continue anyway - might still be logged in
    }
    
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
    
    // Check for specific login error messages
    const loginErrors = await page.evaluate(() => {
      // Look for common error message containers
      const errorSelectors = [
        '.error-message',
        '.alert-danger', 
        '.validation-error',
        '[class*="error"]',
        '[id*="error"]'
      ];
      
      const errors = [];
      
      for (const selector of errorSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.textContent.trim();
          if (text && text.length < 200) { // Avoid CSS/JS content
            errors.push(text);
          }
        });
      }
      
      // Also check for specific error text in visible elements
      const allVisible = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      
      allVisible.forEach(el => {
        const text = el.textContent.trim().toLowerCase();
        if ((text.includes('incorrect password') || 
             text.includes('invalid credentials') || 
             text.includes('login failed') ||
             text.includes('wrong username')) && text.length < 100) {
          errors.push(el.textContent.trim());
        }
      });
      
      return [...new Set(errors)]; // Remove duplicates
    });
    
    if (loginErrors.length > 0) {
      console.log('Specific login errors found:', loginErrors);
    }
    
    // Since we're still on login page, the credentials might be wrong
    if (pageTitle.includes('Login') || currentUrl.includes('login')) {
      console.log('Still on login page - login likely failed');
      
      // Debug what's in the form fields
      const fieldValues = await page.evaluate(() => {
        const usernameField = document.querySelector('input[type="email"], input[name="email"], input[name="username"]');
        const passwordField = document.querySelector('input[type="password"]');
        
        return {
          usernameValue: usernameField ? usernameField.value.substring(0, 5) + '...' : 'not found',
          usernameLength: usernameField ? usernameField.value.length : 0,
          passwordLength: passwordField ? passwordField.value.length : 0,
          passwordExists: !!passwordField?.value
        };
      });
      
      console.log('Form field values:', fieldValues);
      console.log('Environment username length:', process.env.ELECTRICITY_USERNAME?.length || 0);
      console.log('Environment password length:', process.env.ELECTRICITY_PASSWORD?.length || 0);
      
      if (loginErrors.length > 0) {
        throw new Error(`Login failed with errors: ${loginErrors.join('; ')}`);
      } else {
        throw new Error('Login failed - still on login page (no specific error found)');
      }
    }
    
    // Debug: List all elements with 'balance' in ID or class (only if not on login page)
    const balanceElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements
        .filter(el => {
          try {
            const id = el.id ? String(el.id).toLowerCase() : '';
            const className = el.className ? String(el.className).toLowerCase() : '';
            return id.includes('balance') || className.includes('balance');
          } catch (e) {
            return false;
          }
        })
        .map(el => ({ 
          tag: el.tagName, 
          id: el.id ? String(el.id) : '', 
          className: el.className ? String(el.className) : '', 
          text: el.textContent ? String(el.textContent).trim().substring(0, 50) : ''
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