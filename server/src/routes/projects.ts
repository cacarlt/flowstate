import { Router } from 'express';
import { all, get, run } from '../db';

export const projectsRouter = Router();

// List all projects with aggregated stats
projectsRouter.get('/', (_req, res) => {
  const projects = all(`
    SELECT p.*,
      COALESCE(SUM(t.estimate_hours), 0) as total_estimate_hours,
      COUNT(t.id) as todo_count,
      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as done_count
    FROM projects p
    LEFT JOIN todos t ON t.project_id = p.id
    GROUP BY p.id
    ORDER BY p.sort_order, p.created_at DESC
  `);
  res.json(projects);
});

// Get single project with todos
projectsRouter.get('/:id', (req, res) => {
  const project = get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!project) return res.status(404).json({ error: 'Not found' });

  const todos = all('SELECT * FROM todos WHERE project_id = ? ORDER BY sort_order, created_at', [req.params.id]);
  res.json({ ...project, todos });
});

// Create project
projectsRouter.post('/', (req, res) => {
  const { name, due_date } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  const { lastId } = run('INSERT INTO projects (name, due_date) VALUES (?, ?)', [name, due_date || null]);
  const project = get('SELECT * FROM projects WHERE id = ?', [lastId]);
  res.status(201).json(project);
});

// Update project
projectsRouter.put('/:id', (req, res) => {
  const { name, due_date, collapsed, sort_order } = req.body;
  const fields: string[] = [];
  const values: any[] = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (due_date !== undefined) { fields.push('due_date = ?'); values.push(due_date); }
  if (collapsed !== undefined) { fields.push('collapsed = ?'); values.push(collapsed ? 1 : 0); }
  if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(sort_order); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  fields.push("updated_at = datetime('now')");
  values.push(req.params.id);

  run(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, values);
  const project = get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  res.json(project);
});

// Delete project
projectsRouter.delete('/:id', (req, res) => {
  run('DELETE FROM projects WHERE id = ?', [req.params.id]);
  res.status(204).end();
});
