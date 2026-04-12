import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionsView from '../components/SessionsView';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => [] });
});

describe('SessionsView', () => {
  it('shows empty state', async () => {
    render(<SessionsView />);
    await waitFor(() => {
      expect(screen.getByText(/No Copilot sessions logged/)).toBeInTheDocument();
    });
  });

  it('shows form when Log Session clicked', async () => {
    render(<SessionsView />);
    const user = userEvent.setup();
    await user.click(screen.getByText(/Log Session/));
    expect(screen.getByPlaceholderText(/What were you working on/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Session URL (optional)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Session ID (optional)')).toBeInTheDocument();
  });

  it('renders sessions list', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => [{
        id: 1, notes: 'Fixed auth bug', session_url: 'https://example.com/s/1',
        session_id: 'abc', repo: 'my-repo', branch: 'main', created_at: '2026-04-01T00:00:00Z',
      }],
    });
    render(<SessionsView />);
    await waitFor(() => {
      expect(screen.getByText('Fixed auth bug')).toBeInTheDocument();
      expect(screen.getByText('Open session →')).toBeInTheDocument();
      expect(screen.getByText('📁 my-repo/main')).toBeInTheDocument();
    });
  });
});
