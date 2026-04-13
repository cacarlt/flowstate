import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes('/api/config')) {
      return { ok: true, status: 200, json: async () => ({ profileName: 'Work', profileColor: '#3b82f6', integrations: ['ado'] }) };
    }
    if (url.includes('/api/myday')) {
      return { ok: true, status: 200, json: async () => ({ dueTasks: [], scheduledToday: [], inProgress: [], unscheduled: [], completedToday: [], activeSessions: [], stats: { totalDue: 0, totalInProgress: 0, totalCompletedToday: 0, totalActiveSessions: 0 } }) };
    }
    return { ok: true, status: 200, json: async () => [] };
  });
});

describe('App', () => {
  it('renders the header', () => {
    render(<App />);
    expect(screen.getByText('FlowState')).toBeInTheDocument();
  });

  it('renders all three tab buttons', async () => {
    render(<App />);
    // Wait for config to load and tabs to render
    expect(await screen.findByText('My Tasks')).toBeInTheDocument();
    expect(screen.getByText('ADO Items')).toBeInTheDocument();
    expect(screen.getByText('Copilot Sessions')).toBeInTheDocument();
  });

  it('starts on My Day tab', async () => {
    render(<App />);
    expect(await screen.findByText(/My Day/)).toBeInTheDocument();
  });

  it('switches to ADO tab', async () => {
    render(<App />);
    const user = userEvent.setup();
    const adoTab = await screen.findByText('ADO Items');
    await user.click(adoTab);
    expect(screen.getByRole('button', { name: /Sync/ })).toBeInTheDocument();
  });

  it('switches to Sessions tab', async () => {
    render(<App />);
    const user = userEvent.setup();
    const sessionsTab = await screen.findByText('Copilot Sessions');
    await user.click(sessionsTab);
    expect(screen.getByRole('button', { name: /Log Session/ })).toBeInTheDocument();
  });
});
