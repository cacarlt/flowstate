import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

const app = createApp();

// Helper to create a project
async function createProject(name = 'Test Project') {
  const res = await request(app).post('/api/projects').send({ name });
  return res.body;
}

describe('Todos API', () => {
  it('GET /api/todos returns empty initially', async () => {
    const res = await request(app).get('/api/todos');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/todos creates a todo', async () => {
    const proj = await createProject();
    const res = await request(app).post('/api/todos').send({
      project_id: proj.id,
      title: 'New Task',
      estimate_hours: 4,
      due_date: '2026-06-01',
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('New Task');
    expect(res.body.estimate_hours).toBe(4);
    expect(res.body.status).toBe('todo');
  });

  it('POST /api/todos rejects missing fields', async () => {
    const res = await request(app).post('/api/todos').send({ title: 'No project' });
    expect(res.status).toBe(400);
  });

  it('GET /api/todos filters by project_id', async () => {
    const p1 = await createProject('P1');
    const p2 = await createProject('P2');
    await request(app).post('/api/todos').send({ project_id: p1.id, title: 'T1' });
    await request(app).post('/api/todos').send({ project_id: p2.id, title: 'T2' });

    const res = await request(app).get(`/api/todos?project_id=${p1.id}`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('T1');
  });

  it('GET /api/todos filters by status', async () => {
    const proj = await createProject();
    const t1 = await request(app).post('/api/todos').send({ project_id: proj.id, title: 'Open' });
    await request(app).put(`/api/todos/${t1.body.id}`).send({ status: 'done' });
    await request(app).post('/api/todos').send({ project_id: proj.id, title: 'Still Open' });

    const res = await request(app).get('/api/todos?status=todo');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Still Open');
  });

  it('PUT /api/todos/:id updates status', async () => {
    const proj = await createProject();
    const todo = await request(app).post('/api/todos').send({ project_id: proj.id, title: 'Task' });

    const res = await request(app).put(`/api/todos/${todo.body.id}`).send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });

  it('PUT /api/todos/:id updates multiple fields', async () => {
    const proj = await createProject();
    const todo = await request(app).post('/api/todos').send({ project_id: proj.id, title: 'Old' });

    const res = await request(app).put(`/api/todos/${todo.body.id}`).send({
      title: 'New Title',
      estimate_hours: 8,
      due_date: '2026-07-01',
    });
    expect(res.body.title).toBe('New Title');
    expect(res.body.estimate_hours).toBe(8);
    expect(res.body.due_date).toBe('2026-07-01');
  });

  it('DELETE /api/todos/:id removes a todo', async () => {
    const proj = await createProject();
    const todo = await request(app).post('/api/todos').send({ project_id: proj.id, title: 'Bye' });

    const del = await request(app).delete(`/api/todos/${todo.body.id}`);
    expect(del.status).toBe(204);

    const list = await request(app).get('/api/todos');
    expect(list.body).toHaveLength(0);
  });

  it('status cycle: todo → in_progress → done → todo', async () => {
    const proj = await createProject();
    const todo = await request(app).post('/api/todos').send({ project_id: proj.id, title: 'Cycle' });

    let res = await request(app).put(`/api/todos/${todo.body.id}`).send({ status: 'in_progress' });
    expect(res.body.status).toBe('in_progress');

    res = await request(app).put(`/api/todos/${todo.body.id}`).send({ status: 'done' });
    expect(res.body.status).toBe('done');

    res = await request(app).put(`/api/todos/${todo.body.id}`).send({ status: 'todo' });
    expect(res.body.status).toBe('todo');
  });

  it('done todos update project aggregation', async () => {
    const proj = await createProject('Agg');
    const t1 = await request(app).post('/api/todos').send({ project_id: proj.id, title: 'A', estimate_hours: 2 });
    await request(app).post('/api/todos').send({ project_id: proj.id, title: 'B', estimate_hours: 3 });
    await request(app).put(`/api/todos/${t1.body.id}`).send({ status: 'done' });

    const projects = await request(app).get('/api/projects');
    const p = projects.body.find((x: any) => x.name === 'Agg');
    expect(p.done_count).toBe(1);
    expect(p.todo_count).toBe(2);
    expect(p.total_estimate_hours).toBe(5);
  });
});
