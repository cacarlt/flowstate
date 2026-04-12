const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  // Projects
  getProjects: () => request<any[]>('/projects'),
  createProject: (data: { name: string; due_date?: string }) =>
    request<any>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: number, data: any) =>
    request<any>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: number) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),

  // Todos
  getTodos: (projectId?: number) =>
    request<any[]>(`/todos${projectId ? `?project_id=${projectId}` : ''}`),
  createTodo: (data: { project_id: number; title: string; estimate_hours?: number; due_date?: string }) =>
    request<any>('/todos', { method: 'POST', body: JSON.stringify(data) }),
  updateTodo: (id: number, data: any) =>
    request<any>(`/todos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTodo: (id: number) =>
    request<void>(`/todos/${id}`, { method: 'DELETE' }),
  getTodoSessions: (todoId: number) =>
    request<any[]>(`/todos/${todoId}/sessions`),
  linkAdoItem: (todoId: number, adoItemId: number) =>
    request<any>(`/todos/${todoId}/ado-link`, { method: 'POST', body: JSON.stringify({ ado_item_id: adoItemId }) }),
  linkSession: (todoId: number, sessionId: number) =>
    request<any>(`/todos/${todoId}/session-link`, { method: 'POST', body: JSON.stringify({ session_id: sessionId }) }),

  // ADO
  getAdoItems: () => request<any[]>('/ado/items'),
  syncAdo: () => request<any>('/ado/sync', { method: 'POST' }),
  getCurrentSprint: () => request<any>('/ado/current-sprint'),
  getAdoPatStatus: () => request<any>('/ado/pat-status'),

  // GitHub
  getGithubIssues: () => request<any[]>('/github/issues'),
  syncGithub: () => request<any>('/github/sync', { method: 'POST' }),

  // Config
  getConfig: () => request<{ profileName: string; profileColor: string; integrations: string[] }>('/config'),

  // My Day
  getMyDay: () => request<any>('/myday'),

  // Copilot sessions
  getSessions: () => request<any[]>('/sessions'),
  createSession: (data: { notes: string; task_prompt?: string; session_url?: string; session_id?: string; repo?: string; branch?: string; project_id?: number; todo_id?: number; status?: string }) =>
    request<any>('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  updateSession: (id: number, data: any) =>
    request<any>(`/sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  launchSession: (id: number) =>
    request<any>(`/sessions/${id}/launch`, { method: 'POST' }),
  deleteSession: (id: number) =>
    request<void>(`/sessions/${id}`, { method: 'DELETE' }),
};
