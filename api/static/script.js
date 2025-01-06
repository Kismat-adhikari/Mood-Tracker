// Global variables
let moodChart = null;
let selectedDate = null;
let moodData = [];
let currentDate = new Date();

// Navigation button event listeners
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const view = btn.dataset.view;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(view === 'log' ? 'mood-log' : 'dashboard').classList.add('active');

        if (view === 'dashboard') {
            updateDashboard();
        }
    });
});

// Mood option selection
document.querySelectorAll('.mood-option').forEach(option => {
    option.addEventListener('click', () => {
        document.querySelectorAll('.mood-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        option.classList.add('selected');
        const radio = option.querySelector('input[type="radio"]');
        radio.checked = true;
    });
});

// Form submission handler
document.getElementById('mood-form').addEventListener('submit', async(e) => {
    e.preventDefault();

    const selectedMood = document.querySelector('input[name="mood"]:checked');
    if (!selectedMood) {
        alert('Please select a mood');
        return;
    }

    const formData = new FormData(e.target);
    const mood = formData.get('mood');
    const notes = formData.get('notes');

    try {
        const response = await fetch('/api/mood', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                mood: parseInt(mood),
                notes: notes,
                date: new Date().toISOString().split('T')[0]
            })
        });

        if (response.ok) {
            document.querySelectorAll('.mood-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            e.target.reset();

            const submitBtn = e.target.querySelector('.submit-btn');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Mood Logged! ✓';
            submitBtn.style.backgroundColor = '#4CAF50';

            setTimeout(() => {
                submitBtn.textContent = originalText;
                submitBtn.style.backgroundColor = '';
            }, 2000);
        } else {
            throw new Error('Failed to log mood');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to log mood. Please try again.');
    }
});

// Main dashboard update function
async function updateDashboard() {
    try {
        const response = await fetch('/api/mood');
        const data = await response.json();

        if (data.length === 0) {
            document.getElementById('dashboard').innerHTML = `
                <div class="empty-state">
                    <h3>No mood data yet</h3>
                    <p>Start tracking your mood to see insights here!</p>
                </div>
            `;
            return;
        }

        // Store the data globally
        moodData = data;

        updateMoodChart(data);
        updateMoodCalendar(data);
        updateSentimentSummary(data);
        updateMoodHistory(data);
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('dashboard').innerHTML = `
            <div class="error-state">
                <h3>Error loading dashboard</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

// Calendar update function
function updateMoodCalendar(data) {
    const calendar = document.getElementById('mood-calendar');
    calendar.innerHTML = '';

    const moodColors = {
        1: '#ff9999',
        2: '#ffcc99',
        3: '#ffff99',
        4: '#99ff99',
        5: '#99ccff'
    };

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 27);

    for (let i = 0; i < 28; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = date.getDate();

        const moodEntry = data.find(entry => entry.date === dateStr);
        if (moodEntry) {
            dayElement.style.backgroundColor = moodColors[moodEntry.mood];
            dayElement.title = `Mood: ${moodEntry.mood}/5`;
            dayElement.dataset.date = dateStr;

            if (selectedDate === dateStr) {
                dayElement.classList.add('selected');
            }
        }

        // Add click handler for the calendar day
        dayElement.addEventListener('click', () => {
            if (dayElement.dataset.date) {
                if (selectedDate === dateStr) {
                    selectedDate = null;
                    document.querySelectorAll('.calendar-day').forEach(day => {
                        day.classList.remove('selected');
                    });
                } else {
                    selectedDate = dateStr;
                    document.querySelectorAll('.calendar-day').forEach(day => {
                        day.classList.remove('selected');
                    });
                    dayElement.classList.add('selected');
                }

                updateMoodChart(moodData);
                updateMoodHistory(moodData);
            }
        });

        calendar.appendChild(dayElement);
    }
}

// Chart update function
function updateMoodChart(data) {
    const ctx = document.getElementById('mood-chart').getContext('2d');
    let filteredData = data;

    if (selectedDate) {
        filteredData = data.filter(entry => entry.date === selectedDate);
    } else {
        filteredData = data.slice(-7);
    }

    const moodData = processDataForChart(filteredData);

    if (moodChart) {
        moodChart.destroy();
    }

    const moodDescriptions = {
        1: 'Terrible',
        2: 'Bad',
        3: 'Okay',
        4: 'Good',
        5: 'Great'
    };

    moodChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: moodData.labels,
            datasets: [{
                label: 'Mood',
                data: moodData.values,
                borderColor: '#f46464',
                backgroundColor: 'rgba(244, 100, 100, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#f46464',
                pointHoverBackgroundColor: '#fff',
                pointBorderColor: '#fff',
                pointHoverBorderColor: '#f46464'
            }]
        },
        options: {
            responsive: true,
            interaction: {
                intersect: false,
                mode: 'nearest'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleColor: '#fff',
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            return [
                                `Mood: ${value}/5`,
                                `Feeling: ${moodDescriptions[value]}`
                            ];
                        },
                        title: function(context) {
                            return `Date: ${context[0].label}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 1,
                    max: 5,
                    ticks: {
                        stepSize: 1,
                        color: '#ffffff',
                        callback: function(value) {
                            return `${value} - ${moodDescriptions[value]}`;
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

// History update function
function updateMoodHistory(data) {
    const moodEmojis = {
        1: '😢',
        2: '😔',
        3: '😐',
        4: '🙂',
        5: '😊'
    };

    const moodLabels = {
        1: 'Terrible',
        2: 'Bad',
        3: 'Okay',
        4: 'Good',
        5: 'Great'
    };

    const container = document.getElementById('mood-entries');
    container.innerHTML = '';

    let filteredData = selectedDate ?
        data.filter(entry => entry.date === selectedDate) :
        data;

    const sortedData = [...filteredData].sort((a, b) => {
        const dateCompare = new Date(b.date) - new Date(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.time.localeCompare(a.time);
    });

    if (selectedDate) {
        const clearFilterBtn = document.createElement('button');
        clearFilterBtn.className = 'clear-filter-btn';
        clearFilterBtn.innerHTML = 'Clear Date Filter ×';
        clearFilterBtn.onclick = () => {
            selectedDate = null;
            document.querySelectorAll('.calendar-day').forEach(day => {
                day.classList.remove('selected');
            });
            updateMoodChart(moodData);
            updateMoodHistory(moodData);
        };
        container.appendChild(clearFilterBtn);
    }

    sortedData.forEach(entry => {
                const entryElement = document.createElement('div');
                entryElement.className = 'mood-entry';

                const date = new Date(entry.date);
                const formattedDate = date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                });

                const [hour, minute] = entry.time ? entry.time.split(':') : ['00', '00'];
                const timeString = new Date(0, 0, 0, hour, minute)
                    .toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    });

                entryElement.innerHTML = `
            <div class="mood-entry-emoji">
                ${moodEmojis[entry.mood]}
            </div>
            <div class="mood-entry-content">
                <div class="mood-entry-header">
                    <div class="mood-entry-datetime">
                        <div class="mood-entry-date">${formattedDate}</div>
                        <div class="mood-entry-time">${timeString}</div>
                    </div>
                    <strong>${moodLabels[entry.mood]}</strong>
                </div>
                ${entry.notes ? `<div class="mood-entry-notes">${entry.notes}</div>` : ''}
            </div>
        `;

        container.appendChild(entryElement);
    });
}

// Sentiment summary update function
function updateSentimentSummary(data) {
    const summary = document.getElementById('sentiment-summary');
    const recentMoods = data.slice(-7);

    const averageMood = recentMoods.reduce((acc, curr) => acc + curr.mood, 0) / recentMoods.length;
    const sentimentScore = recentMoods.reduce((acc, curr) => acc + (curr.sentiment_score || 0), 0) / recentMoods.length;

    summary.innerHTML = `
        <div class="summary-stats">
            <div class="stat">
                <h4>Average Mood</h4>
                <p>${averageMood.toFixed(1)}/5</p>
            </div>
            <div class="stat">
                <h4>Sentiment Score</h4>
                <p>${(sentimentScore * 100).toFixed(0)}%</p>
            </div>
        </div>
    `;
}

// Helper function for chart data processing
function processDataForChart(data) {
    return {
        labels: data.map(entry => entry.date),
        values: data.map(entry => entry.mood)
    };
}

// Export button event listener
document.getElementById('export-btn').addEventListener('click', async () => {
    if (!moodChart) {
        alert('No chart data available');
        return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = moodChart.canvas.width * 2;
    tempCanvas.height = moodChart.canvas.height * 2;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.scale(2, 2);
    
    const tempChart = new Chart(tempCtx, {
        type: moodChart.config.type,
        data: moodChart.config.data,
        options: {
            ...moodChart.config.options,
            animation: false,
            responsive: false,
            devicePixelRatio: 2
        }
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    tempCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mood-trend.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        tempChart.destroy();
        tempCanvas.remove();
    }, 'image/png', 1.0);
});