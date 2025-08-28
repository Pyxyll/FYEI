# Electricity Balance Monitor

A PWA that automatically tracks your Electric Ireland prepaid electricity balance using GitHub Actions for scraping and Vercel for hosting.

## Features
- 🔄 Automatic balance scraping every 30 minutes
- 📱 Progressive Web App - installable on any device
- 💰 Shows current balance and days remaining
- 🔒 Secure credential storage via GitHub Secrets
- 🆓 Completely free hosting

## Setup Instructions

### 1. Fork/Clone this repository

### 2. Configure GitHub Secrets
Go to Settings → Secrets → Actions and add:
- `ELECTRICITY_USERNAME` - Your Electric Ireland email
- `ELECTRICITY_PASSWORD` - Your password (use quotes if it contains special characters)
- `PROVIDER_LOGIN_URL` - https://youraccountonline.electricireland.ie/

### 3. Deploy to Vercel
1. Sign up at [vercel.com](https://vercel.com)
2. Import this GitHub repository
3. Set root directory to `public`
4. Deploy!

### 4. Run Initial Scrape
Go to Actions tab → "Scrape Electricity Balance" → Run workflow

## How it Works
- GitHub Actions runs Puppeteer every 30 minutes to scrape your balance
- Data is saved to `data/balance.json` and committed
- Frontend hosted on Vercel fetches data from GitHub
- No server required - completely serverless architecture

## Local Development
```bash
# Install dependencies
npm install

# Run scraper locally (requires .env file)
npm run scrape
```

## Technologies
- GitHub Actions for automated scraping
- Puppeteer for web scraping
- Vercel for static hosting
- PWA for mobile app experience