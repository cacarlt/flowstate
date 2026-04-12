import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  // Default: return empty arrays for initial loads
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => [],
  });
});

describe('App', () => {
  it('renders the header', () => {
    render(<App />);
    expect(screen.getByText('FlowState')).toBeInTheDocument();
  });

  it('renders all three tab buttons', () => {
    render(<App />);
    expect(screen.getByText('My Tasks')).toBeInTheDocument();
    expect(screen.getByText('ADO Items')).toBeInTheDocument();
    expect(screen.getByText('Copilot Sessions')).toBeInTheDocument();
  });

  it('starts on Tasks tab', () => {
    render(<App />);
    expect(screen.getByText(/New Project/)).toBeInTheDocument();
  });

  it('switches to ADO tab', async () => {
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByText('ADO Items'));
    expect(screen.getByRole('button', { name: /Sync from ADO/ })).toBeInTheDocument();
  });

  it('switches to Sessions tab', async () => {
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByText('Copilot Sessions'));
    expect(screen.getByText(/Log Session/)).toBeInTheDocument();
  });
});
