import { Router } from 'express';
import { all, run } from '../db';

export const mydayRouter = Router();

mydayRouter.get('/', (req, res) => {
  const dateParam = req.query.date as string | undefined;
  let today: string;

  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    today = dateParam;
  } else {
    const now = new Date();
    today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // Tasks whose project delivery date is today or past (due/overdue), excluding done
  const dueTasks = all(`
    SELECT t.*, p.name as project_name, p.due_date as project_due_date FROM todos t
    JOIN projects p ON p.id = t.project_id
    WHERE p.due_date IS NOT NULL AND p.due_date <= ? AND t.status != 'done'
    ORDER BY p.due_date, t.sort_order
  `, [today]);

  // Tasks scheduled for this date (via scheduled_date or due_date), not done, not already in-progress
  const scheduledToday = all(`
    SELECT t.*, p.name as project_name, p.due_date as project_due_date FROM todos t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE (t.scheduled_date = ? OR (t.scheduled_date IS NULL AND t.due_date = ?)) AND t.status = 'todo'
    ORDER BY t.sort_order
  `, [today, today]);

  // In-progress tasks (regardless of dates)
  const inProgress = all(`
    SELECT t.*, p.name as project_name, p.due_date as project_due_date FROM todos t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.status = 'in_progress'
    ORDER BY t.sort_order
  `);

  // Tasks with no scheduled date and no due_date that are still todo
  const unscheduled = all(`
    SELECT t.*, p.name as project_name, p.due_date as project_due_date FROM todos t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.scheduled_date IS NULL AND t.due_date IS NULL AND t.status = 'todo'
    ORDER BY t.sort_order
  `);

  // Tasks completed on this date
  const completedToday = all(`
    SELECT t.*, p.name as project_name, p.due_date as project_due_date FROM todos t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.status = 'done' AND t.updated_at >= ?
    ORDER BY t.updated_at DESC
  `, [today]);

  // Active copilot sessions (launched or in_progress)
  const activeSessions = all(`
    SELECT s.*, p.name as project_name, t.title as todo_title FROM copilot_sessions s
    LEFT JOIN projects p ON p.id = s.project_id
    LEFT JOIN todos t ON t.id = s.todo_id
    WHERE s.status IN ('logged', 'launched', 'in_progress')
    ORDER BY s.id DESC
  `);

  // Planned hours for the day (scheduled + in-progress tasks)
  const allDayTasks = [...scheduledToday, ...inProgress];
  const plannedHours = allDayTasks.reduce((sum: number, t: any) => sum + (t.estimate_hours || 0), 0);

  // Summary stats
  const stats = {
    totalDue: dueTasks.length,
    totalInProgress: inProgress.length,
    totalCompletedToday: completedToday.length,
    totalActiveSessions: activeSessions.length,
    plannedHours,
  };

  res.json({ date: today, dueTasks, scheduledToday, inProgress, unscheduled, completedToday, activeSessions, stats });
});

// Bulk schedule todos to a specific date
mydayRouter.post('/schedule', (req, res) => {
  const { date, todoIds } = req.body;
  if (!date || !todoIds || !Array.isArray(todoIds) || todoIds.length === 0) {
    return res.status(400).json({ error: 'date and todoIds[] are required' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD format' });
  }

  for (const id of todoIds) {
    run("UPDATE todos SET scheduled_date = ?, updated_at = datetime('now') WHERE id = ?", [date, id]);
  }

  const updated = all(
    `SELECT t.*, p.name as project_name FROM todos t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.id IN (${todoIds.map(() => '?').join(',')})`,
    todoIds
  );
  res.json({ scheduled: updated.length, date, todos: updated });
});
