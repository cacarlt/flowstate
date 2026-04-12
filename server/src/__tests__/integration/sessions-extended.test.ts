import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

const app = createApp();

describe('Sessions API (extended)', () => {
  async function createProjectAndTodo() {
    const proj = await request(app).post('/api/projects').send({ name: 'Session Test' });
    const todo = await request(app).post('/api/todos').send({ project_id: proj.body.id, title: 'Task' });
    return { projId: proj.body.id, todoId: todo.body.id };
  }

  it('POST /api/sessions links to project and todo', async () => {
    const { projId, todoId } = await createProjectAndTodo();
    const res = await request(app).post('/api/sessions').send({
      notes: 'Linked session',
      project_id: projId,
      todo_id: todoId,
      repo: 'my-repo',
      task_prompt: 'Fix the bug',
    });
    expect(res.status).toBe(201);
    expect(res.body.project_name).toBe('Session Test');
    expect(res.body.todo_title).toBe('Task');
    expect(res.body.task_prompt).toBe('Fix the bug');
    expect(res.body.status).toBe('logged');
  });

  it('POST /api/sessions/:id/launch marks as launched', async () => {
    const session = await request(app).post('/api/sessions').send({ notes: 'Launch test' });
    const res = await request(app).post(`/api/sessions/${session.body.id}/launch`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('launched');
  });

  it('PUT /api/sessions/:id updates status', async () => {
    const session = await request(app).post('/api/sessions').send({ notes: 'Status test' });
    await request(app).post(`/api/sessions/${session.body.id}/launch`);
    const res = await request(app).put(`/api/sessions/${session.body.id}`).send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  it('GET /api/todos/:id/sessions returns linked sessions', async () => {
    const { projId, todoId } = await createProjectAndTodo();
    await request(app).post('/api/sessions').send({ notes: 'Session A', todo_id: todoId });
    await request(app).post('/api/sessions').send({ notes: 'Session B', todo_id: todoId });
    await request(app).post('/api/sessions').send({ notes: 'Unlinked session' });

    const res = await request(app).get(`/api/todos/${todoId}/sessions`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((s: any) => s.notes).sort()).toEqual(['Session A', 'Session B']);
  });

  it('GET /api/todos includes session_count', async () => {
    const { projId, todoId } = await createProjectAndTodo();
    await request(app).post('/api/sessions').send({ notes: 'S1', todo_id: todoId });
    await request(app).post('/api/sessions').send({ notes: 'S2', todo_id: todoId });

    const res = await request(app).get(`/api/todos?project_id=${projId}`);
    expect(res.body[0].session_count).toBe(2);
  });

  it('POST /api/sessions/:id/logs stores log lines', async () => {
    const session = await request(app).post('/api/sessions').send({ notes: 'Log test' });
    const res = await request(app)
      .post(`/api/sessions/${session.body.id}/logs`)
      .send({ lines: ['line 1', 'line 2', 'line 3'] });
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(3);
  });

  it('GET /api/sessions/:id/logs retrieves stored logs', async () => {
    const session = await request(app).post('/api/sessions').send({ notes: 'Log read test' });
    await request(app).post(`/api/sessions/${session.body.id}/logs`).send({ lines: ['hello', 'world'] });

    const res = await request(app).get(`/api/sessions/${session.body.id}/logs`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].line).toBe('hello');
    expect(res.body[1].line).toBe('world');
  });

  it('POST /api/sessions/:id/logs rejects missing lines', async () => {
    const session = await request(app).post('/api/sessions').send({ notes: 'Bad log' });
    const res = await request(app).post(`/api/sessions/${session.body.id}/logs`).send({});
    expect(res.status).toBe(400);
  });

  it('DELETE /api/sessions/:id cascades to logs', async () => {
    const session = await request(app).post('/api/sessions').send({ notes: 'Cascade log' });
    await request(app).post(`/api/sessions/${session.body.id}/logs`).send({ lines: ['test'] });
    await request(app).delete(`/api/sessions/${session.body.id}`);

    const logs = await request(app).get(`/api/sessions/${session.body.id}/logs`);
    expect(logs.body).toHaveLength(0);
  });
});
