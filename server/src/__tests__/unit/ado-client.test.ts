import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateWorkItemState,
  updateWorkItem,
  createWorkItem,
  addComment,
  getComments,
  getWorkItem,
  getWorkItemTypes,
  getTeamMembers,
  AdoClientError,
} from '../../ado/client';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

beforeEach(() => {
  vi.stubEnv('ADO_PAT', 'test-pat');
  vi.stubEnv('ADO_ORG', 'TestOrg');
  vi.stubEnv('ADO_PROJECT', 'TestProject');
  mockFetch.mockReset();
});

function mockOk(data: any) {
  return { ok: true, status: 200, json: () => Promise.resolve(data), text: () => Promise.resolve(JSON.stringify(data)) };
}

function mockCreated(data: any) {
  return { ok: true, status: 200, json: () => Promise.resolve(data), text: () => Promise.resolve(JSON.stringify(data)) };
}

function mockError(status: number, message: string) {
  return { ok: false, status, json: () => Promise.resolve({ error: message }), text: () => Promise.resolve(message) };
}

const sampleWorkItem = {
  id: 12345,
  fields: {
    'System.Title': 'Test PBI',
    'System.WorkItemType': 'Product Backlog Item',
    'System.State': 'Active',
    'System.AssignedTo': { displayName: 'Test User' },
    'System.IterationPath': 'TestProject\\Sprint 1',
  },
  _links: { html: { href: 'https://dev.azure.com/TestOrg/TestProject/_workitems/edit/12345' } },
};

describe('ADO Client - updateWorkItemState', () => {
  it('sends PATCH with correct JSON Patch body', async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ ...sampleWorkItem, fields: { ...sampleWorkItem.fields, 'System.State': 'Resolved' } }));

    const result = await updateWorkItemState(12345, 'Resolved');
    expect(result.fields['System.State']).toBe('Resolved');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/wit/workitems/12345');
    expect(opts.method).toBe('PATCH');
    expect(opts.headers['Content-Type']).toBe('application/json-patch+json');
    const body = JSON.parse(opts.body);
    expect(body).toEqual([{ op: 'add', path: '/fields/System.State', value: 'Resolved' }]);
  });

  it('throws AdoClientError when not configured', async () => {
    vi.stubEnv('ADO_PAT', '');
    await expect(updateWorkItemState(12345, 'Active')).rejects.toThrow(AdoClientError);
  });

  it('throws AdoClientError on API failure', async () => {
    mockFetch.mockResolvedValueOnce(mockError(404, 'Not found'));
    await expect(updateWorkItemState(99999, 'Active')).rejects.toThrow(AdoClientError);
  });
});

describe('ADO Client - updateWorkItem', () => {
  it('sends PATCH with multiple fields', async () => {
    mockFetch.mockResolvedValueOnce(mockOk(sampleWorkItem));

    await updateWorkItem(12345, { title: 'New Title', assignedTo: 'someone@example.com' });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual({ op: 'add', path: '/fields/System.Title', value: 'New Title' });
    expect(body[1]).toEqual({ op: 'add', path: '/fields/System.AssignedTo', value: 'someone@example.com' });
  });

  it('throws when no fields provided', async () => {
    await expect(updateWorkItem(12345, {})).rejects.toThrow('No fields to update');
  });
});

describe('ADO Client - createWorkItem', () => {
  it('creates with type and fields', async () => {
    mockFetch.mockResolvedValueOnce(mockCreated(sampleWorkItem));

    await createWorkItem('Product Backlog Item', { title: 'New PBI' });

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('$Product%20Backlog%20Item');
    expect(opts.method).toBe('POST');
  });

  it('includes parent link when parentId provided', async () => {
    mockFetch.mockResolvedValueOnce(mockCreated(sampleWorkItem));

    await createWorkItem('Task', { title: 'Child Task' }, 100);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const relationPatch = body.find((p: any) => p.path === '/relations/-');
    expect(relationPatch).toBeDefined();
    expect(relationPatch.value.rel).toBe('System.LinkTypes.Hierarchy-Reverse');
  });
});

describe('ADO Client - comments', () => {
  it('addComment sends POST with text', async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ id: 1, text: 'Hello' }));

    const result = await addComment(12345, 'Hello');
    expect(result.text).toBe('Hello');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/comments');
    expect(opts.method).toBe('POST');
  });

  it('getComments fetches from correct URL', async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ comments: [{ id: 1, text: 'Test' }] }));

    const result = await getComments(12345);
    expect(result.comments).toHaveLength(1);
  });
});

describe('ADO Client - getWorkItem', () => {
  it('fetches with $expand=all', async () => {
    mockFetch.mockResolvedValueOnce(mockOk(sampleWorkItem));

    const result = await getWorkItem(12345);
    expect(result.id).toBe(12345);
    expect(mockFetch.mock.calls[0][0]).toContain('$expand=all');
  });
});

describe('ADO Client - getWorkItemTypes', () => {
  it('returns list of types', async () => {
    mockFetch.mockResolvedValueOnce(mockOk({ value: [{ name: 'Bug' }, { name: 'Task' }] }));

    const result = await getWorkItemTypes();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Bug');
  });
});

describe('ADO Client - getTeamMembers', () => {
  it('returns mapped team members', async () => {
    mockFetch.mockResolvedValueOnce(mockOk({
      value: [{ identity: { id: '1', displayName: 'User 1', uniqueName: 'user1@test.com', imageUrl: 'http://img' } }]
    }));

    const result = await getTeamMembers();
    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe('User 1');
    expect(result[0].uniqueName).toBe('user1@test.com');
  });
});
