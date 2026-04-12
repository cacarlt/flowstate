import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';

const app = createApp();

describe('Config API', () => {
  it('GET /api/config returns profile info', async () => {
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('profileName');
    expect(res.body).toHaveProperty('profileColor');
    expect(res.body).toHaveProperty('integrations');
    expect(Array.isArray(res.body.integrations)).toBe(true);
  });
});
