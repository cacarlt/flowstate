import { Router } from 'express';
import { all, get, run } from '../db';

export const githubRouter = Router();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || '';

function ghHeaders() {
  return {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// Get locally stored GitHub items
githubRouter.get('/items', (_req, res) => {
  try {
    const items = all('SELECT * FROM github_items ORDER BY repo, type, title');
    res.json(items);
  } catch (_) {
    // Table may not exist yet (created on first sync)
    res.json([]);
  }
});

// Sync GitHub issues and PRs assigned to me
githubRouter.post('/sync', async (_req, res) => {
  if (!GITHUB_TOKEN) {
    return res.status(400).json({ error: 'GITHUB_TOKEN env var required' });
  }

  try {
    // Ensure github_items table exists
    run(`CREATE TABLE IF NOT EXISTS github_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      github_id INTEGER NOT NULL UNIQUE,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      repo TEXT NOT NULL,
      state TEXT,
      labels TEXT,
      created_at_gh TEXT,
      updated_at_gh TEXT,
      last_synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`, []);

    let synced = 0;

    // Fetch issues assigned to me
    const issuesRes = await fetch(
      `https://api.github.com/issues?filter=assigned&state=open&per_page=100`,
      { headers: ghHeaders() }
    );

    if (issuesRes.ok) {
      const issues = await issuesRes.json() as any[];
      for (const issue of issues) {
        const type = issue.pull_request ? 'pull_request' : 'issue';
        const repo = issue.repository?.full_name || '';
        const labels = (issue.labels || []).map((l: any) => l.name).join(', ');

        const existing = all('SELECT id FROM github_items WHERE github_id = ?', [issue.id]);
        if (existing.length > 0) {
          run(
            `UPDATE github_items SET type=?, url=?, title=?, repo=?, state=?, labels=?, updated_at_gh=?, last_synced_at=datetime('now') WHERE github_id=?`,
            [type, issue.html_url, issue.title, repo, issue.state, labels, issue.updated_at, issue.id]
          );
        } else {
          run(
            `INSERT INTO github_items (github_id, type, url, title, repo, state, labels, created_at_gh, updated_at_gh) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [issue.id, type, issue.html_url, issue.title, repo, issue.state, labels, issue.created_at, issue.updated_at]
          );
        }
        synced++;
      }
    }

    const items = all('SELECT * FROM github_items ORDER BY repo, type, title');
    res.json({ synced, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a locally stored GitHub item
githubRouter.delete('/items/:id', (req, res) => {
  run('DELETE FROM github_items WHERE id = ?', [req.params.id]);
  res.status(204).end();
});
