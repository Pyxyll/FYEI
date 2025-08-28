# Electricity Monitor

A self-hosted web application to display your electricity balance and predicted days remaining on a Raspberry Pi or any device.

## Features

- **Secure Credentials**: Your electricity provider login credentials are stored only on your server
- **Auto-refresh**: Automatically scrapes balance data at configured intervals
- **PWA Support**: Install as a mobile app on phones/tablets
- **Responsive Design**: Works on any screen size
- **Docker Support**: Easy deployment on Raspberry Pi

## Setup

### 1. Configuration

Copy `.env.example` to `.env` and fill in your details:

```bash
cp .env.example .env
```

Edit `.env`:
```
ELECTRICITY_USERNAME=your_username
ELECTRICITY_PASSWORD=your_password
PROVIDER_LOGIN_URL=https://your-provider.com/login
SCRAPE_INTERVAL_MINUTES=30
```

### 2. Customize Scraper

Edit `services/scraper.js` to match your electricity provider's website:
- Update the login field selectors (lines 54-55)
- Update the submit button selector (line 58)
- Update balance/days selectors (lines 62-63)

### 3. Run with Docker (Recommended for Raspberry Pi)

```bash
docker-compose up -d
```

### 4. Run without Docker

```bash
npm install
npm start
```

## Access

- Open browser to `http://raspberry-pi-ip:3000`
- Install as PWA on mobile devices for app-like experience
- Share the URL with housemates (they won't see your credentials)

## Security Notes

- Credentials are only stored in `.env` file on your server
- Never commit `.env` to version control
- The web interface is read-only - no login required for viewing
- Consider using a VPN if accessing from outside your network

## Troubleshooting

- Check logs: `docker-compose logs -f`
- Ensure Raspberry Pi has enough RAM for Puppeteer
- Verify selectors match your provider's website structure