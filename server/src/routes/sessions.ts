import { Router } from 'express';
import { all, get, run } from '../db';

export const sessionsRouter = Router();

// List all copilot sessions with linked project/task names
sessionsRouter.get('/', (_req, res) => {
  const sessions = all(`
    SELECT s.*,
      p.name as project_name,
      t.title as todo_title
    FROM copilot_sessions s
    LEFT JOIN projects p ON p.id = s.project_id
    LEFT JOIN todos t ON t.id = s.todo_id
    ORDER BY s.id DESC
  `);
  res.json(sessions);
});

// Create a session
sessionsRouter.post('/', (req, res) => {
  const { session_url, session_id, task_prompt, notes, status, repo, branch, project_id, todo_id } = req.body;
  if (!notes) return res.status(400).json({ error: 'Notes required' });

  const { lastId } = run(
    'INSERT INTO copilot_sessions (project_id, todo_id, session_url, session_id, task_prompt, notes, status, repo, branch) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [project_id || null, todo_id || null, session_url || null, session_id || null, task_prompt || null, notes, status || 'logged', repo || null, branch || null]
  );

  res.status(201).json(get(`
    SELECT s.*, p.name as project_name, t.title as todo_title
    FROM copilot_sessions s
    LEFT JOIN projects p ON p.id = s.project_id
    LEFT JOIN todos t ON t.id = s.todo_id
    WHERE s.id = ?
  `, [lastId]));
});

// Update session
sessionsRouter.put('/:id', (req, res) => {
  const { session_url, session_id, task_prompt, notes, status, repo, branch, project_id, todo_id } = req.body;
  const fields: string[] = [];
  const values: any[] = [];

  if (session_url !== undefined) { fields.push('session_url = ?'); values.push(session_url); }
  if (session_id !== undefined) { fields.push('session_id = ?'); values.push(session_id); }
  if (task_prompt !== undefined) { fields.push('task_prompt = ?'); values.push(task_prompt); }
  if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }
  if (status !== undefined) { fields.push('status = ?'); values.push(status); }
  if (repo !== undefined) { fields.push('repo = ?'); values.push(repo); }
  if (branch !== undefined) { fields.push('branch = ?'); values.push(branch); }
  if (project_id !== undefined) { fields.push('project_id = ?'); values.push(project_id); }
  if (todo_id !== undefined) { fields.push('todo_id = ?'); values.push(todo_id); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id);

  run(`UPDATE copilot_sessions SET ${fields.join(', ')} WHERE id = ?`, values);
  res.json(get(`
    SELECT s.*, p.name as project_name, t.title as todo_title
    FROM copilot_sessions s
    LEFT JOIN projects p ON p.id = s.project_id
    LEFT JOIN todos t ON t.id = s.todo_id
    WHERE s.id = ?
  `, [req.params.id]));
});

// Launch is handled client-side (copies command + marks launched)
// This endpoint just marks the session as launched
sessionsRouter.post('/:id/launch', (req, res) => {
  const session = get('SELECT * FROM copilot_sessions WHERE id = ?', [req.params.id]);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  run("UPDATE copilot_sessions SET status = 'launched' WHERE id = ?", [req.params.id]);

  res.json(get(`
    SELECT s.*, p.name as project_name, t.title as todo_title
    FROM copilot_sessions s
    LEFT JOIN projects p ON p.id = s.project_id
    LEFT JOIN todos t ON t.id = s.todo_id
    WHERE s.id = ?
  `, [req.params.id]));
});

// Ingest log lines from the launcher
sessionsRouter.post('/:id/logs', (req, res) => {
  const { lines } = req.body;
  if (!lines || !Array.isArray(lines)) return res.status(400).json({ error: 'lines array required' });

  for (const line of lines) {
    run('INSERT INTO session_logs (session_id, line) VALUES (?, ?)', [req.params.id, line]);
  }

  // Notify SSE subscribers
  const subs = sseSubscribers.get(Number(req.params.id));
  if (subs) {
    for (const sub of subs) {
      for (const line of lines) {
        sub.write(`data: ${JSON.stringify(line)}\n\n`);
      }
    }
  }

  res.json({ received: lines.length });
});

// Get stored logs for a session
sessionsRouter.get('/:id/logs', (req, res) => {
  try {
    const logs = all('SELECT line, created_at FROM session_logs WHERE session_id = ? ORDER BY id', [req.params.id]);
    res.json(logs);
  } catch (_) {
    res.json([]);
  }
});

// SSE stream for live logs
const sseSubscribers = new Map<number, Set<any>>();

sessionsRouter.get('/:id/logs/stream', (req, res) => {
  const sessionId = Number(req.params.id);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Send existing logs first
  try {
    const existing = all('SELECT line FROM session_logs WHERE session_id = ? ORDER BY id', [sessionId]);
    for (const row of existing) {
      res.write(`data: ${JSON.stringify(row.line)}\n\n`);
    }
  } catch (_) {}

  // Subscribe for new logs
  if (!sseSubscribers.has(sessionId)) {
    sseSubscribers.set(sessionId, new Set());
  }
  sseSubscribers.get(sessionId)!.add(res);

  req.on('close', () => {
    sseSubscribers.get(sessionId)?.delete(res);
    if (sseSubscribers.get(sessionId)?.size === 0) {
      sseSubscribers.delete(sessionId);
    }
  });
});

// Delete session
sessionsRouter.delete('/:id', (req, res) => {
  run('DELETE FROM copilot_sessions WHERE id = ?', [req.params.id]);
  res.status(204).end();
});
