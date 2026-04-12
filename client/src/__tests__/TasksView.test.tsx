import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TasksView from '../components/TasksView';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockApi(responses: Record<string, any>) {
  mockFetch.mockImplementation(async (url: string, opts?: any) => {
    const path = url.replace('/api', '');
    const method = opts?.method || 'GET';

    for (const [pattern, response] of Object.entries(responses)) {
      const [m, p] = pattern.split(' ');
      if (m === method && path.startsWith(p)) {
        return {
          ok: true,
          status: response.status || 200,
          json: async () => response.body,
        };
      }
    }
    return { ok: true, status: 200, json: async () => [] };
  });
}

describe('TasksView', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('shows empty state when no projects', async () => {
    mockApi({
      'GET /projects': { body: [] },
      'GET /todos': { body: [] },
    });
    render(<TasksView />);
    await waitFor(() => {
      expect(screen.getByText(/No projects yet/)).toBeInTheDocument();
    });
  });

  it('shows new project form when button clicked', async () => {
    mockApi({
      'GET /projects': { body: [] },
      'GET /todos': { body: [] },
    });
    render(<TasksView />);
    const user = userEvent.setup();
    await user.click(screen.getByText(/New Project/));
    expect(screen.getByPlaceholderText('Project name')).toBeInTheDocument();
  });

  it('renders projects with stats', async () => {
    mockApi({
      'GET /projects': {
        body: [{
          id: 1, name: 'My Project', due_date: '2026-05-01', collapsed: 0,
          sort_order: 0, created_at: '', updated_at: '',
          total_estimate_hours: 8, todo_count: 3, done_count: 1,
        }],
      },
      'GET /todos': { body: [] },
    });
    render(<TasksView />);
    await waitFor(() => {
      expect(screen.getByText('My Project')).toBeInTheDocument();
      expect(screen.getByText('1/3 tasks')).toBeInTheDocument();
      expect(screen.getByText('⏱ 8h')).toBeInTheDocument();
    });
  });

  it('expands project to show todos', async () => {
    mockApi({
      'GET /projects': {
        body: [{
          id: 1, name: 'Proj', due_date: null, collapsed: 0,
          sort_order: 0, created_at: '', updated_at: '',
          total_estimate_hours: 4, todo_count: 1, done_count: 0,
        }],
      },
      'GET /todos': {
        body: [{
          id: 1, project_id: 1, title: 'Build feature', estimate_hours: 4,
          due_date: '2026-06-01', status: 'todo', sort_order: 0,
          created_at: '', updated_at: '',
        }],
      },
    });
    render(<TasksView />);
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText('Proj')).toBeInTheDocument());
    await user.click(screen.getByText('Proj'));

    await waitFor(() => {
      expect(screen.getByText('Build feature')).toBeInTheDocument();
      expect(screen.getByText(/Add task/)).toBeInTheDocument();
    });
  });

  it('filter buttons exist and are clickable', async () => {
    mockApi({
      'GET /projects': { body: [] },
      'GET /todos': { body: [] },
    });
    render(<TasksView />);
    const user = userEvent.setup();

    expect(screen.getByText('all')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('done')).toBeInTheDocument();

    await user.click(screen.getByText('active'));
    // Should not crash
  });

  it('expand all / collapse all buttons work', async () => {
    mockApi({
      'GET /projects': {
        body: [
          { id: 1, name: 'P1', due_date: null, collapsed: 0, sort_order: 0, created_at: '', updated_at: '', total_estimate_hours: 0, todo_count: 0, done_count: 0 },
          { id: 2, name: 'P2', due_date: null, collapsed: 0, sort_order: 0, created_at: '', updated_at: '', total_estimate_hours: 0, todo_count: 0, done_count: 0 },
        ],
      },
      'GET /todos': { body: [] },
    });
    render(<TasksView />);
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByText('Expand all')).toBeInTheDocument());
    await user.click(screen.getByText('Expand all'));
    // Both projects should show "No tasks yet" or "+ Add task"
    await waitFor(() => {
      const addButtons = screen.getAllByText(/Add task/);
      expect(addButtons).toHaveLength(2);
    });

    await user.click(screen.getByText('Collapse all'));
    await waitFor(() => {
      expect(screen.queryByText(/Add task/)).not.toBeInTheDocument();
    });
  });
});
