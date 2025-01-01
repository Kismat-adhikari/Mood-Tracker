let moodChart = null; // Store chart instance
// Navigation handling
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

// Mood selection handling
document.querySelectorAll('.mood-option').forEach(option => {
    option.addEventListener('click', () => {
        // Remove selected class from all options
        document.querySelectorAll('.mood-option').forEach(opt => {
            opt.classList.remove('selected');
        });

        // Add selected class to clicked option
        option.classList.add('selected');

        // Check the radio input
        const radio = option.querySelector('input[type="radio"]');
        radio.checked = true;
    });
});

// Mood form handling
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
            // Reset form and selection
            document.querySelectorAll('.mood-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            e.target.reset();

            // Show success message
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

// Dashboard functions
async function updateDashboard() {
    console.log("Starting dashboard update");
    try {
        const response = await fetch('/api/mood');
        console.log("API Response:", response);
        const data = await response.json();
        console.log("Data received:", data);

        if (data.length === 0) {
            document.getElementById('dashboard').innerHTML = `
                <div class="empty-state">
                    <h3>No mood data yet</h3>
                    <p>Start tracking your mood to see insights here!</p>
                </div>
            `;
            return;
        }

        console.log("Updating mood chart...");
        updateMoodChart(data);
        console.log("Updating mood calendar...");
        updateMoodCalendar(data);
        console.log("Updating sentiment summary...");
        updateSentimentSummary(data);
        updateMoodHistory(data);
    } catch (error) {
        console.error('Detailed Error:', error);
        document.getElementById('dashboard').innerHTML = `
            <div class="error-state">
                <h3>Error loading dashboard</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

function updateMoodChart(data) {
    const ctx = document.getElementById('mood-chart').getContext('2d');

    // Process the data first
    const moodData = processDataForChart(data);

    // Destroy existing chart if it exists
    if (moodChart) {
        moodChart.destroy();
    }

    // Define mood descriptions for tooltip
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
                pointRadius: 6, // Larger points for better hovering
                pointHoverRadius: 8, // Even larger on hover
                pointBackgroundColor: '#f46464', // Match the line color
                pointHoverBackgroundColor: '#fff', // White on hover
                pointBorderColor: '#fff', // White border
                pointHoverBorderColor: '#f46464' // Red border on hover
            }]
        },
        options: {
            responsive: true,
            interaction: {
                intersect: false, // Hover anywhere on the line
                mode: 'nearest' // Show nearest point
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
            },
            animation: {
                duration: 1000, // 1 second animation
                easing: 'easeInOutQuart'
            }
        }
    });
}


let currentDate = new Date();

function updateMonthDisplay() {
    document.getElementById('currentMonth').textContent =
        currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

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
        }

        calendar.appendChild(dayElement);
    }
}



// Add event listeners for month navigation
document.getElementById('prevMonth').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    updateDashboard();
});

document.getElementById('nextMonth').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    updateDashboard();
});

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
    container.innerHTML = ''; // Clear existing entries

    // Sort data by date and time in descending order
    const sortedData = [...data].sort((a, b) => {
        const dateCompare = new Date(b.date) - new Date(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.time.localeCompare(a.time);
    });

    sortedData.forEach(entry => {
                const entryElement = document.createElement('div');
                entryElement.className = 'mood-entry';

                const date = new Date(entry.date);
                const formattedDate = date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                });

                // Convert 24h time to 12h format
                const [hour, minute] = entry.time.split(':');
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

function processDataForChart(data) {
    const last7Days = data.slice(-7);
    return {
        labels: last7Days.map(entry => entry.date),
        values: last7Days.map(entry => entry.mood)
    };
}

// Export functionality
document.getElementById('export-btn').addEventListener('click', async() => {
    console.log("Export button clicked!"); // Add this to check if it's firing
    try {
        const response = await fetch('/api/export');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mood-summary.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to export summary');
    }
});