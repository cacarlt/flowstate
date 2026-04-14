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
    const res = await request(app).post('/api/ado/sync');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ADO_PAT/);
  });

  it('GET /api/ado/current-sprint returns error without config', async () => {
    const res = await request(app).get('/api/ado/current-sprint');
    expect(res.status).toBe(400);
  });

  it('GET /api/ado/pat-status returns not_configured when no PAT', async () => {
    const res = await request(app).get('/api/ado/pat-status');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('not_configured');
    expect(res.body.organization).toBeTruthy();
  });
});

describe('ADO write-back endpoints (validation only)', () => {
  it('PATCH /api/ado/items/:id/state requires state field', async () => {
    const res = await request(app).patch('/api/ado/items/12345/state').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/state/i);
  });

  it('PATCH /api/ado/items/:id requires at least one field', async () => {
    const res = await request(app).patch('/api/ado/items/12345').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No fields/i);
  });

  it('POST /api/ado/items requires type and title', async () => {
    const res = await request(app).post('/api/ado/items').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type and title/i);
  });

  it('POST /api/ado/items requires title', async () => {
    const res = await request(app).post('/api/ado/items').send({ type: 'Bug' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/type and title/i);
  });

  it('POST /api/ado/items/:id/comments requires text', async () => {
    const res = await request(app).post('/api/ado/items/12345/comments').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/text/i);
  });

  it('GET /api/ado/work-item-types returns error without PAT', async () => {
    const res = await request(app).get('/api/ado/work-item-types');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ADO_PAT/);
  });

  it('GET /api/ado/team-members returns error without PAT', async () => {
    const res = await request(app).get('/api/ado/team-members');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ADO_PAT/);
  });

  it('GET /api/ado/iterations returns error without PAT', async () => {
    const res = await request(app).get('/api/ado/iterations');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ADO_PAT/);
  });

  it('GET /api/ado/area-paths returns error without PAT', async () => {
    const res = await request(app).get('/api/ado/area-paths');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ADO_PAT/);
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

  it('GET /api/todos/:id/ado-items returns linked ADO items', async () => {
    const proj = await request(app).post('/api/projects').send({ name: 'ADO Items Test' });
    const todo = await request(app).post('/api/todos').send({ project_id: proj.body.id, title: 'Task with ADO' });

    const { run } = await import('../../db');
    run(
      'INSERT INTO ado_items (ado_work_item_id, type, url, title, sprint_name, state) VALUES (?, ?, ?, ?, ?, ?)',
      [99999, 'Feature', 'https://dev.azure.com/test/99999', 'Feature Title', 'Sprint 2', 'Active']
    );
    const adoItems = await request(app).get('/api/ado/items');
    const adoItem = adoItems.body.find((i: any) => i.ado_work_item_id === 99999);

    // Before linking, should be empty
    const before = await request(app).get(`/api/todos/${todo.body.id}/ado-items`);
    expect(before.status).toBe(200);
    expect(before.body).toEqual([]);

    // Link
    await request(app).post(`/api/todos/${todo.body.id}/ado-link`).send({ ado_item_id: adoItem.id });

    // After linking, should contain the item
    const after = await request(app).get(`/api/todos/${todo.body.id}/ado-items`);
    expect(after.status).toBe(200);
    expect(after.body).toHaveLength(1);
    expect(after.body[0].ado_work_item_id).toBe(99999);
    expect(after.body[0].title).toBe('Feature Title');
  });

  it('todos include ado_link_count', async () => {
    const proj = await request(app).post('/api/projects').send({ name: 'Count Test' });
    const todo = await request(app).post('/api/todos').send({ project_id: proj.body.id, title: 'Counted Task' });

    const { run } = await import('../../db');
    run(
      'INSERT INTO ado_items (ado_work_item_id, type, url, title, sprint_name, state) VALUES (?, ?, ?, ?, ?, ?)',
      [77777, 'Product Backlog Item', 'https://dev.azure.com/test/77777', 'PBI', 'Sprint 1', 'New']
    );
    const adoItems = await request(app).get('/api/ado/items');
    const adoItem = adoItems.body.find((i: any) => i.ado_work_item_id === 77777);

    await request(app).post(`/api/todos/${todo.body.id}/ado-link`).send({ ado_item_id: adoItem.id });

    const todos = await request(app).get('/api/todos');
    const updated = todos.body.find((t: any) => t.id === todo.body.id);
    expect(updated.ado_link_count).toBe(1);
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
