import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { ScraperService } from './services/scraper.js';
import { DataStore } from './services/dataStore.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      manifestSrc: ["'self'"]
    }
  }
}));
app.use(compression());
app.use(express.static(join(__dirname, 'public')));
app.use(express.json());

const dataStore = new DataStore();
const scraper = new ScraperService(dataStore);

app.get('/api/balance', (req, res) => {
  const data = dataStore.getData();
  res.json(data);
});

app.get('/api/status', (req, res) => {
  const status = scraper.getStatus();
  res.json(status);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Electricity Monitor running on http://0.0.0.0:${PORT}`);
  
  // Start scraper with error handling to prevent crash loops
  const startScraper = async () => {
    try {
      await scraper.start();
      console.log('Scraper service started successfully');
    } catch (err) {
      console.error('Failed to start scraper:', err.message);
      console.log('Server will continue running without scraper');
      // Server continues to run even if scraper fails
    }
  };
  
  // Delay scraper start to ensure server is fully initialized
  const startupDelay = process.env.NODE_ENV === 'production' ? 10000 : 2000;
  console.log(`Starting scraper in ${startupDelay/1000} seconds...`);
  setTimeout(startScraper, startupDelay);
});