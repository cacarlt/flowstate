import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

const app = createApp();

describe('MyDay API', () => {
  it('GET /api/myday returns today by default', async () => {
    const res = await request(app).get('/api/myday');
    expect(res.status).toBe(200);
    expect(res.body.date).toBeDefined();
    expect(res.body.dueTasks).toBeDefined();
    expect(res.body.scheduledToday).toBeDefined();
    expect(res.body.inProgress).toBeDefined();
    expect(res.body.unscheduled).toBeDefined();
    expect(res.body.completedToday).toBeDefined();
    expect(res.body.stats).toBeDefined();
  });

  it('GET /api/myday?date=YYYY-MM-DD returns data for that date', async () => {
    const res = await request(app).get('/api/myday?date=2026-04-14');
    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-04-14');
  });

  it('ignores invalid date format and defaults to today', async () => {
    const res = await request(app).get('/api/myday?date=not-a-date');
    expect(res.status).toBe(200);
    // Should still return today's date
    expect(res.body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns tasks scheduled for a specific date', async () => {
    // Create project and todo scheduled for a specific date
    const proj = await request(app).post('/api/projects').send({ name: 'Schedule Test' });
    await request(app).post('/api/todos').send({
      project_id: proj.body.id,
      title: 'Scheduled Task',
      scheduled_date: '2026-06-15',
    });

    const res = await request(app).get('/api/myday?date=2026-06-15');
    expect(res.status).toBe(200);
    const found = res.body.scheduledToday.find((t: any) => t.title === 'Scheduled Task');
    expect(found).toBeDefined();
  });

  it('does not return tasks scheduled for a different date', async () => {
    const proj = await request(app).post('/api/projects').send({ name: 'Wrong Date Test' });
    await request(app).post('/api/todos').send({
      project_id: proj.body.id,
      title: 'Other Day Task',
      scheduled_date: '2026-07-01',
    });

    const res = await request(app).get('/api/myday?date=2026-06-15');
    const found = res.body.scheduledToday.find((t: any) => t.title === 'Other Day Task');
    expect(found).toBeUndefined();
  });
});

describe('MyDay Bulk Schedule', () => {
  it('POST /api/myday/schedule sets scheduled_date on todos', async () => {
    const proj = await request(app).post('/api/projects').send({ name: 'Bulk Schedule' });
    const todo1 = await request(app).post('/api/todos').send({ project_id: proj.body.id, title: 'Bulk 1' });
    const todo2 = await request(app).post('/api/todos').send({ project_id: proj.body.id, title: 'Bulk 2' });

    const res = await request(app).post('/api/myday/schedule').send({
      date: '2026-05-01',
      todoIds: [todo1.body.id, todo2.body.id],
    });

    expect(res.status).toBe(200);
    expect(res.body.scheduled).toBe(2);
    expect(res.body.date).toBe('2026-05-01');
    expect(res.body.todos).toHaveLength(2);
    expect(res.body.todos[0].scheduled_date).toBe('2026-05-01');
  });

  it('rejects missing date', async () => {
    const res = await request(app).post('/api/myday/schedule').send({ todoIds: [1] });
    expect(res.status).toBe(400);
  });

  it('rejects missing todoIds', async () => {
    const res = await request(app).post('/api/myday/schedule').send({ date: '2026-05-01' });
    expect(res.status).toBe(400);
  });

  it('rejects empty todoIds', async () => {
    const res = await request(app).post('/api/myday/schedule').send({ date: '2026-05-01', todoIds: [] });
    expect(res.status).toBe(400);
  });

  it('rejects invalid date format', async () => {
    const res = await request(app).post('/api/myday/schedule').send({ date: 'bad-date', todoIds: [1] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/YYYY-MM-DD/);
  });
});

describe('Todos scheduled_date field', () => {
  it('creates todo with scheduled_date', async () => {
    const proj = await request(app).post('/api/projects').send({ name: 'Sched Field' });
    const res = await request(app).post('/api/todos').send({
      project_id: proj.body.id,
      title: 'Has Schedule',
      scheduled_date: '2026-04-20',
    });
    expect(res.status).toBe(201);
    expect(res.body.scheduled_date).toBe('2026-04-20');
  });

  it('updates todo scheduled_date', async () => {
    const proj = await request(app).post('/api/projects').send({ name: 'Sched Update' });
    const todo = await request(app).post('/api/todos').send({ project_id: proj.body.id, title: 'Update Sched' });

    const res = await request(app).put(`/api/todos/${todo.body.id}`).send({ scheduled_date: '2026-04-25' });
    expect(res.status).toBe(200);
    expect(res.body.scheduled_date).toBe('2026-04-25');
  });

  it('clears scheduled_date with null', async () => {
    const proj = await request(app).post('/api/projects').send({ name: 'Sched Clear' });
    const todo = await request(app).post('/api/todos').send({
      project_id: proj.body.id,
      title: 'Clear Sched',
      scheduled_date: '2026-04-20',
    });

    const res = await request(app).put(`/api/todos/${todo.body.id}`).send({ scheduled_date: null });
    expect(res.status).toBe(200);
    expect(res.body.scheduled_date).toBeNull();
  });
});
