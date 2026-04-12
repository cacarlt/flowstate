import { beforeEach } from 'vitest';
import { initDb, resetForTest } from '../db';

// Use in-memory DB for all tests
process.env.DB_PATH = ':memory:';

beforeEach(async () => {
  resetForTest();
  await initDb();
});
