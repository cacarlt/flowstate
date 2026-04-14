import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { Project, Todo, CopilotSession, AdoItem } from '../types';
import { Plus, ChevronRight, Clock, Calendar, Trash2, Pencil, X, Circle, CircleDot, CircleCheck, ChevronsDown, ChevronsUp, Bot, Terminal, ScrollText, Layers, FileText, ExternalLink, GripVertical, StickyNote, ChevronDown } from 'lucide-react';

export default function TasksView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [todosByProject, setTodosByProject] = useState<Record<number, Todo[]>>({});
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDue, setNewProjectDue] = useState('');
  const [addingTodoFor, setAddingTodoFor] = useState<number | null>(null);
  const [newTodo, setNewTodo] = useState({ title: '', estimate_hours: '', due_date: '' });
  const [editingTodo, setEditingTodo] = useState<number | null>(null);
  const [editTodoData, setEditTodoData] = useState({ title: '', estimate_hours: '', due_date: '', notes: '' });
  const [editingProject, setEditingProject] = useState<number | null>(null);
  const [editProjectData, setEditProjectData] = useState({ name: '', due_date: '' });
  const [dragProjectId, setDragProjectId] = useState<number | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<number | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [filter, setFilter] = useState<'all' | 'has_todo' | 'has_in_progress' | 'complete'>('all');
  const [expandedTodoSessions, setExpandedTodoSessions] = useState<Set<number>>(new Set());
  const [todoSessions, setTodoSessions] = useState<Record<number, CopilotSession[]>>({});
  const [openTaskLogs, setOpenTaskLogs] = useState<Set<number>>(new Set());
  const [taskLogLines, setTaskLogLines] = useState<Record<number, string[]>>({});
  const taskEventSources = useRef<Record<number, EventSource>>({});
  const [expandedTodoAdoItems, setExpandedTodoAdoItems] = useState<Set<number>>(new Set());
  const [todoAdoItems, setTodoAdoItems] = useState<Record<number, AdoItem[]>>({});
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesText, setNotesText] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
  const [dragTodoId, setDragTodoId] = useState<number | null>(null);
  const [dragOverTodoId, setDragOverTodoId] = useState<number | null>(null);
  const [pushingToAdo, setPushingToAdo] = useState<number | null>(null);

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
    // If marking done, check if entire project is now complete — push to bottom
    if (next === 'done') {
      const projectTodos = todosByProject[todo.project_id] || [];
      const allDone = projectTodos.every((t) => t.id === todo.id ? true : t.status === 'done');
      if (allDone && projectTodos.length > 0) {
        await api.updateProject(todo.project_id, { priority: 999 });
      }
    }
    // If un-marking from done and project was at bottom, restore priority
    if (todo.status === 'done' && next !== 'done') {
      const project = projects.find((p) => p.id === todo.project_id);
      if (project && project.priority >= 999) {
        await api.updateProject(todo.project_id, { priority: projects.length });
      }
    }
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
      notes: todo.notes || '',
    });
  };

  const saveEditTodo = async (id: number) => {
    await api.updateTodo(id, {
      title: editTodoData.title,
      estimate_hours: editTodoData.estimate_hours ? parseFloat(editTodoData.estimate_hours) : null,
      due_date: editTodoData.due_date || null,
      notes: editTodoData.notes || null,
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

  const handleProjectDrop = async (targetId: number) => {
    if (!dragProjectId || dragProjectId === targetId) {
      setDragProjectId(null);
      setDragOverProjectId(null);
      return;
    }
    // Reorder: move dragProjectId to position of targetId
    const ordered = [...filteredProjects];
    const fromIdx = ordered.findIndex((p) => p.id === dragProjectId);
    const toIdx = ordered.findIndex((p) => p.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);
    // Assign priority 0..N based on new order
    const updates = ordered.map((p, i) => api.updateProject(p.id, { priority: i }));
    await Promise.all(updates);
    setDragProjectId(null);
    setDragOverProjectId(null);
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

  const toggleTodoAdoItems = async (todoId: number) => {
    const next = new Set(expandedTodoAdoItems);
    if (next.has(todoId)) {
      next.delete(todoId);
    } else {
      next.add(todoId);
      const items = await api.getTodoAdoItems(todoId);
      setTodoAdoItems((prev) => ({ ...prev, [todoId]: items }));
    }
    setExpandedTodoAdoItems(next);
  };

  const unlinkAdoFromTodo = async (todoId: number, adoItemId: number) => {
    await api.unlinkAdoItem(todoId, adoItemId);
    const items = await api.getTodoAdoItems(todoId);
    setTodoAdoItems((prev) => ({ ...prev, [todoId]: items }));
  };

  const pushToAdo = async (todo: Todo) => {
    setPushingToAdo(todo.id);
    try {
      await api.createAdoItem({
        type: 'Product Backlog Item',
        title: todo.title,
        description: todo.notes || undefined,
        todoId: todo.id,
      });
      load();
    } catch (err: any) {
      console.error('Push to ADO failed:', err);
    } finally {
      setPushingToAdo(null);
    }
  };

  const startEditNotes = (todo: Todo) => {
    setEditingNotes(todo.id);
    setNotesText(todo.notes || '');
  };

  const saveNotes = async (todoId: number) => {
    await api.updateTodo(todoId, { notes: notesText || null });
    setEditingNotes(null);
    load();
  };

  const toggleNotes = (todoId: number) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      next.has(todoId) ? next.delete(todoId) : next.add(todoId);
      return next;
    });
  };

  const handleTodoDrop = async (projectId: number, targetTodoId: number) => {
    if (!dragTodoId || dragTodoId === targetTodoId) {
      setDragTodoId(null);
      setDragOverTodoId(null);
      return;
    }
    const todos = todosByProject[projectId] || [];
    const ordered = [...todos];
    const fromIdx = ordered.findIndex((t) => t.id === dragTodoId);
    const toIdx = ordered.findIndex((t) => t.id === targetTodoId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);
    const updates = ordered.map((t, i) => api.updateTodo(t.id, { sort_order: i }));
    await Promise.all(updates);
    setDragTodoId(null);
    setDragOverTodoId(null);
    load();
  };

  const statusIcon = (s: string) =>
    s === 'done' ? <CircleCheck size={18} className="text-teal-500" /> : s === 'in_progress' ? <CircleDot size={18} className="text-blue-500" /> : <Circle size={18} className="text-gray-300 dark:text-gray-600" />;

  const statusColor = (s: string) =>
    s === 'done' ? 'text-teal-600 dark:text-teal-400' : s === 'in_progress' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500';

  const isProjectDone = (p: Project) => p.todo_count > 0 && p.done_count === p.todo_count;

  const filteredProjects = projects.filter((p) => {
    if (filter === 'all') return true;
    const todos = todosByProject[p.id] || [];
    if (filter === 'has_todo') return todos.some((t) => t.status === 'todo');
    if (filter === 'has_in_progress') return todos.some((t) => t.status === 'in_progress');
    if (filter === 'complete') return todos.length > 0 && todos.every((t) => t.status === 'done');
    return true;
  });

  return (
    <div>
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
        <button
          onClick={() => setShowNewProject(!showNewProject)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5"
        >
          <Plus size={16} /> New Project
        </button>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {([
            { key: 'all', label: 'All' },
            { key: 'has_todo', label: 'To Do' },
            { key: 'has_in_progress', label: 'In Progress' },
            { key: 'complete', label: 'Complete' },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === f.key ? 'bg-white dark:bg-gray-700 shadow text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setExpanded(new Set(projects.map((p) => p.id)))}
          className="hidden sm:flex text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 items-center gap-1"
        >
          <ChevronsDown size={14} /> Expand all
        </button>
        <button
          onClick={() => setExpanded(new Set())}
          className="hidden sm:flex text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 items-center gap-1"
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
          const done = isProjectDone(project);

          return (
            <div
              key={project.id}
              draggable={!editingProject}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDragProjectId(project.id); }}
              onDragEnd={() => { setDragProjectId(null); setDragOverProjectId(null); }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverProjectId(project.id); }}
              onDragLeave={() => setDragOverProjectId(null)}
              onDrop={(e) => { e.preventDefault(); handleProjectDrop(project.id); }}
              className={`bg-white dark:bg-gray-900 border rounded-lg shadow-sm overflow-hidden transition-all ${
                dragOverProjectId === project.id && dragProjectId !== project.id
                  ? 'border-blue-400 dark:border-blue-600 ring-2 ring-blue-200 dark:ring-blue-900'
                  : dragProjectId === project.id
                  ? 'opacity-50 border-gray-200 dark:border-gray-700'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
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
                <GripVertical size={14} className="text-gray-300 dark:text-gray-600 shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover/proj:opacity-100 transition-opacity" />
                <span className="text-gray-400 transition-transform duration-200"
                  style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                  <ChevronRight size={14} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold truncate ${done ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-100'}`}>{project.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {project.done_count}/{project.todo_count} tasks
                    </span>
                  </div>
                  {/* Progress bar */}
                  {project.todo_count > 0 && (
                    <div className="w-full max-w-[200px] h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mt-1.5">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-teal-500' : 'bg-blue-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:gap-4 text-xs text-gray-500 dark:text-gray-400 shrink-0">
                  {project.total_estimate_hours > 0 && (
                    <span title="Total estimated hours" className="hidden sm:flex items-center gap-1"><Clock size={12} /> {project.total_estimate_hours}h</span>
                  )}
                  {project.due_date && (
                    <span title="Due date" className="flex items-center gap-1"><Calendar size={12} /> <span className="hidden sm:inline">{project.due_date}</span><span className="sm:hidden">{project.due_date.slice(5)}</span></span>
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
                    <div
                      draggable={editingTodo !== todo.id}
                      onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; setDragTodoId(todo.id); }}
                      onDragEnd={() => { setDragTodoId(null); setDragOverTodoId(null); }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; setDragOverTodoId(todo.id); }}
                      onDragLeave={() => setDragOverTodoId(null)}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleTodoDrop(project.id, todo.id); }}
                      className={`flex items-center gap-3 py-2 border-b last:border-0 group transition-all ${
                        dragOverTodoId === todo.id && dragTodoId !== todo.id
                          ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                          : dragTodoId === todo.id
                          ? 'opacity-50 border-gray-50 dark:border-gray-800'
                          : 'border-gray-50 dark:border-gray-800'
                      }`}
                    >
                      <GripVertical size={12} className="text-gray-300 dark:text-gray-600 shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity" />
                      <button
                        onClick={() => cycleStatus(todo)}
                        className="text-lg shrink-0"
                        title={`Status: ${todo.status}`}
                      >
                        {statusIcon(todo.status)}
                      </button>

                      {editingTodo === todo.id ? (
                        <div className="flex-1 flex flex-col gap-2">
                          <div className="flex flex-wrap gap-2">
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
                          <textarea
                            placeholder="Add notes..."
                            value={editTodoData.notes}
                            onChange={(e) => setEditTodoData({ ...editTodoData, notes: e.target.value })}
                            className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-2 py-1 text-sm resize-none"
                            rows={3}
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm ${todo.status === 'done' ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
                              {todo.title}
                            </span>
                            {todo.notes && (
                              <button
                                onClick={() => toggleNotes(todo.id)}
                                className="ml-1.5 inline-flex items-center text-amber-400 dark:text-amber-500 hover:text-amber-500 dark:hover:text-amber-400"
                                title="View notes"
                              >
                                <StickyNote size={12} />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 text-xs text-gray-400 dark:text-gray-500 shrink-0 flex-wrap">
                            {todo.estimate_hours && <span className="flex items-center gap-1"><Clock size={12} /> {todo.estimate_hours}h</span>}
                            {todo.due_date && <span className="flex items-center gap-1"><Calendar size={12} /> {todo.due_date}</span>}
                            {todo.ado_link_count > 0 && (
                              <button
                                onClick={() => toggleTodoAdoItems(todo.id)}
                                className="flex items-center gap-1 text-blue-500 dark:text-blue-400 hover:text-blue-600"
                                title={`${todo.ado_link_count} linked ADO item(s)`}
                              >
                                <Layers size={12} /> {todo.ado_link_count}
                              </button>
                            )}
                            {todo.ado_link_count === 0 && (
                              <button
                                onClick={() => pushToAdo(todo)}
                                disabled={pushingToAdo === todo.id}
                                className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-teal-500 hover:text-teal-600 transition-all"
                                title="Push to ADO as PBI"
                              >
                                <Layers size={12} /> {pushingToAdo === todo.id ? '...' : '→ ADO'}
                              </button>
                            )}
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
                                s.status === 'completed' ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300' :
                                s.status === 'launched' || s.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
                                'bg-gray-100 dark:bg-gray-800 text-gray-500'
                              }`}>{s.status}</span>
                              <button onClick={() => toggleTaskLog(s.id)} title="View logs" className={`p-0.5 rounded ${openTaskLogs.has(s.id) ? 'bg-purple-200 dark:bg-purple-800' : 'hover:bg-purple-100 dark:hover:bg-purple-900'}`}>
                                <ScrollText size={10} className="text-purple-500" />
                              </button>
                            </div>
                            {openTaskLogs.has(s.id) && (
                              <div className="ml-4 mt-1 mb-1 bg-gray-950 text-teal-400 font-mono text-xs p-2 rounded max-h-48 overflow-y-auto">
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
                    {/* Linked ADO Items */}
                    {expandedTodoAdoItems.has(todo.id) && (todoAdoItems[todo.id] || []).length > 0 && (
                      <div className="ml-10 mb-1 space-y-1">
                        {(todoAdoItems[todo.id] || []).map((item) => (
                          <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 rounded text-xs border border-blue-100 dark:border-blue-900 group/ado">
                            {item.type === 'Feature' ? <Layers size={12} className="text-purple-500 shrink-0" /> : <FileText size={12} className="text-blue-500 shrink-0" />}
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-700 dark:text-gray-300 flex-1 truncate hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              {item.title}
                            </a>
                            <span className="text-gray-400 dark:text-gray-500">#{item.ado_work_item_id}</span>
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-blue-500">
                              <ExternalLink size={10} />
                            </a>
                            <button
                              onClick={() => unlinkAdoFromTodo(todo.id, item.id)}
                              className="opacity-0 group-hover/ado:opacity-100 text-gray-300 dark:text-gray-600 hover:text-red-500 transition-all"
                              title="Unlink ADO item"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Notes */}
                    {expandedNotes.has(todo.id) && todo.notes && (
                      <div className="ml-10 mb-1">
                        {editingNotes === todo.id ? (
                          <div className="space-y-1">
                            <textarea
                              value={notesText}
                              onChange={(e) => setNotesText(e.target.value)}
                              className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button onClick={() => saveNotes(todo.id)} className="text-blue-600 dark:text-blue-400 text-xs hover:underline">Save</button>
                              <button onClick={() => setEditingNotes(null)} className="text-gray-400 dark:text-gray-500 text-xs hover:underline">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => startEditNotes(todo)}
                            className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 rounded px-3 py-2 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                          >
                            {todo.notes}
                          </div>
                        )}
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
