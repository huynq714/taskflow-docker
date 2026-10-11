import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
DB_PATH = Path(os.environ.get('DATABASE_PATH', '/app/data/tasks.db'))
STATUSES = {'todo', 'in_progress', 'done'}
PRIORITIES = {'low', 'medium', 'high'}

@contextmanager
def db_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(DB_PATH), timeout=15)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()

def init_db():
    with db_connection() as db:
        db.execute('''CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done')),
            priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
            due_date TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )''')
        db.execute('CREATE INDEX IF NOT EXISTS idx_task_status ON tasks(status)')

def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')

def task_row(row):
    return dict(row)

def parse_payload(data, creating=False):
    if not isinstance(data, dict):
        return None, 'Dữ liệu không hợp lệ.'
    title = data.get('title', '')
    description = data.get('description', '')
    status = data.get('status', 'todo')
    priority = data.get('priority', 'medium')
    due_date = data.get('due_date') or None
    if not isinstance(title, str) or not title.strip() or len(title.strip()) > 120:
        return None, 'Tên công việc phải có 1–120 ký tự.'
    if not isinstance(description, str) or len(description) > 1500:
        return None, 'Mô tả không được vượt quá 1500 ký tự.'
    if status not in STATUSES or priority not in PRIORITIES:
        return None, 'Trạng thái hoặc độ ưu tiên không hợp lệ.'
    if due_date is not None:
        if not isinstance(due_date, str):
            return None, 'Ngày hạn không hợp lệ.'
        try:
            datetime.strptime(due_date, '%Y-%m-%d')
        except ValueError:
            return None, 'Ngày hạn phải có định dạng YYYY-MM-DD.'
    return dict(title=title.strip(), description=description.strip(), status=status, priority=priority, due_date=due_date), None

@app.get('/')
def home():
    return render_template('index.html')

@app.get('/health')
def health():
    try:
        with db_connection() as db:
            db.execute('SELECT 1').fetchone()
        return jsonify(status='ok', database='connected')
    except sqlite3.Error:
        return jsonify(status='error'), 503

@app.get('/api/tasks')
def list_tasks():
    with db_connection() as db:
        rows = db.execute('SELECT * FROM tasks ORDER BY CASE priority WHEN \'high\' THEN 0 WHEN \'medium\' THEN 1 ELSE 2 END, created_at DESC, id DESC').fetchall()
    return jsonify([task_row(row) for row in rows])

@app.post('/api/tasks')
def create_task():
    item, error = parse_payload(request.get_json(silent=True), creating=True)
    if error:
        return jsonify(error=error), 400
    now = utc_now()
    with db_connection() as db:
        cursor = db.execute('INSERT INTO tasks(title,description,status,priority,due_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?)', (*item.values(), now, now))
        row = db.execute('SELECT * FROM tasks WHERE id=?', (cursor.lastrowid,)).fetchone()
    return jsonify(task_row(row)), 201

@app.put('/api/tasks/<int:task_id>')
def update_task(task_id):
    item, error = parse_payload(request.get_json(silent=True))
    if error:
        return jsonify(error=error), 400
    with db_connection() as db:
        existing = db.execute('SELECT id FROM tasks WHERE id=?', (task_id,)).fetchone()
        if not existing:
            return jsonify(error='Không tìm thấy công việc.'), 404
        db.execute('UPDATE tasks SET title=?,description=?,status=?,priority=?,due_date=?,updated_at=? WHERE id=?', (*item.values(), utc_now(), task_id))
        row = db.execute('SELECT * FROM tasks WHERE id=?', (task_id,)).fetchone()
    return jsonify(task_row(row))

@app.delete('/api/tasks/<int:task_id>')
def delete_task(task_id):
    with db_connection() as db:
        cursor = db.execute('DELETE FROM tasks WHERE id=?', (task_id,))
        if cursor.rowcount == 0:
            return jsonify(error='Không tìm thấy công việc.'), 404
    return '', 204

@app.errorhandler(413)
def too_large(_):
    return jsonify(error='Nội dung yêu cầu quá lớn.'), 413

app.config['MAX_CONTENT_LENGTH'] = 20 * 1024

@app.after_request
def security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    return response

if __name__ == '__main__':
    init_db()
    app.run(host='127.0.0.1', port=5000)
