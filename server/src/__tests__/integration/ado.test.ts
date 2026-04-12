import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

const app = createApp();

describe('ADO API (local storage)', () => {
  it('GET /api/ado/items returns empty initially', async () => {
    const res = await request(app).get('/api/ado/items');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/ado/sync returns error without PAT', async () => {
    // ADO_PAT is not set in test environment, so sync should fail gracefully
    const res = await request(app).post('/api/ado/sync');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ADO_PAT/);
  });

  it('GET /api/ado/current-sprint returns error without config', async () => {
    const res = await request(app).get('/api/ado/current-sprint');
    expect(res.status).toBe(400);
  });
});

describe('Todo-ADO linking', () => {
  it('links and unlinks an ADO item to a todo', async () => {
    // Create project + todo
    const proj = await request(app).post('/api/projects').send({ name: 'Link Test' });
    const todo = await request(app).post('/api/todos').send({ project_id: proj.body.id, title: 'Task' });

    // Manually insert an ADO item (simulating sync)
    const { run } = await import('../../db');
    run(
      'INSERT INTO ado_items (ado_work_item_id, type, url, title, sprint_name, state) VALUES (?, ?, ?, ?, ?, ?)',
      [12345, 'Product Backlog Item', 'https://dev.azure.com/test/12345', 'PBI Title', 'Sprint 1', 'Active']
    );
    const adoItems = await request(app).get('/api/ado/items');
    const adoItem = adoItems.body[0];

    // Link
    const link = await request(app).post(`/api/todos/${todo.body.id}/ado-link`).send({ ado_item_id: adoItem.id });
    expect(link.status).toBe(201);

    // Unlink
    const unlink = await request(app).delete(`/api/todos/${todo.body.id}/ado-link/${adoItem.id}`);
    expect(unlink.status).toBe(204);
  });
});

describe('Todo-Session linking', () => {
  it('links and unlinks a session to a todo', async () => {
    const proj = await request(app).post('/api/projects').send({ name: 'Session Link' });
    const todo = await request(app).post('/api/todos').send({ project_id: proj.body.id, title: 'Task' });
    const session = await request(app).post('/api/sessions').send({ notes: 'My session' });

    // Link
    const link = await request(app)
      .post(`/api/todos/${todo.body.id}/session-link`)
      .send({ session_id: session.body.id });
    expect(link.status).toBe(201);

    // Unlink
    const unlink = await request(app).delete(`/api/todos/${todo.body.id}/session-link/${session.body.id}`);
    expect(unlink.status).toBe(204);
  });
});
