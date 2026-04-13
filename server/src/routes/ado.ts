import { Router } from 'express';
import { all, run } from '../db';

export const adoRouter = Router();

const ADO_ORG = process.env.ADO_ORG || 'IdentityDivision';
const ADO_PROJECT = process.env.ADO_PROJECT || 'Engineering';
const ADO_PAT = process.env.ADO_PAT || '';
const ADO_PAT_AUTH_ID = process.env.ADO_PAT_AUTH_ID || '';
const ADO_PAT_NAME = process.env.ADO_PAT_NAME || '';
const ADO_PAT_ORG = process.env.ADO_PAT_ORG || ADO_ORG;

function adoHeaders() {
  const token = Buffer.from(`:${ADO_PAT}`).toString('base64');
  return {
    'Authorization': `Basic ${token}`,
    'Content-Type': 'application/json',
  };
}

function adoBaseUrl() {
  return `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_apis`;
}

// Get locally stored ADO items with linked project/todo info
adoRouter.get('/items', (_req, res) => {
  const items = all('SELECT * FROM ado_items ORDER BY sprint_name DESC, type, title');
  const todoLinks = all(`
    SELECT l.ado_item_id, t.id as todo_id, t.title as todo_title, p.name as project_name
    FROM todo_ado_links l
    JOIN todos t ON t.id = l.todo_id
    LEFT JOIN projects p ON p.id = t.project_id
  `);
  const projectLinks = all(`
    SELECT l.ado_item_id, p.id as project_id, p.name as project_name
    FROM project_ado_links l
    JOIN projects p ON p.id = l.project_id
  `);

  const todoLinkMap: Record<number, { todo_id: number; todo_title: string; project_name: string }[]> = {};
  for (const l of todoLinks as any[]) {
    if (!todoLinkMap[l.ado_item_id]) todoLinkMap[l.ado_item_id] = [];
    todoLinkMap[l.ado_item_id].push({ todo_id: l.todo_id, todo_title: l.todo_title, project_name: l.project_name });
  }
  const projectLinkMap: Record<number, { project_id: number; project_name: string }[]> = {};
  for (const l of projectLinks as any[]) {
    if (!projectLinkMap[l.ado_item_id]) projectLinkMap[l.ado_item_id] = [];
    projectLinkMap[l.ado_item_id].push({ project_id: l.project_id, project_name: l.project_name });
  }

  const enriched = (items as any[]).map((item) => ({
    ...item,
    linked_todos: todoLinkMap[item.id] || [],
    linked_projects: projectLinkMap[item.id] || [],
  }));

  res.json(enriched);
});

// Get PAT lifecycle status
adoRouter.get('/pat-status', async (_req, res) => {
  if (!ADO_PAT) {
    return res.json({
      status: 'not_configured',
      name: null,
      scopes: null,
      organization: ADO_PAT_ORG || null,
      expiresAt: null,
      daysRemaining: null,
      manageUrl: ADO_PAT_ORG ? `https://dev.azure.com/${ADO_PAT_ORG}/_usersSettings/tokens` : null,
    });
  }

  // If we have auth ID, try to get live status from the PAT lifecycle API
  if (ADO_PAT_AUTH_ID) {
    try {
      // Use the PAT itself to query the lifecycle API
      const token = Buffer.from(`:${ADO_PAT}`).toString('base64');
      const listRes = await fetch(
        `https://vssps.dev.azure.com/${ADO_PAT_ORG}/_apis/tokens/pats?api-version=7.1-preview.1`,
        { headers: { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json' } }
      );

      if (listRes.ok) {
        const data = await listRes.json() as { patTokens: any[] };
        const pat = (data.patTokens || []).find((p: any) => p.authorizationId === ADO_PAT_AUTH_ID);

        if (pat) {
          const validTo = new Date(pat.validTo);
          const now = new Date();
          const daysRemaining = (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

          return res.json({
            status: daysRemaining <= 0 ? 'expired' : daysRemaining <= 2 ? 'expiring_soon' : 'active',
            name: pat.displayName,
            scopes: pat.scope,
            organization: ADO_PAT_ORG,
            expiresAt: pat.validTo,
            daysRemaining: Math.max(0, Math.round(daysRemaining * 10) / 10),
            manageUrl: `https://dev.azure.com/${ADO_PAT_ORG}/_usersSettings/tokens`,
          });
        }
      }
    } catch (_) {
      // Fall through to basic info
    }
  }

  // Fallback: PAT is set but we can't query lifecycle — show as configured
  res.json({
    status: ADO_PAT_AUTH_ID ? 'unknown' : 'configured',
    name: ADO_PAT_NAME || null,
    scopes: null,
    organization: ADO_PAT_ORG || ADO_ORG,
    expiresAt: null,
    daysRemaining: null,
    manageUrl: `https://dev.azure.com/${ADO_PAT_ORG || ADO_ORG}/_usersSettings/tokens`,
  });
});

// Sync ADO items (pull PBIs and Features — assigned to me + unassigned)
adoRouter.post('/sync', async (_req, res) => {
  if (!ADO_PAT || !ADO_ORG || !ADO_PROJECT) {
    return res.status(400).json({ error: 'ADO_PAT, ADO_ORG, and ADO_PROJECT env vars required' });
  }

  try {
    // Query 1: Items assigned to me
    const myWiql = {
      query: `SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = @Me AND [System.WorkItemType] IN ('Product Backlog Item', 'Feature') AND [System.State] <> 'Closed' AND [System.State] <> 'Removed' ORDER BY [System.ChangedDate] DESC`
    };

    // Query 2: Unassigned items in the same project
    const unassignedWiql = {
      query: `SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = '' AND [System.WorkItemType] IN ('Product Backlog Item', 'Feature') AND [System.State] <> 'Closed' AND [System.State] <> 'Removed' ORDER BY [System.ChangedDate] DESC`
    };

    const [myRes, unRes] = await Promise.all([
      fetch(`${adoBaseUrl()}/wit/wiql?api-version=7.1`, {
        method: 'POST', headers: adoHeaders(), body: JSON.stringify(myWiql),
      }),
      fetch(`${adoBaseUrl()}/wit/wiql?api-version=7.1`, {
        method: 'POST', headers: adoHeaders(), body: JSON.stringify(unassignedWiql),
      }),
    ]);

    if (!myRes.ok) {
      const text = await myRes.text();
      return res.status(myRes.status).json({ error: `ADO WIQL failed: ${text}` });
    }

    const myData = await myRes.json() as { workItems: { id: number }[] };
    const unData = unRes.ok ? await unRes.json() as { workItems: { id: number }[] } : { workItems: [] };

    const idSet = new Set<number>();
    for (const wi of [...myData.workItems, ...unData.workItems]) { idSet.add(wi.id); }
    const ids = [...idSet];

    if (ids.length === 0) {
      return res.json({ synced: 0, items: [] });
    }

    // Fetch details in batches of 200
    let synced = 0;
    for (let i = 0; i < ids.length; i += 200) {
      const batch = ids.slice(i, i + 200);
      const detailRes = await fetch(`${adoBaseUrl()}/wit/workitems?ids=${batch.join(',')}&fields=System.Id,System.Title,System.WorkItemType,System.State,System.AssignedTo,System.IterationPath&api-version=7.1`, {
        headers: adoHeaders(),
      });

      if (!detailRes.ok) continue;
      const detailData = await detailRes.json() as { value: any[] };

      for (const wi of detailData.value) {
        const f = wi.fields;
        const url = `https://dev.azure.com/${ADO_ORG}/${ADO_PROJECT}/_workitems/edit/${wi.id}`;
        const sprintParts = (f['System.IterationPath'] || '').split('\\');
        const sprintName = sprintParts[sprintParts.length - 1] || null;

        // Check if exists
        const existing = all('SELECT id FROM ado_items WHERE ado_work_item_id = ?', [wi.id]);
        if (existing.length > 0) {
          run(
            `UPDATE ado_items SET type=?, url=?, title=?, sprint_name=?, state=?, assigned_to=?, last_synced_at=datetime('now') WHERE ado_work_item_id=?`,
            [f['System.WorkItemType'], url, f['System.Title'], sprintName, f['System.State'], f['System.AssignedTo']?.displayName || null, wi.id]
          );
        } else {
          run(
            `INSERT INTO ado_items (ado_work_item_id, type, url, title, sprint_name, state, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [wi.id, f['System.WorkItemType'], url, f['System.Title'], sprintName, f['System.State'], f['System.AssignedTo']?.displayName || null]
          );
        }
        synced++;
      }
    }

    const items = all('SELECT * FROM ado_items ORDER BY sprint_name DESC, type, title');
    res.json({ synced, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get current sprint info
adoRouter.get('/current-sprint', async (_req, res) => {
  if (!ADO_PAT || !ADO_ORG || !ADO_PROJECT) {
    return res.status(400).json({ error: 'ADO env vars required' });
  }

  try {
    const teamRes = await fetch(
      `${adoBaseUrl()}/work/teamsettings/iterations?$timeframe=current&api-version=7.1`,
      { headers: adoHeaders() }
    );
    if (!teamRes.ok) {
      return res.status(teamRes.status).json({ error: 'Failed to fetch sprint' });
    }
    const data = await teamRes.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a locally stored ADO item
adoRouter.delete('/items/:id', (req, res) => {
  run('DELETE FROM ado_items WHERE id = ?', [req.params.id]);
  res.status(204).end();
});
