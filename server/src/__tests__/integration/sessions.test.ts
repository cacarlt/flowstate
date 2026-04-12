import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

const app = createApp();

describe('Sessions API', () => {
  it('GET /api/sessions returns empty initially', async () => {
    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/sessions creates a session', async () => {
    const res = await request(app).post('/api/sessions').send({
      notes: 'Working on auth module',
      session_url: 'https://example.com/session/123',
      session_id: 'abc-123',
      repo: 'best_todo_work',
      branch: 'main',
    });
    expect(res.status).toBe(201);
    expect(res.body.notes).toBe('Working on auth module');
    expect(res.body.session_url).toBe('https://example.com/session/123');
    expect(res.body.repo).toBe('best_todo_work');
  });

  it('POST /api/sessions rejects missing notes', async () => {
    const res = await request(app).post('/api/sessions').send({ session_url: 'http://x' });
    expect(res.status).toBe(400);
  });

  it('POST /api/sessions works with notes only', async () => {
    const res = await request(app).post('/api/sessions').send({ notes: 'Quick note' });
    expect(res.status).toBe(201);
    expect(res.body.session_url).toBeNull();
    expect(res.body.repo).toBeNull();
  });

  it('PUT /api/sessions/:id updates fields', async () => {
    const created = await request(app).post('/api/sessions').send({ notes: 'Original' });
    const res = await request(app)
      .put(`/api/sessions/${created.body.id}`)
      .send({ notes: 'Updated notes', branch: 'feature-x' });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('Updated notes');
    expect(res.body.branch).toBe('feature-x');
  });

  it('DELETE /api/sessions/:id removes a session', async () => {
    const created = await request(app).post('/api/sessions').send({ notes: 'Temp' });
    const del = await request(app).delete(`/api/sessions/${created.body.id}`);
    expect(del.status).toBe(204);

    const list = await request(app).get('/api/sessions');
    expect(list.body).toHaveLength(0);
  });

  it('sessions returned in reverse chronological order', async () => {
    await request(app).post('/api/sessions').send({ notes: 'First' });
    await request(app).post('/api/sessions').send({ notes: 'Second' });

    const res = await request(app).get('/api/sessions');
    expect(res.body[0].notes).toBe('Second');
    expect(res.body[1].notes).toBe('First');
  });
});
