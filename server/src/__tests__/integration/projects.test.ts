import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

const app = createApp();

describe('Projects API', () => {
  it('GET /api/projects returns empty array initially', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/projects creates a project', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'My Project', due_date: '2026-05-01' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Project');
    expect(res.body.due_date).toBe('2026-05-01');
    expect(res.body.id).toBeDefined();
  });

  it('POST /api/projects rejects missing name', async () => {
    const res = await request(app).post('/api/projects').send({});
    expect(res.status).toBe(400);
  });

  it('GET /api/projects returns projects with aggregated stats', async () => {
    // Create project + todos
    const proj = await request(app).post('/api/projects').send({ name: 'Stats Test' });
    await request(app).post('/api/todos').send({ project_id: proj.body.id, title: 'Task 1', estimate_hours: 3 });
    await request(app).post('/api/todos').send({ project_id: proj.body.id, title: 'Task 2', estimate_hours: 5 });

    const res = await request(app).get('/api/projects');
    const p = res.body.find((x: any) => x.name === 'Stats Test');
    expect(p.todo_count).toBe(2);
    expect(p.total_estimate_hours).toBe(8);
    expect(p.done_count).toBe(0);
  });

  it('PUT /api/projects/:id updates fields', async () => {
    const proj = await request(app).post('/api/projects').send({ name: 'Original' });
    const res = await request(app)
      .put(`/api/projects/${proj.body.id}`)
      .send({ name: 'Updated', collapsed: true });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
    expect(res.body.collapsed).toBe(1);
  });

  it('PUT /api/projects/:id rejects empty update', async () => {
    const proj = await request(app).post('/api/projects').send({ name: 'X' });
    const res = await request(app).put(`/api/projects/${proj.body.id}`).send({});
    expect(res.status).toBe(400);
  });

  it('DELETE /api/projects/:id removes project', async () => {
    const proj = await request(app).post('/api/projects').send({ name: 'ToDelete' });
    const del = await request(app).delete(`/api/projects/${proj.body.id}`);
    expect(del.status).toBe(204);

    const list = await request(app).get('/api/projects');
    expect(list.body.find((x: any) => x.name === 'ToDelete')).toBeUndefined();
  });

  it('DELETE /api/projects/:id cascades to todos', async () => {
    const proj = await request(app).post('/api/projects').send({ name: 'Cascade' });
    await request(app).post('/api/todos').send({ project_id: proj.body.id, title: 'Child' });

    await request(app).delete(`/api/projects/${proj.body.id}`);
    const todos = await request(app).get('/api/todos');
    expect(todos.body).toHaveLength(0);
  });
});
