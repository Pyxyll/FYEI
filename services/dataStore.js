import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DataStore {
  constructor() {
    this.dataPath = join(__dirname, '..', 'data', 'balance.json');
    this.data = {
      balance: null,
      daysRemaining: null,
      lastUpdated: null,
      error: null
    };
    this.ensureDataDirectory();
    this.loadData();
  }

  ensureDataDirectory() {
    const dataDir = dirname(this.dataPath);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
  }

  loadData() {
    try {
      if (existsSync(this.dataPath)) {
        const rawData = readFileSync(this.dataPath, 'utf-8');
        this.data = JSON.parse(rawData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  saveData() {
    try {
      writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  updateBalance(balance, daysRemaining) {
    this.data = {
      balance,
      daysRemaining,
      lastUpdated: new Date().toISOString(),
      error: null
    };
    this.saveData();
  }

  setError(error) {
    this.data.error = error;
    this.data.lastUpdated = new Date().toISOString();
    this.saveData();
  }

  getData() {
    return this.data;
  }
}