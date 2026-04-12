import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

const app = createApp();

describe('GitHub API', () => {
  it('GET /api/github/items returns empty initially', async () => {
    const res = await request(app).get('/api/github/items');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/github/sync returns error without token', async () => {
    const res = await request(app).post('/api/github/sync');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/GITHUB_TOKEN/);
  });
});

describe('Metrics endpoint', () => {
  it('GET /metrics returns prometheus format', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('todo_app_');
    expect(res.headers['content-type']).toContain('text/plain');
  });
});
