// Static version that reads from GitHub
const GITHUB_USER = 'Pyxyll'; // Your GitHub username (note the extra 'l')
const GITHUB_REPO = 'FYEI'; // Your repo name
const DATA_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/data/balance.json`;
const HISTORY_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/data/balance-history.json`;

let balanceChart = null;

// Register service worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

async function fetchData() {
    console.log('Fetching data from:', DATA_URL);
    try {
        const response = await fetch(DATA_URL);
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Data received:', data);
        updateDisplay(data);
        
        // Also fetch historical data for the chart
        fetchHistoricalData();
    } catch (error) {
        console.error('Error fetching data:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
        showError(`Failed to fetch data: ${error.message}`);
    }
}

async function fetchHistoricalData() {
    console.log('Fetching historical data from:', HISTORY_URL);
    try {
        const response = await fetch(HISTORY_URL);
        if (!response.ok) {
            console.error('Failed to fetch historical data');
            return;
        }
        
        const history = await response.json();
        console.log('Historical data received:', history.length, 'entries');
        updateChart(history);
    } catch (error) {
        console.error('Error fetching historical data:', error);
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

function updateChart(history) {
    if (!history || history.length === 0) {
        console.log('No historical data to display');
        return;
    }
    
    const ctx = document.getElementById('balanceChart').getContext('2d');
    
    // Prepare data for the chart
    const labels = history.map(entry => {
        const date = new Date(entry.timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    });
    
    const balanceData = history.map(entry => entry.balance);
    
    // Calculate daily usage (difference between consecutive readings)
    const usageData = [];
    for (let i = 1; i < history.length; i++) {
        const usage = history[i-1].balance - history[i].balance;
        usageData.push(usage > 0 ? usage : 0);
    }
    usageData.unshift(0); // First entry has no usage data
    
    // Destroy existing chart if it exists
    if (balanceChart) {
        balanceChart.destroy();
    }
    
    // Create new chart
    balanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Balance (€)',
                    data: balanceData,
                    borderColor: '#00d9a3',
                    backgroundColor: 'rgba(0, 217, 163, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y',
                },
                {
                    label: 'Usage (€)',
                    data: usageData,
                    borderColor: '#ffc107',
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y1',
                    type: 'bar'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#a8b2d1'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 26, 46, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#a8b2d1',
                    borderColor: '#00d9a3',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(168, 178, 209, 0.1)'
                    },
                    ticks: {
                        color: '#a8b2d1',
                        maxRotation: 45,
                        minRotation: 45,
                        maxTicksLimit: 10
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: {
                        color: 'rgba(168, 178, 209, 0.1)'
                    },
                    ticks: {
                        color: '#a8b2d1',
                        callback: function(value) {
                            return '€' + value.toFixed(2);
                        }
                    },
                    title: {
                        display: true,
                        text: 'Balance',
                        color: '#a8b2d1'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false,
                    },
                    ticks: {
                        color: '#a8b2d1',
                        callback: function(value) {
                            return '€' + value.toFixed(2);
                        }
                    },
                    title: {
                        display: true,
                        text: 'Usage',
                        color: '#a8b2d1'
                    }
                }
            }
        }
    });
}

// Initial load
fetchData();

// Refresh every 5 minutes
setInterval(fetchData, 5 * 60 * 1000);