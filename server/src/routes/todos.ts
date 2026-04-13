import { Router } from 'express';
import { all, get, run } from '../db';

export const todosRouter = Router();

// List todos (optionally by project), includes linked session count
todosRouter.get('/', (req, res) => {
  const { project_id, status } = req.query;
  let sql = `SELECT t.*,
    (SELECT COUNT(*) FROM copilot_sessions cs WHERE cs.todo_id = t.id) as session_count,
    (SELECT COUNT(*) FROM todo_ado_links tal WHERE tal.todo_id = t.id) as ado_link_count
    FROM todos t WHERE 1=1`;
  const params: any[] = [];

  if (project_id) { sql += ' AND t.project_id = ?'; params.push(project_id); }
  if (status) { sql += ' AND t.status = ?'; params.push(status); }
  sql += ' ORDER BY t.sort_order, t.created_at';

  res.json(all(sql, params));
});

// Create todo
todosRouter.post('/', (req, res) => {
  const { project_id, title, estimate_hours, due_date } = req.body;
  if (!project_id || !title) return res.status(400).json({ error: 'project_id and title required' });

  const { lastId } = run(
    'INSERT INTO todos (project_id, title, estimate_hours, due_date) VALUES (?, ?, ?, ?)',
    [project_id, title, estimate_hours || null, due_date || null]
  );

  res.status(201).json(get('SELECT * FROM todos WHERE id = ?', [lastId]));
});

// Update todo
todosRouter.put('/:id', (req, res) => {
  const { title, estimate_hours, due_date, status, sort_order, project_id, notes } = req.body;
  const fields: string[] = [];
  const values: any[] = [];

  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }
  if (estimate_hours !== undefined) { fields.push('estimate_hours = ?'); values.push(estimate_hours); }
  if (due_date !== undefined) { fields.push('due_date = ?'); values.push(due_date); }
  if (status !== undefined) { fields.push('status = ?'); values.push(status); }
  if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(sort_order); }
  if (project_id !== undefined) { fields.push('project_id = ?'); values.push(project_id); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  fields.push("updated_at = datetime('now')");
  values.push(req.params.id);

  run(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`, values);
  res.json(get('SELECT * FROM todos WHERE id = ?', [req.params.id]));
});

// Delete todo
todosRouter.delete('/:id', (req, res) => {
  run('DELETE FROM todos WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

// Link/unlink ADO item
todosRouter.post('/:id/ado-link', (req, res) => {
  const { ado_item_id } = req.body;
  run('INSERT OR IGNORE INTO todo_ado_links (todo_id, ado_item_id) VALUES (?, ?)', [req.params.id, ado_item_id]);
  res.status(201).json({ linked: true });
});

todosRouter.delete('/:id/ado-link/:adoItemId', (req, res) => {
  run('DELETE FROM todo_ado_links WHERE todo_id = ? AND ado_item_id = ?', [req.params.id, req.params.adoItemId]);
  res.status(204).end();
});

// Get ADO items linked to a todo
todosRouter.get('/:id/ado-items', (req, res) => {
  const items = all(`
    SELECT a.* FROM ado_items a
    INNER JOIN todo_ado_links l ON l.ado_item_id = a.id
    WHERE l.todo_id = ?
    ORDER BY a.type, a.title
  `, [req.params.id]);
  res.json(items);
});

// Get sessions linked to a todo (via direct todo_id FK on copilot_sessions)
todosRouter.get('/:id/sessions', (req, res) => {
  const sessions = all(`
    SELECT * FROM copilot_sessions WHERE todo_id = ? ORDER BY id DESC
  `, [req.params.id]);
  res.json(sessions);
});

// Link/unlink Copilot session
todosRouter.post('/:id/session-link', (req, res) => {
  const { session_id } = req.body;
  run('INSERT OR IGNORE INTO todo_copilot_sessions (todo_id, session_id) VALUES (?, ?)', [req.params.id, session_id]);
  res.status(201).json({ linked: true });
});

todosRouter.delete('/:id/session-link/:sessionId', (req, res) => {
  run('DELETE FROM todo_copilot_sessions WHERE todo_id = ? AND session_id = ?', [req.params.id, req.params.sessionId]);
  res.status(204).end();
});
