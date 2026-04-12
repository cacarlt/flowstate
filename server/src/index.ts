import path from 'path';
import { initDb } from './db';
import { createApp } from './app';

const PORT = process.env.PORT || 3001;

async function start() {
  await initDb();

  const app = createApp();

  // Serve static client build in production
  // Docker puts build in /app/client-dist; local dev uses ../client/dist relative to server/
  const clientDist = process.env.CLIENT_DIST_PATH
    || (process.env.NODE_ENV === 'production'
      ? path.join(__dirname, '..', 'client-dist')
      : path.join(__dirname, '..', '..', 'client', 'dist'));
  const express = require('express');
  app.use(express.static(clientDist));
  app.get('*', (_req: any, res: any) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
