import puppeteer from 'puppeteer';
import cron from 'node-cron';

export class ScraperService {
  constructor(dataStore) {
    this.dataStore = dataStore;
    this.browser = null;
    this.isRunning = false;
    this.lastRun = null;
    this.nextRun = null;
    this.intervalMinutes = parseInt(process.env.SCRAPE_INTERVAL_MINUTES) || 30;
  }

  async start() {
    console.log('Starting scraper service...');
    
    // Delay initial scrape on production to let server fully start
    if (process.env.NODE_ENV === 'production') {
      console.log('Production environment detected, delaying initial scrape by 30 seconds...');
      setTimeout(() => this.scrapeBalance(), 30000);
    } else {
      await this.scrapeBalance();
    }
    
    const cronExpression = `*/${this.intervalMinutes} * * * *`;
    cron.schedule(cronExpression, async () => {
      await this.scrapeBalance();
    });
    
    this.updateNextRun();
  }

  updateNextRun() {
    const now = new Date();
    this.nextRun = new Date(now.getTime() + this.intervalMinutes * 60000);
  }

  async scrapeBalance() {
    if (this.isRunning) {
      console.log('Scrape already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    this.lastRun = new Date();
    
    // Wrap entire scraping process to prevent any crashes
    try {
      console.log('Starting balance scrape...');
      
      if (!process.env.ELECTRICITY_USERNAME || !process.env.ELECTRICITY_PASSWORD) {
        throw new Error('Missing credentials in .env file');
      }

      // Puppeteer launch options for different environments
      const launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--single-process',
          '--no-zygote'
        ]
      };

      // Use system Chrome on Render/production
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      }

      this.browser = await puppeteer.launch(launchOptions);

      const page = await this.browser.newPage();
      
      // Better user agent and viewport
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1366, height: 768 });
      
      // Add console logging from the page
      page.on('console', msg => console.log('PAGE LOG:', msg.text()));
      page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
      
      const loginUrl = process.env.PROVIDER_LOGIN_URL;
      if (!loginUrl) {
        throw new Error('PROVIDER_LOGIN_URL not set in .env file');
      }

      console.log(`Navigating to: ${loginUrl}`);
      
      try {
        await page.goto(loginUrl, { 
          waitUntil: 'domcontentloaded', 
          timeout: 60000 
        });
        console.log('Page loaded successfully');
        
        // Take a screenshot for debugging
        await page.screenshot({ path: 'debug-screenshot.png' });
        console.log('Screenshot saved to debug-screenshot.png');
        
      } catch (navError) {
        console.error('Navigation error details:', navError);
        // Try without waiting for idle
        await page.goto(loginUrl, { timeout: 60000 });
      }
      
      // Wait for login form to be ready
      console.log('Waiting for login form...');
      
      // Try multiple possible selectors for username field
      const usernameSelectors = [
        'input[type="email"]',
        'input[type="text"][name="username"]',
        'input#username',
        'input[name="email"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="username" i]'
      ];
      
      let usernameField = null;
      for (const selector of usernameSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          usernameField = selector;
          console.log(`Found username field: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!usernameField) {
        throw new Error('Could not find username/email input field');
      }
      
      // Clear field and type more reliably
      await page.click(usernameField, { clickCount: 3 }); // Triple click to select all
      await page.keyboard.press('Backspace'); // Clear any existing text
      await page.waitForTimeout(500); // Small delay
      
      // Try typing first
      try {
        await page.type(usernameField, process.env.ELECTRICITY_USERNAME, { delay: 100 });
      } catch (e) {
        console.log('Type failed, using evaluate method...');
        // Fallback: directly set the value
        await page.evaluate((selector, value) => {
          const element = document.querySelector(selector);
          if (element) {
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, usernameField, process.env.ELECTRICITY_USERNAME);
      }
      
      // Try multiple possible selectors for password field
      const passwordSelectors = [
        'input[type="password"]',
        'input#password',
        'input[name="password"]'
      ];
      
      let passwordField = null;
      for (const selector of passwordSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          passwordField = selector;
          console.log(`Found password field: ${selector}`);
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!passwordField) {
        throw new Error('Could not find password input field');
      }
      
      // Clear field and type more reliably
      await page.click(passwordField, { clickCount: 3 }); // Triple click to select all
      await page.keyboard.press('Backspace'); // Clear any existing text
      await page.waitForTimeout(500); // Small delay
      
      // Try typing first
      try {
        await page.type(passwordField, process.env.ELECTRICITY_PASSWORD, { delay: 100 });
      } catch (e) {
        console.log('Type failed, using evaluate method...');
        // Fallback: directly set the value
        await page.evaluate((selector, value) => {
          const element = document.querySelector(selector);
          if (element) {
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, passwordField, process.env.ELECTRICITY_PASSWORD);
      }
      
      // Wait a bit before submitting
      await page.waitForTimeout(1000);
      
      // Find and click submit button
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Sign in")',
        'button:has-text("Log in")',
        'button:has-text("Login")',
        '.login-button',
        '#login-button'
      ];
      
      let submitButton = null;
      for (const selector of submitSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            submitButton = selector;
            console.log(`Found submit button: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!submitButton) {
        throw new Error('Could not find submit button');
      }
      
      console.log('Clicking submit button...');
      await Promise.all([
        page.click(submitButton),
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 })
      ]);

      // Wait for dashboard to fully load
      console.log('Waiting for dashboard to load...');
      await page.waitForTimeout(3000); // Give the dashboard time to load
      
      // Electric Ireland specific selectors
      const balanceSelector = '#prepayBalanceAmt';
      const daysXPath = '//*[@id="Flows_AppFlows_Accounts_Components_AccountCardBillingDetails_AccountCardBillingDetails_08f62a7c-5575-4ff4-901c-ce7c53fc4322"]/div/div/div[2]/div[3]/div[1]/div/small';
      
      // Wait for balance element
      await page.waitForSelector(balanceSelector, { timeout: 15000 });
      console.log('Balance element found');
      
      // Get balance value
      const balance = await page.$eval(balanceSelector, el => {
        const text = el.textContent.trim();
        // Remove € symbol and any spaces, then parse
        const cleanText = text.replace(/[€\s]/g, '');
        const match = cleanText.match(/[\d.,]+/);
        return match ? parseFloat(match[0].replace(',', '.')) : null;
      });
      console.log(`Balance scraped: €${balance}`);

      // Get days remaining using XPath
      let daysRemaining = null;
      try {
        // Wait for the element using XPath
        await page.waitForXPath(daysXPath, { timeout: 5000 });
        
        const [daysElement] = await page.$x(daysXPath);
        if (daysElement) {
          daysRemaining = await page.evaluate(el => {
            const text = el.textContent.trim();
            const match = text.match(/\d+/);
            return match ? parseInt(match[0]) : null;
          }, daysElement);
          console.log(`Days remaining scraped: ${daysRemaining}`);
        }
      } catch (e) {
        console.log('Days remaining element not found, trying alternative selectors...');
        // Try a more general selector for days
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
            console.log(`Days remaining found via text search: ${daysRemaining}`);
          }
        } catch (e2) {
          console.log('Could not find days remaining');
        }
      }

      this.dataStore.updateBalance(balance, daysRemaining);
      console.log(`Balance updated: €${balance}, Days: ${daysRemaining || 'N/A'}`);

    } catch (error) {
      console.error('Scraping error:', error);
      this.dataStore.setError(error.message);
    } finally {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.isRunning = false;
      this.updateNextRun();
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextRun: this.nextRun,
      intervalMinutes: this.intervalMinutes
    };
  }
}