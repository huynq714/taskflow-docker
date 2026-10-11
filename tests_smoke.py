"""Basic Flask API smoke tests; run python tests_smoke.py (requires Flask)."""
import os
import tempfile
from pathlib import Path

with tempfile.TemporaryDirectory() as directory:
    os.environ['DATABASE_PATH'] = str(Path(directory) / 'tasks.db')
    from app import app, init_db
    init_db()
    client = app.test_client()
    assert client.get('/').status_code == 200
    assert client.get('/health').json['status'] == 'ok'
    assert client.get('/api/tasks').json == []
    result = client.post('/api/tasks', json={'title': 'Viết báo cáo', 'description': 'Docker', 'priority': 'high', 'status': 'todo', 'due_date': None})
    assert result.status_code == 201, result.json
    identifier = result.json['id']
    assert len(client.get('/api/tasks').json) == 1
    response = client.put(f'/api/tasks/{identifier}', json={'title':'Đã xong', 'description':'', 'priority':'medium','status':'done','due_date':'2026-10-20'})
    assert response.status_code == 200 and response.json['status'] == 'done'
    assert client.post('/api/tasks', json={'title':''}).status_code == 400
    assert client.delete(f'/api/tasks/{identifier}').status_code == 204
    assert client.get('/api/tasks').json == []
    print('PASS: homepage / health / create / read / update / validation / delete')
