import sqlite3
import json
import os
from datetime import datetime
from typing import List, Dict, Any

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'storage', 'geolens.db')

def init_db():
    """Initializes the SQLite database tables."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        
        # Missions table to store queries and results
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS missions (
                id TEXT PRIMARY KEY,
                query TEXT NOT NULL,
                status TEXT NOT NULL,
                result_json TEXT,
                error TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Telemetry table to store simple metrics
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                metric_name TEXT NOT NULL UNIQUE,
                metric_value TEXT NOT NULL
            )
        ''')
        
        # Initialize basic telemetry if empty
        cursor.execute('INSERT OR IGNORE INTO telemetry (metric_name, metric_value) VALUES (?, ?)', ("total_pipelines_run", "0"))
        cursor.execute('INSERT OR IGNORE INTO telemetry (metric_name, metric_value) VALUES (?, ?)', ("data_ingested_gb", "0.0"))
        
        conn.commit()

def save_mission(task_id: str, query: str, status: str, result: Dict[Any, Any] = None, error: str = None):
    """Saves or updates a mission in the database."""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        result_json = json.dumps(result) if result else None
        
        cursor.execute('''
            INSERT INTO missions (id, query, status, result_json, error)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                status=excluded.status,
                result_json=excluded.result_json,
                error=excluded.error
        ''', (task_id, query, status, result_json, error))
        
        # Increment pipeline run count if completed
        if status == "completed":
            cursor.execute('''
                UPDATE telemetry 
                SET metric_value = CAST(CAST(metric_value AS INTEGER) + 1 AS TEXT)
                WHERE metric_name = 'total_pipelines_run'
            ''')
            # Simulate ingesting some data per mission (e.g. 2.5 GB)
            cursor.execute('''
                UPDATE telemetry 
                SET metric_value = CAST(CAST(metric_value AS REAL) + 2.5 AS TEXT)
                WHERE metric_name = 'data_ingested_gb'
            ''')
            
        conn.commit()

def get_history() -> List[Dict[str, Any]]:
    """Retrieves all missions, ordered by newest first."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT id, query, status, created_at FROM missions ORDER BY created_at DESC')
        
        history = []
        for row in cursor.fetchall():
            history.append({
                "id": row["id"],
                "query": row["query"],
                "status": row["status"],
                "created_at": row["created_at"]
            })
        return history

def get_mission_result(task_id: str) -> Dict[str, Any]:
    """Retrieves the full result of a specific mission."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT result_json FROM missions WHERE id = ?', (task_id,))
        row = cursor.fetchone()
        if row and row["result_json"]:
            return json.loads(row["result_json"])
        return None

def get_telemetry() -> Dict[str, Any]:
    """Retrieves system telemetry."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('SELECT metric_name, metric_value FROM telemetry')
        telemetry = {}
        for row in cursor.fetchall():
            telemetry[row["metric_name"]] = row["metric_value"]
            
        # Get count of active/completed missions
        cursor.execute("SELECT count(*) as count FROM missions WHERE status='running'")
        telemetry["active_streams"] = cursor.fetchone()["count"]
        
        return telemetry

# Initialize on import
init_db()
