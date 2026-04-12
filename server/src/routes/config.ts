import { Router } from 'express';

export const configRouter = Router();

configRouter.get('/', (_req, res) => {
  const integrations = (process.env.INTEGRATIONS || 'ado').split(',').map(s => s.trim().toLowerCase());
  res.json({
    profileName: process.env.PROFILE_NAME || 'Work',
    profileColor: process.env.PROFILE_COLOR || '#6366f1',
    integrations,
  });
});
