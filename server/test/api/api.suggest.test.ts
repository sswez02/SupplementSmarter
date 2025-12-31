import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('Suggest endpoints', () => {
  it('GET /api/protein/suggest returns [] when q is missing', async () => {
    const res = await request(app).get('/api/protein/suggest');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/creatine/suggest returns [] when q is missing', async () => {
    const res = await request(app).get('/api/creatine/suggest');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/supplements/suggest returns [] when q is missing', async () => {
    const res = await request(app).get('/api/supplements/suggest');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  const runDb = process.env.RUN_DB_TESTS === '1';

  (runDb ? it : it.skip)('GET /api/protein/suggest?q=gold returns array', async () => {
    const res = await request(app).get('/api/protein/suggest?q=gold');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('product_id');
      expect(res.body[0]).toHaveProperty('name');
    }
  });
});
