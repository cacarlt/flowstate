import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { CopilotSession, Project, Todo } from '../types';
import { Plus, Bot, FolderGit2, Key, Clock, ExternalLink, X, Play, Terminal, CheckCircle, Circle, CircleDot, Ban, FolderKanban, ClipboardCopy, ScrollText } from 'lucide-react';

export default function SessionsView() {
  const [sessions, setSessions] = useState<CopilotSession[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [openLogs, setOpenLogs] = useState<Set<number>>(new Set());
  const [logLinesMap, setLogLinesMap] = useState<Record<number, string[]>>({});
  const [form, setForm] = useState({
    notes: '', task_prompt: '', session_url: '', session_id: '', repo: '', branch: '',
    project_id: '', todo_id: '',
  });
  const [copiedCmd, setCopiedCmd] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [s, p, t] = await Promise.all([api.getSessions(), api.getProjects(), api.getTodos()]);
    setSessions(s);
    setProjects(p);
    setTodos(t);
  }, []);

  useEffect(() => { load(); }, [load]);

  const logEndRef = useRef<HTMLDivElement>(null);
  const eventSources = useRef<Record<number, EventSource>>({});

  const toggleLogs = (sessionId: number) => {
    setOpenLogs((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
        eventSources.current[sessionId]?.close();
        delete eventSources.current[sessionId];
        setLogLinesMap((m) => { const copy = { ...m }; delete copy[sessionId]; return copy; });
      } else {
        next.add(sessionId);
        setLogLinesMap((m) => ({ ...m, [sessionId]: [] }));

        const es = new EventSource(`/api/sessions/${sessionId}/logs/stream`);
        es.onmessage = (event) => {
          const line = JSON.parse(event.data);
          setLogLinesMap((m) => ({ ...m, [sessionId]: [...(m[sessionId] || []), line] }));
        };
        eventSources.current[sessionId] = es;
      }
      return next;
    });
  };

  // Cleanup all SSE on unmount
  useEffect(() => {
    return () => {
      Object.values(eventSources.current).forEach((es) => es.close());
    };
  }, []);

  const addSession = async () => {
    if (!form.notes.trim()) return;
    await api.createSession({
      notes: form.notes.trim(),
      task_prompt: form.task_prompt || undefined,
      session_url: form.session_url || undefined,
      session_id: form.session_id || undefined,
      repo: form.repo || undefined,
      branch: form.branch || undefined,
      project_id: form.project_id ? parseInt(form.project_id) : undefined,
      todo_id: form.todo_id ? parseInt(form.todo_id) : undefined,
    });
    setForm({ notes: '', task_prompt: '', session_url: '', session_id: '', repo: '', branch: '', project_id: '', todo_id: '' });
    setShowForm(false);
    load();
  };

  const updateStatus = async (id: number, status: string) => {
    await api.updateSession(id, { status });
    load();
  };

  const deleteSession = async (id: number) => {
    await api.deleteSession(id);
    load();
  };

  const getLaunchCmd = (session: CopilotSession) => {
    const repo = session.repo || '.';
    const prompt = (session.task_prompt || session.notes).replace(/'/g, "''");
    const repoPath = repo.includes(':') || repo.startsWith('/') || repo === '.' ? repo : `$HOME\\agent-workspace\\${repo}`;
    return `Set-Location "${repoPath}" && agency copilot --prompt '${prompt}'`;
  };

  const launchSession = async (session: CopilotSession) => {
    const cmd = getLaunchCmd(session);
    await navigator.clipboard.writeText(cmd);
    setCopiedCmd(session.id);
    setTimeout(() => setCopiedCmd(null), 3000);
    try {
      await api.launchSession(session.id);
      load();
    } catch (_) {}
  };

  const copyCommand = (id: number, cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  // Filter todos by selected project
  const filteredTodos = form.project_id ? todos.filter(t => t.project_id === parseInt(form.project_id)) : todos;

  const statusIcon = (s: string) => {
    switch (s) {
      case 'launched': return <Play size={14} className="text-blue-500" />;
      case 'in_progress': return <CircleDot size={14} className="text-amber-500" />;
      case 'completed': return <CheckCircle size={14} className="text-green-500" />;
      case 'abandoned': return <Ban size={14} className="text-gray-400" />;
      default: return <Circle size={14} className="text-gray-400" />;
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'logged': return 'Logged';
      case 'launched': return 'Launched';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'abandoned': return 'Abandoned';
      default: return s;
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5"
        >
          <Plus size={16} /> Log Session
        </button>
        <span className="text-xs text-gray-400 dark:text-gray-500">{sessions.length} sessions</span>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4 shadow-sm space-y-3">
          {/* Link to project/task */}
          <div className="flex flex-wrap gap-3">
            <select
              value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value, todo_id: '' })}
              className="flex-1 min-w-[180px] border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Link to project (optional)</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              value={form.todo_id}
              onChange={(e) => setForm({ ...form, todo_id: e.target.value })}
              className="flex-1 min-w-[180px] border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Link to task (optional)</option>
              {filteredTodos.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>

          <textarea
            placeholder="What should this session accomplish?"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            autoFocus
          />

          <textarea
            placeholder="Task prompt for Copilot agent (optional — used when launching)"
            value={form.task_prompt}
            onChange={(e) => setForm({ ...form, task_prompt: e.target.value })}
            rows={2}
            className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-xs"
          />

          <div className="flex flex-wrap gap-3">
            <input
              placeholder="Repo path or name"
              value={form.repo}
              onChange={(e) => setForm({ ...form, repo: e.target.value })}
              className="flex-1 min-w-[150px] border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              placeholder="Branch (optional)"
              value={form.branch}
              onChange={(e) => setForm({ ...form, branch: e.target.value })}
              className="flex-1 min-w-[150px] border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              placeholder="Session URL (optional)"
              value={form.session_url}
              onChange={(e) => setForm({ ...form, session_url: e.target.value })}
              className="flex-1 min-w-[200px] border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              placeholder="Session ID (optional)"
              value={form.session_id}
              onChange={(e) => setForm({ ...form, session_id: e.target.value })}
              className="w-40 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={addSession} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
              Save
            </button>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {sessions.length === 0 && !showForm && (
        <div className="text-center text-gray-400 dark:text-gray-500 py-12">
          No Copilot sessions logged yet. Click "Log Session" to record one.
        </div>
      )}

      <div className="space-y-2">
        {sessions.map((session) => {
          const cmd = getLaunchCmd(session);
          return (
            <div key={session.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm group overflow-hidden">
              <div className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5">{statusIcon(session.status)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200">{session.notes}</p>

                    {/* Linked project/task */}
                    {(session.project_name || session.todo_title) && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-blue-500 dark:text-blue-400">
                        <FolderKanban size={12} />
                        {session.project_name && <span>{session.project_name}</span>}
                        {session.project_name && session.todo_title && <span>→</span>}
                        {session.todo_title && <span>{session.todo_title}</span>}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                      {session.repo && <span className="flex items-center gap-1"><FolderGit2 size={12} /> {session.repo}{session.branch ? `/${session.branch}` : ''}</span>}
                      {session.session_id && <span className="flex items-center gap-1"><Key size={12} /> {session.session_id}</span>}
                      <span className="flex items-center gap-1"><Clock size={12} /> {new Date(session.created_at).toLocaleDateString()}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        session.status === 'completed' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' :
                        session.status === 'launched' || session.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
                        session.status === 'abandoned' ? 'bg-gray-100 dark:bg-gray-800 text-gray-500' :
                        'bg-gray-100 dark:bg-gray-800 text-gray-500'
                      }`}>{statusLabel(session.status)}</span>
                    </div>

                    {session.session_url && (
                      <a
                        href={session.session_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-flex items-center gap-1"
                      >
                        Open session <ExternalLink size={10} />
                      </a>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* View logs */}
                    {(session.status === 'launched' || session.status === 'in_progress' || session.status === 'completed') && (
                      <button onClick={() => toggleLogs(session.id)} title="View logs" className={`p-1 rounded transition-colors ${openLogs.has(session.id) ? 'bg-purple-100 dark:bg-purple-900' : 'hover:bg-purple-50 dark:hover:bg-purple-950'}`}>
                        <ScrollText size={14} className="text-purple-500" />
                      </button>
                    )}
                    {/* Status cycle */}
                    {session.status === 'logged' && (
                      <button onClick={() => launchSession(session)} title="Copy command & mark launched" className="p-1 hover:bg-blue-50 dark:hover:bg-blue-950 rounded transition-colors">
                        <Play size={14} className="text-blue-500" />
                      </button>
                    )}
                    {session.status === 'launched' && (
                      <button onClick={() => updateStatus(session.id, 'in_progress')} title="Mark in progress" className="p-1 hover:bg-amber-50 dark:hover:bg-amber-950 rounded transition-colors">
                        <CircleDot size={14} className="text-amber-500" />
                      </button>
                    )}
                    {(session.status === 'launched' || session.status === 'in_progress') && (
                      <button onClick={() => updateStatus(session.id, 'completed')} title="Mark completed" className="p-1 hover:bg-green-50 dark:hover:bg-green-950 rounded transition-colors">
                        <CheckCircle size={14} className="text-green-500" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteSession(session.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 dark:hover:bg-red-950 rounded transition-all"
                    >
                      <X size={14} className="text-gray-300 dark:text-gray-600 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Launch command bar */}
              {session.repo && (session.status === 'logged' || session.status === 'launched') && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-2 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-2">
                  <Terminal size={12} className="text-gray-400 shrink-0" />
                  <code className="text-xs text-gray-500 dark:text-gray-400 font-mono flex-1 truncate">{cmd}</code>
                  <button
                    onClick={() => copyCommand(session.id, cmd)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 shrink-0"
                  >
                    <ClipboardCopy size={12} /> {copiedCmd === session.id ? '✓ Copied — paste in terminal' : 'Copy'}
                  </button>
                </div>
              )}

              {/* Live log panel */}
              {openLogs.has(session.id) && (
                <div className="border-t border-gray-100 dark:border-gray-800">
                  <div className="bg-gray-950 text-green-400 font-mono text-xs p-3 max-h-64 overflow-y-auto">
                    {(logLinesMap[session.id] || []).length === 0 && (
                      <span className="text-gray-500">Waiting for logs...</span>
                    )}
                    {(logLinesMap[session.id] || []).map((line, i) => (
                      <div key={i} className="whitespace-pre-wrap leading-relaxed">{line}</div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
