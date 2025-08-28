// Static version that reads from GitHub
const GITHUB_USER = 'Pyxyl'; // Your GitHub username
const GITHUB_REPO = 'FYEI'; // Your repo name
const DATA_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/data/balance.json`;

// Register service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

async function fetchData() {
    try {
        const response = await fetch(DATA_URL);
        const data = await response.json();
        updateDisplay(data);
    } catch (error) {
        console.error('Error fetching data:', error);
        showError('Failed to fetch data');
    }
}

function updateDisplay(data) {
    const balanceEl = document.getElementById('balance');
    const daysEl = document.getElementById('days');
    const lastUpdatedEl = document.getElementById('lastUpdated');
    const nextUpdateEl = document.getElementById('nextUpdate');
    const errorEl = document.getElementById('errorMessage');
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    if (data.error) {
        showError(data.error);
        statusDot.className = 'status-dot error';
        statusText.textContent = 'Error';
    } else {
        errorEl.classList.remove('show');
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Connected';
        
        if (data.balance !== null) {
            balanceEl.textContent = data.balance.toFixed(2);
        } else {
            balanceEl.textContent = '--';
        }
        
        if (data.daysRemaining !== null) {
            daysEl.textContent = data.daysRemaining;
            
            if (data.daysRemaining < 7) {
                daysEl.style.color = 'var(--accent-red)';
            } else if (data.daysRemaining < 14) {
                daysEl.style.color = 'var(--accent-yellow)';
            } else {
                daysEl.style.color = 'var(--accent-green)';
            }
        } else {
            daysEl.textContent = '--';
        }
        
        if (data.lastUpdated) {
            const lastUpdate = new Date(data.lastUpdated);
            lastUpdatedEl.textContent = lastUpdate.toLocaleString();
            
            // Calculate next update (every 30 minutes)
            const nextUpdate = new Date(lastUpdate.getTime() + 30 * 60000);
            nextUpdateEl.textContent = nextUpdate.toLocaleTimeString();
        }
    }
}

function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.classList.add('show');
}

function refreshData() {
    fetchData();
    showError(''); // Clear any existing errors
}

// Initial load
fetchData();

// Refresh every 5 minutes
setInterval(fetchData, 5 * 60 * 1000);