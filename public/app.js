// Register service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

let updateInterval;

async function fetchData() {
    try {
        const [balanceResponse, statusResponse] = await Promise.all([
            fetch('/api/balance'),
            fetch('/api/status')
        ]);
        
        const balance = await balanceResponse.json();
        const status = await statusResponse.json();
        
        updateDisplay(balance, status);
    } catch (error) {
        console.error('Error fetching data:', error);
        showError('Failed to fetch data');
    }
}

function updateDisplay(data, status) {
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
                daysEl.style.color = 'var(--text-primary)';
            }
        } else {
            daysEl.textContent = '--';
        }
        
        if (data.lastUpdated) {
            const date = new Date(data.lastUpdated);
            lastUpdatedEl.textContent = formatDateTime(date);
        }
    }
    
    if (status.nextRun) {
        const nextDate = new Date(status.nextRun);
        nextUpdateEl.textContent = formatDateTime(nextDate);
        
        updateCountdown(nextDate);
    }
}

function formatDateTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1 && diffMs > 0) {
        return 'Just now';
    } else if (diffMins < 60 && diffMs > 0) {
        return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleString();
    }
}

function updateCountdown(nextDate) {
    const countdownEl = document.getElementById('nextUpdate');
    
    clearInterval(updateInterval);
    updateInterval = setInterval(() => {
        const now = new Date();
        const diffMs = nextDate - now;
        
        if (diffMs <= 0) {
            countdownEl.textContent = 'Updating...';
            clearInterval(updateInterval);
            fetchData();
        } else {
            const diffMins = Math.floor(diffMs / 60000);
            const diffSecs = Math.floor((diffMs % 60000) / 1000);
            
            if (diffMins > 0) {
                countdownEl.textContent = `${diffMins}m ${diffSecs}s`;
            } else {
                countdownEl.textContent = `${diffSecs}s`;
            }
        }
    }, 1000);
}

function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.classList.add('show');
}

function refreshData() {
    const btn = document.querySelector('.refresh-btn');
    btn.disabled = true;
    btn.style.opacity = '0.5';
    
    fetchData().finally(() => {
        btn.disabled = false;
        btn.style.opacity = '1';
    });
}

fetchData();
setInterval(fetchData, 60000);

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
        console.log('Service worker registration failed:', err);
    });
}