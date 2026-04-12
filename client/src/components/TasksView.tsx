import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { Project, Todo, CopilotSession } from '../types';
import { Plus, ChevronRight, Clock, Calendar, Trash2, Pencil, X, Circle, CircleDot, CircleCheck, ChevronsDown, ChevronsUp, Bot, Terminal, ScrollText } from 'lucide-react';

export default function TasksView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [todosByProject, setTodosByProject] = useState<Record<number, Todo[]>>({});
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDue, setNewProjectDue] = useState('');
  const [addingTodoFor, setAddingTodoFor] = useState<number | null>(null);
  const [newTodo, setNewTodo] = useState({ title: '', estimate_hours: '', due_date: '' });
  const [editingTodo, setEditingTodo] = useState<number | null>(null);
  const [editTodoData, setEditTodoData] = useState({ title: '', estimate_hours: '', due_date: '' });
  const [editingProject, setEditingProject] = useState<number | null>(null);
  const [editProjectData, setEditProjectData] = useState({ name: '', due_date: '' });
  const [showNewProject, setShowNewProject] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');
  const [expandedTodoSessions, setExpandedTodoSessions] = useState<Set<number>>(new Set());
  const [todoSessions, setTodoSessions] = useState<Record<number, CopilotSession[]>>({});
  const [openTaskLogs, setOpenTaskLogs] = useState<Set<number>>(new Set());
  const [taskLogLines, setTaskLogLines] = useState<Record<number, string[]>>({});
  const taskEventSources = useRef<Record<number, EventSource>>({});

  const load = useCallback(async () => {
    const p = await api.getProjects();
    setProjects(p);
    const allTodos = await api.getTodos();
    const grouped: Record<number, Todo[]> = {};
    for (const t of allTodos) {
      if (!grouped[t.project_id]) grouped[t.project_id] = [];
      grouped[t.project_id].push(t);
    }
    setTodosByProject(grouped);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addProject = async () => {
    if (!newProjectName.trim()) return;
    await api.createProject({ name: newProjectName.trim(), due_date: newProjectDue || undefined });
    setNewProjectName('');
    setNewProjectDue('');
    setShowNewProject(false);
    load();
  };

  const deleteProject = async (id: number) => {
    if (!confirm('Delete this project and all its tasks?')) return;
    await api.deleteProject(id);
    load();
  };

  const addTodo = async (projectId: number) => {
    if (!newTodo.title.trim()) return;
    await api.createTodo({
      project_id: projectId,
      title: newTodo.title.trim(),
      estimate_hours: newTodo.estimate_hours ? parseFloat(newTodo.estimate_hours) : undefined,
      due_date: newTodo.due_date || undefined,
    });
    setNewTodo({ title: '', estimate_hours: '', due_date: '' });
    setAddingTodoFor(null);
    load();
  };

  const cycleStatus = async (todo: Todo) => {
    const next = todo.status === 'todo' ? 'in_progress' : todo.status === 'in_progress' ? 'done' : 'todo';
    await api.updateTodo(todo.id, { status: next });
    load();
  };

  const deleteTodo = async (id: number) => {
    await api.deleteTodo(id);
    load();
  };

  const startEditTodo = (todo: Todo) => {
    setEditingTodo(todo.id);
    setEditTodoData({
      title: todo.title,
      estimate_hours: todo.estimate_hours?.toString() || '',
      due_date: todo.due_date || '',
    });
  };

  const saveEditTodo = async (id: number) => {
    await api.updateTodo(id, {
      title: editTodoData.title,
      estimate_hours: editTodoData.estimate_hours ? parseFloat(editTodoData.estimate_hours) : null,
      due_date: editTodoData.due_date || null,
    });
    setEditingTodo(null);
    load();
  };

  const startEditProject = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(project.id);
    setEditProjectData({ name: project.name, due_date: project.due_date || '' });
  };

  const saveEditProject = async (id: number) => {
    await api.updateProject(id, {
      name: editProjectData.name,
      due_date: editProjectData.due_date || null,
    });
    setEditingProject(null);
    load();
  };

  const toggleTodoSessions = async (todoId: number) => {
    const next = new Set(expandedTodoSessions);
    if (next.has(todoId)) {
      next.delete(todoId);
    } else {
      next.add(todoId);
      const sessions = await api.getTodoSessions(todoId);
      setTodoSessions((prev) => ({ ...prev, [todoId]: sessions }));
    }
    setExpandedTodoSessions(next);
  };

  const toggleTaskLog = (sessionId: number) => {
    setOpenTaskLogs((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
        taskEventSources.current[sessionId]?.close();
        delete taskEventSources.current[sessionId];
        setTaskLogLines((m) => { const copy = { ...m }; delete copy[sessionId]; return copy; });
      } else {
        next.add(sessionId);
        setTaskLogLines((m) => ({ ...m, [sessionId]: [] }));
        const es = new EventSource(`/api/sessions/${sessionId}/logs/stream`);
        es.onmessage = (event) => {
          const line = JSON.parse(event.data);
          setTaskLogLines((m) => ({ ...m, [sessionId]: [...(m[sessionId] || []), line] }));
        };
        taskEventSources.current[sessionId] = es;
      }
      return next;
    });
  };

  useEffect(() => {
    return () => { Object.values(taskEventSources.current).forEach((es) => es.close()); };
  }, []);

  const statusIcon = (s: string) =>
    s === 'done' ? <CircleCheck size={18} className="text-green-500" /> : s === 'in_progress' ? <CircleDot size={18} className="text-blue-500" /> : <Circle size={18} className="text-gray-300 dark:text-gray-600" />;

  const statusColor = (s: string) =>
    s === 'done' ? 'text-green-600 dark:text-green-400' : s === 'in_progress' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500';

  const filteredProjects = projects.filter((p) => {
    if (filter === 'all') return true;
    const todos = todosByProject[p.id] || [];
    if (filter === 'active') return todos.some((t) => t.status !== 'done');
    if (filter === 'done') return todos.length > 0 && todos.every((t) => t.status === 'done');
    return true;
  });

  return (
    <div>
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={() => setShowNewProject(!showNewProject)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5"
        >
          <Plus size={16} /> New Project
        </button>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {(['all', 'active', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                filter === f ? 'bg-white dark:bg-gray-700 shadow text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => setExpanded(new Set(projects.map((p) => p.id)))}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
        >
          <ChevronsDown size={14} /> Expand all
        </button>
        <button
          onClick={() => setExpanded(new Set())}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
        >
          <ChevronsUp size={14} /> Collapse all
        </button>
      </div>

      {/* New project form */}
      {showNewProject && (
        <div className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4 shadow-sm">
          <div className="flex flex-wrap gap-3">
            <input
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addProject()}
              className="flex-1 min-w-[200px] border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <input
              type="date"
              value={newProjectDue}
              onChange={(e) => setNewProjectDue(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={addProject} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
              Create
            </button>
            <button onClick={() => setShowNewProject(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Project cards */}
      {filteredProjects.length === 0 && (
        <div className="text-center text-gray-400 dark:text-gray-500 py-12">No projects yet. Create one to get started.</div>
      )}

      <div className="space-y-3">
        {filteredProjects.map((project) => {
          const todos = todosByProject[project.id] || [];
          const isExpanded = expanded.has(project.id);
          const progress = project.todo_count > 0 ? Math.round((project.done_count / project.todo_count) * 100) : 0;

          return (
            <div key={project.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
              {/* Project header */}
              {editingProject === project.id ? (
                <div className="flex items-center gap-3 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    value={editProjectData.name}
                    onChange={(e) => setEditProjectData({ ...editProjectData, name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && saveEditProject(project.id)}
                    className="flex-1 min-w-[150px] border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <input
                    type="date"
                    value={editProjectData.due_date}
                    onChange={(e) => setEditProjectData({ ...editProjectData, due_date: e.target.value })}
                    className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button onClick={() => saveEditProject(project.id)} className="text-blue-600 dark:text-blue-400 text-sm hover:underline">Save</button>
                  <button onClick={() => setEditingProject(null)} className="text-gray-400 dark:text-gray-500 text-sm hover:underline">Cancel</button>
                </div>
              ) : (
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 select-none group/proj"
                onClick={() => toggleExpand(project.id)}
              >
                <span className="text-gray-400 transition-transform duration-200"
                  style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                  <ChevronRight size={14} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800 dark:text-gray-100 truncate">{project.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {project.done_count}/{project.todo_count} tasks
                    </span>
                  </div>
                  {/* Progress bar */}
                  {project.todo_count > 0 && (
                    <div className="w-full max-w-[200px] h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mt-1.5">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 shrink-0">
                  {project.total_estimate_hours > 0 && (
                    <span title="Total estimated hours" className="flex items-center gap-1"><Clock size={12} /> {project.total_estimate_hours}h</span>
                  )}
                  {project.due_date && (
                    <span title="Due date" className="flex items-center gap-1"><Calendar size={12} /> {project.due_date}</span>
                  )}
                  <button
                    onClick={(e) => startEditProject(project, e)}
                    className="opacity-0 group-hover/proj:opacity-100 text-gray-300 dark:text-gray-600 hover:text-blue-500 transition-all"
                    title="Edit project"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }}
                    className="opacity-0 group-hover/proj:opacity-100 text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors"
                    title="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              )}

              {/* Expanded: todo list */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700 px-4 pb-3">
                  {todos.length === 0 && (
                    <div className="text-gray-400 dark:text-gray-500 text-sm py-3">No tasks yet.</div>
                  )}
                  {todos.map((todo) => (
                    <div key={todo.id}>
                    <div key={todo.id} className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0 group">
                      <button
                        onClick={() => cycleStatus(todo)}
                        className="text-lg shrink-0"
                        title={`Status: ${todo.status}`}
                      >
                        {statusIcon(todo.status)}
                      </button>

                      {editingTodo === todo.id ? (
                        <div className="flex-1 flex flex-wrap gap-2">
                          <input
                            value={editTodoData.title}
                            onChange={(e) => setEditTodoData({ ...editTodoData, title: e.target.value })}
                            className="flex-1 min-w-[150px] border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1 text-sm"
                            autoFocus
                          />
                          <input
                            type="number"
                            step="0.5"
                            placeholder="Hours"
                            value={editTodoData.estimate_hours}
                            onChange={(e) => setEditTodoData({ ...editTodoData, estimate_hours: e.target.value })}
                            className="w-20 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1 text-sm"
                          />
                          <input
                            type="date"
                            value={editTodoData.due_date}
                            onChange={(e) => setEditTodoData({ ...editTodoData, due_date: e.target.value })}
                            className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1 text-sm"
                          />
                          <button onClick={() => saveEditTodo(todo.id)} className="text-blue-600 dark:text-blue-400 text-sm hover:underline">Save</button>
                          <button onClick={() => setEditingTodo(null)} className="text-gray-400 dark:text-gray-500 text-sm hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm ${todo.status === 'done' ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
                              {todo.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 shrink-0">
                            {todo.estimate_hours && <span className="flex items-center gap-1"><Clock size={12} /> {todo.estimate_hours}h</span>}
                            {todo.due_date && <span className="flex items-center gap-1"><Calendar size={12} /> {todo.due_date}</span>}
                            {todo.session_count > 0 && (
                              <button
                                onClick={() => toggleTodoSessions(todo.id)}
                                className="flex items-center gap-1 text-purple-500 dark:text-purple-400 hover:text-purple-600"
                                title={`${todo.session_count} Copilot session(s)`}
                              >
                                <Bot size={12} /> {todo.session_count}
                              </button>
                            )}
                            <span className={statusColor(todo.status)}>{todo.status.replace('_', ' ')}</span>
                            <button
                              onClick={() => startEditTodo(todo)}
                              className="opacity-0 group-hover:opacity-100 text-gray-300 dark:text-gray-600 hover:text-blue-500 transition-all"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => deleteTodo(todo.id)}
                              className="opacity-0 group-hover:opacity-100 text-gray-300 dark:text-gray-600 hover:text-red-500 transition-all"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    {/* Linked Copilot Sessions */}
                    {expandedTodoSessions.has(todo.id) && (todoSessions[todo.id] || []).length > 0 && (
                      <div className="ml-10 mb-1 space-y-1">
                        {(todoSessions[todo.id] || []).map((s) => (
                          <div key={s.id}>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-950/30 rounded text-xs border border-purple-100 dark:border-purple-900">
                              <Bot size={12} className="text-purple-400 shrink-0" />
                              <span className="text-gray-700 dark:text-gray-300 flex-1 truncate">{s.notes}</span>
                              {s.repo && <span className="text-gray-400 dark:text-gray-500 flex items-center gap-1"><Terminal size={10} /> {s.repo}</span>}
                              <span className={`px-1.5 py-0.5 rounded ${
                                s.status === 'completed' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' :
                                s.status === 'launched' || s.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
                                'bg-gray-100 dark:bg-gray-800 text-gray-500'
                              }`}>{s.status}</span>
                              <button onClick={() => toggleTaskLog(s.id)} title="View logs" className={`p-0.5 rounded ${openTaskLogs.has(s.id) ? 'bg-purple-200 dark:bg-purple-800' : 'hover:bg-purple-100 dark:hover:bg-purple-900'}`}>
                                <ScrollText size={10} className="text-purple-500" />
                              </button>
                            </div>
                            {openTaskLogs.has(s.id) && (
                              <div className="ml-4 mt-1 mb-1 bg-gray-950 text-green-400 font-mono text-xs p-2 rounded max-h-48 overflow-y-auto">
                                {(taskLogLines[s.id] || []).length === 0 && <span className="text-gray-500">Waiting for logs...</span>}
                                {(taskLogLines[s.id] || []).map((line, i) => (
                                  <div key={i} className="whitespace-pre-wrap leading-relaxed">{line}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    </div>
                  ))}

                  {/* Add task form */}
                  {addingTodoFor === project.id ? (
                    <div className="flex flex-wrap gap-2 pt-3">
                      <input
                        placeholder="Task title"
                        value={newTodo.title}
                        onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && addTodo(project.id)}
                        className="flex-1 min-w-[150px] border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                      <input
                        type="number"
                        step="0.5"
                        placeholder="Est. hours"
                        value={newTodo.estimate_hours}
                        onChange={(e) => setNewTodo({ ...newTodo, estimate_hours: e.target.value })}
                        className="w-24 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="date"
                        value={newTodo.due_date}
                        onChange={(e) => setNewTodo({ ...newTodo, due_date: e.target.value })}
                        className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button onClick={() => addTodo(project.id)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm">
                        Add
                      </button>
                      <button onClick={() => setAddingTodoFor(null)} className="text-gray-400 dark:text-gray-500 text-sm px-2">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingTodoFor(project.id); setNewTodo({ title: '', estimate_hours: '', due_date: '' }); }}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 pt-2 flex items-center gap-1"
                    >
                      <Plus size={14} /> Add task
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
