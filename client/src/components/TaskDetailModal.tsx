import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { Todo, CopilotSession, AdoItem } from '../types';
import { X, Clock, Calendar, Circle, CircleDot, CircleCheck, Bot, Terminal, ScrollText, Layers, FileText, ExternalLink, StickyNote, Save } from 'lucide-react';

interface TaskDetailModalProps {
  todo: Todo & { project_name: string; project_due_date?: string | null };
  onClose: () => void;
  onUpdate: () => void;
}

export default function TaskDetailModal({ todo, onClose, onUpdate }: TaskDetailModalProps) {
  const [title, setTitle] = useState(todo.title);
  const [notes, setNotes] = useState(todo.notes || '');
  const [estimateHours, setEstimateHours] = useState(todo.estimate_hours?.toString() || '');
  const [dueDate, setDueDate] = useState(todo.due_date || '');
  const [status, setStatus] = useState(todo.status);
  const [dirty, setDirty] = useState(false);

  const [sessions, setSessions] = useState<CopilotSession[]>([]);
  const [adoItems, setAdoItems] = useState<AdoItem[]>([]);

  const loadRelated = useCallback(async () => {
    if (todo.session_count > 0) {
      setSessions(await api.getTodoSessions(todo.id));
    }
    if (todo.ado_link_count > 0) {
      setAdoItems(await api.getTodoAdoItems(todo.id));
    }
  }, [todo.id, todo.session_count, todo.ado_link_count]);

  useEffect(() => { loadRelated(); }, [loadRelated]);

  useEffect(() => {
    const changed = title !== todo.title || notes !== (todo.notes || '') ||
      estimateHours !== (todo.estimate_hours?.toString() || '') ||
      dueDate !== (todo.due_date || '') || status !== todo.status;
    setDirty(changed);
  }, [title, notes, estimateHours, dueDate, status, todo]);

  const save = async () => {
    await api.updateTodo(todo.id, {
      title,
      notes: notes || null,
      estimate_hours: estimateHours ? parseFloat(estimateHours) : null,
      due_date: dueDate || null,
      status,
    });
    setDirty(false);
    onUpdate();
  };

  const cycleStatus = () => {
    const next = status === 'todo' ? 'in_progress' : status === 'in_progress' ? 'done' : 'todo';
    setStatus(next);
  };

  const statusIcon = (s: string) =>
    s === 'done' ? <CircleCheck size={20} className="text-green-500" /> :
    s === 'in_progress' ? <CircleDot size={20} className="text-blue-500" /> :
    <Circle size={20} className="text-gray-400" />;

  const statusLabel = (s: string) =>
    s === 'done' ? 'Done' : s === 'in_progress' ? 'In Progress' : 'To Do';

  const statusBadgeClass = (s: string) =>
    s === 'done' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' :
    s === 'in_progress' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
    'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400';

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <button onClick={cycleStatus} className="shrink-0" title={`Status: ${statusLabel(status)}`}>
            {statusIcon(status)}
          </button>
          <div className="flex-1 min-w-0">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-lg font-semibold bg-transparent border-none outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400"
              placeholder="Task title"
            />
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-400 dark:text-gray-500">{todo.project_name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${statusBadgeClass(status)}`}>{statusLabel(status)}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* Fields row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-1">
                <Calendar size={12} /> Scheduled Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-1">
                <Clock size={12} /> Estimate (hours)
              </label>
              <input
                type="number"
                step="0.25"
                value={estimateHours}
                onChange={(e) => setEstimateHours(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Project delivery date (read-only info) */}
          {todo.project_due_date && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Calendar size={12} />
              Project delivery: <span className="font-medium text-gray-700 dark:text-gray-300">{todo.project_due_date}</span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-1">
              <StickyNote size={12} /> Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes, details, acceptance criteria..."
              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[120px]"
              rows={5}
            />
          </div>

          {/* Linked ADO Items */}
          {adoItems.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-2">
                <Layers size={12} /> Linked ADO Items
              </label>
              <div className="space-y-1">
                {adoItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm border border-blue-100 dark:border-blue-900">
                    {item.type === 'Feature' ? <Layers size={14} className="text-purple-500 shrink-0" /> : <FileText size={14} className="text-blue-500 shrink-0" />}
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
                      {item.title}
                    </a>
                    <span className="text-gray-400 text-xs">#{item.ado_work_item_id}</span>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-500">
                      <ExternalLink size={12} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked Copilot Sessions */}
          {sessions.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-2">
                <Bot size={12} /> Copilot Sessions
              </label>
              <div className="space-y-1">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-sm border border-purple-100 dark:border-purple-900">
                    <Bot size={14} className="text-purple-400 shrink-0" />
                    <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{s.notes}</span>
                    {s.repo && <span className="text-gray-400 text-xs flex items-center gap-1"><Terminal size={10} /> {s.repo}</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      s.status === 'completed' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' :
                      s.status === 'launched' || s.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
                      'bg-gray-100 dark:bg-gray-800 text-gray-500'
                    }`}>{s.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
            <span>Created: {new Date(todo.created_at).toLocaleDateString()}</span>
            <span>Updated: {new Date(todo.updated_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            Close
          </button>
          <button
            onClick={save}
            disabled={!dirty}
            className={`px-4 py-2 text-sm rounded-lg flex items-center gap-1.5 ${
              dirty
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
          >
            <Save size={14} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}
