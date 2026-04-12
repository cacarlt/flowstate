import { Router } from 'express';
import { all } from '../db';

export const mydayRouter = Router();

mydayRouter.get('/', (_req, res) => {
  const today = new Date().toISOString().split('T')[0];

  // Tasks due today or overdue (not done)
  const dueTasks = all(`
    SELECT t.*, p.name as project_name FROM todos t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.due_date <= ? AND t.status != 'done'
    ORDER BY t.due_date, t.sort_order
  `, [today]);

  // In-progress tasks (regardless of due date)
  const inProgress = all(`
    SELECT t.*, p.name as project_name FROM todos t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.status = 'in_progress'
    ORDER BY t.sort_order
  `);

  // Tasks with no due date that are still todo
  const unscheduled = all(`
    SELECT t.*, p.name as project_name FROM todos t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE t.due_date IS NULL AND t.status = 'todo'
    ORDER BY t.sort_order
    LIMIT 10
  `);

  // Tasks completed today
  const completedToday = all(`
    SELECT t.*, p.name as project_name FROM todos t
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

  // Summary stats
  const stats = {
    totalDue: dueTasks.length,
    totalInProgress: inProgress.length,
    totalCompletedToday: completedToday.length,
    totalActiveSessions: activeSessions.length,
  };

  res.json({ dueTasks, inProgress, unscheduled, completedToday, activeSessions, stats });
});
