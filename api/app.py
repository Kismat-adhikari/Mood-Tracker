from flask import Flask, request, jsonify, send_file, render_template
from datetime import datetime, timedelta
import sqlite3
import logging
from pathlib import Path
import json
from transformers import pipeline
import matplotlib.pyplot as plt
import seaborn as sns
import io
import os
import matplotlib.pyplot as plt
import seaborn as sns
from flask_cors import CORS
from dotenv import load_dotenv
load_dotenv() 
port = int(os.environ.get('PORT', 5000))




app = Flask(__name__)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize sentiment analysis model
try:
    sentiment_analyzer = pipeline("sentiment-analysis", model="distilbert-base-uncased-finetuned-sst-2-english")
except Exception as e:
    logger.error(f"Failed to load sentiment analysis model: {e}")
    sentiment_analyzer = None

# Database path
DB_PATH = Path(app.instance_path) / "moods.db"


def init_db():
    try:
        os.makedirs(app.instance_path, exist_ok=True)
        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute('''
                CREATE TABLE IF NOT EXISTS moods (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    time TEXT NOT NULL,
                    mood INTEGER NOT NULL,
                    notes TEXT,
                    sentiment_score REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            conn.commit()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise


def get_db_connection():
    """Create a database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def analyze_sentiment(text):
    """Analyze sentiment of given text."""
    if not text or not sentiment_analyzer:
        return 0.0
    try:
        result = sentiment_analyzer(text)
        # Convert POSITIVE/NEGATIVE to a score between -1 and 1
        score = result[0]['score']
        if result[0]['label'] == 'NEGATIVE':
            score = -score
        return score
    except Exception as e:
        logger.error(f"Sentiment analysis failed: {e}")
        return 0.0

# Initialize database at startup
with app.app_context():
    init_db()

@app.route('/')
def home():
    """Serve the main application page."""
    return render_template('index.html')

@app.route('/api/mood', methods=['POST'])
def log_mood():
    try:
        data = request.get_json()
        current_datetime = datetime.now()
        current_date = current_datetime.strftime('%Y-%m-%d')
        current_time = current_datetime.strftime('%H:%M')

        if not isinstance(data.get('mood'), int) or not (1 <= data['mood'] <= 5):
            return jsonify({'error': 'Invalid mood value'}), 400

        sentiment_score = analyze_sentiment(data.get('notes', ''))

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO moods (date, time, mood, notes, sentiment_score)
                VALUES (?, ?, ?, ?, ?)
            ''', (current_date, current_time, data['mood'], data.get('notes'), sentiment_score))
            conn.commit()

        return jsonify({'message': 'Mood logged successfully'}), 200
    except Exception as e:
        logger.error(f"Error logging mood: {e}")
        return jsonify({'error': 'Internal server error'}), 500
  
@app.route('/api/mood', methods=['GET'])
def get_moods():
    try:
        days = request.args.get('days', 28, type=int)
        days = min(days, 365)  # Cap the range to 365 days

        start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT date, time, mood, notes, sentiment_score
                FROM moods
                WHERE date >= ?
                ORDER BY date ASC, time ASC
            ''', (start_date,))
            entries = cursor.fetchall()

        mood_data = [dict(entry) for entry in entries]
        return jsonify(mood_data), 200
    except Exception as e:
        logger.error(f"Error retrieving moods: {e}")
        return jsonify({'error': 'Internal server error'}), 500
    

@app.route('/api/export', methods=['GET'])
def export_summary():
    try:
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT date, time, mood
                FROM moods
                WHERE date >= ?
                ORDER BY date ASC, time ASC
            ''', (start_date,))
            entries = cursor.fetchall()

        if not entries:
            return jsonify({'error': 'No data available for export'}), 404

        # Create the chart
        plt.figure(figsize=(10, 6))
        dates = [entry['date'] for entry in entries]
        moods = [entry['mood'] for entry in entries]
        
        sns.lineplot(x=dates, y=moods, marker="o", color="blue")
        plt.title('30-Day Mood Trend', fontsize=14)
        plt.xlabel('Date', fontsize=12)
        plt.ylabel('Mood Rating (1-5)', fontsize=12)
        plt.xticks(rotation=45, fontsize=8)
        plt.yticks(range(1, 6), fontsize=10)
        plt.tight_layout()

        # Save to buffer
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=300)
        buf.seek(0)
        plt.close()

        return send_file(
            buf,
            mimetype='image/png',
            as_attachment=True,
            download_name='mood_summary.png'
        )
    except Exception as e:
        logger.error(f"Error generating export: {e}")
        return jsonify({'error': 'Internal server error'}), 500




# In get_db_connection()
conn = sqlite3.connect(os.environ.get('DATABASE_URL')) 


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=port)