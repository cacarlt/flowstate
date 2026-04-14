/**
 * ADO REST API client — handles all write-back operations to Azure DevOps.
 * Centralizes auth, JSON Patch formatting, and error handling.
 */

const ADO_ORG = () => process.env.ADO_ORG || 'IdentityDivision';
const ADO_PROJECT = () => process.env.ADO_PROJECT || 'Engineering';
const ADO_PAT = () => process.env.ADO_PAT || '';

function headers(contentType = 'application/json') {
  const token = Buffer.from(`:${ADO_PAT()}`).toString('base64');
  return {
    'Authorization': `Basic ${token}`,
    'Content-Type': contentType,
  };
}

function baseUrl() {
  return `https://dev.azure.com/${ADO_ORG()}/${ADO_PROJECT()}/_apis`;
}

function ensureConfigured() {
  if (!ADO_PAT() || !ADO_ORG() || !ADO_PROJECT()) {
    throw new AdoClientError('ADO_PAT, ADO_ORG, and ADO_PROJECT env vars required', 400);
  }
}

export class AdoClientError extends Error {
  constructor(message: string, public statusCode: number = 500, public details?: any) {
    super(message);
    this.name = 'AdoClientError';
  }
}

async function adoFetch(url: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...options,
    headers: { ...headers(options.headers?.['Content-Type' as keyof HeadersInit] as string || 'application/json'), ...options.headers as any },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new AdoClientError(`ADO API error: ${res.status} ${text}`, res.status, text);
  }
  if (res.status === 204) return null;
  return res.json();
}

// JSON Patch helper for work item updates
function buildJsonPatch(fields: Record<string, any>): { op: string; path: string; value: any }[] {
  const fieldMap: Record<string, string> = {
    title: '/fields/System.Title',
    description: '/fields/System.Description',
    state: '/fields/System.State',
    assignedTo: '/fields/System.AssignedTo',
    areaPath: '/fields/System.AreaPath',
    iterationPath: '/fields/System.IterationPath',
    priority: '/fields/Microsoft.VSTS.Common.Priority',
    effort: '/fields/Microsoft.VSTS.Scheduling.Effort',
    tags: '/fields/System.Tags',
  };

  return Object.entries(fields)
    .filter(([_, v]) => v !== undefined)
    .map(([key, value]) => ({
      op: 'add',
      path: fieldMap[key] || `/fields/${key}`,
      value,
    }));
}

/** Update a work item's state */
export async function updateWorkItemState(workItemId: number, state: string): Promise<any> {
  ensureConfigured();
  return adoFetch(
    `${baseUrl()}/wit/workitems/${workItemId}?api-version=7.1`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json-patch+json' },
      body: JSON.stringify([{ op: 'add', path: '/fields/System.State', value: state }]),
    }
  );
}

/** Update work item fields (title, description, assignedTo, etc.) */
export async function updateWorkItem(workItemId: number, fields: Record<string, any>): Promise<any> {
  ensureConfigured();
  const patch = buildJsonPatch(fields);
  if (patch.length === 0) throw new AdoClientError('No fields to update', 400);
  return adoFetch(
    `${baseUrl()}/wit/workitems/${workItemId}?api-version=7.1`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json-patch+json' },
      body: JSON.stringify(patch),
    }
  );
}

/** Create a new work item in ADO */
export async function createWorkItem(
  type: string,
  fields: Record<string, any>,
  parentId?: number
): Promise<any> {
  ensureConfigured();
  const patch = buildJsonPatch(fields);

  if (parentId) {
    patch.push({
      op: 'add',
      path: '/relations/-',
      value: {
        rel: 'System.LinkTypes.Hierarchy-Reverse',
        url: `${baseUrl()}/wit/workitems/${parentId}`,
        attributes: { name: 'Parent' },
      },
    });
  }

  const encodedType = encodeURIComponent(type);
  return adoFetch(
    `${baseUrl()}/wit/workitems/$${encodedType}?api-version=7.1`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json-patch+json' },
      body: JSON.stringify(patch),
    }
  );
}

/** Add a comment to a work item */
export async function addComment(workItemId: number, text: string): Promise<any> {
  ensureConfigured();
  return adoFetch(
    `${baseUrl()}/wit/workitems/${workItemId}/comments?api-version=7.1-preview.4`,
    {
      method: 'POST',
      body: JSON.stringify({ text }),
    }
  );
}

/** Get comments for a work item */
export async function getComments(workItemId: number): Promise<any> {
  ensureConfigured();
  return adoFetch(
    `${baseUrl()}/wit/workitems/${workItemId}/comments?api-version=7.1-preview.4`
  );
}

/** Get a single work item with all fields */
export async function getWorkItem(workItemId: number): Promise<any> {
  ensureConfigured();
  return adoFetch(
    `${baseUrl()}/wit/workitems/${workItemId}?$expand=all&api-version=7.1`
  );
}

/** Get available work item types for the project */
export async function getWorkItemTypes(): Promise<any[]> {
  ensureConfigured();
  const data = await adoFetch(
    `${baseUrl()}/wit/workitemtypes?api-version=7.1`
  );
  return data.value || [];
}

/** Get team members for assignment */
export async function getTeamMembers(team?: string): Promise<any[]> {
  ensureConfigured();
  const teamName = team || `${ADO_PROJECT()} Team`;
  const encodedTeam = encodeURIComponent(teamName);
  const data = await adoFetch(
    `https://dev.azure.com/${ADO_ORG()}/_apis/projects/${ADO_PROJECT()}/teams/${encodedTeam}/members?api-version=7.1`
  );
  return (data.value || []).map((m: any) => ({
    id: m.identity?.id,
    displayName: m.identity?.displayName,
    uniqueName: m.identity?.uniqueName,
    imageUrl: m.identity?.imageUrl,
  }));
}

/** Get iterations (sprints) for the project */
export async function getIterations(): Promise<any[]> {
  ensureConfigured();
  const data = await adoFetch(
    `${baseUrl()}/work/teamsettings/iterations?api-version=7.1`
  );
  return data.value || [];
}

/** Get area paths for the project */
export async function getAreaPaths(): Promise<any> {
  ensureConfigured();
  return adoFetch(
    `${baseUrl()}/wit/classificationnodes/Areas?$depth=3&api-version=7.1`
  );
}
