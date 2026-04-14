import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { AdoItem, PatStatus, Project, Todo } from '../types';
import { RefreshCw, ChevronRight, Layers, FileText, Shield, ExternalLink, CheckCircle2, Link2, Plus, MessageSquare, X, Send, Edit3, Bug, Clipboard } from 'lucide-react';

const KANBAN_COLUMNS = [
  { key: 'New', label: 'New', color: 'border-gray-300 dark:border-gray-600', headerBg: 'bg-gray-50 dark:bg-gray-800', dot: 'bg-gray-400' },
  { key: 'In Progress', label: 'In Progress', color: 'border-blue-300 dark:border-blue-700', headerBg: 'bg-blue-50 dark:bg-blue-950/30', dot: 'bg-blue-500' },
  { key: 'In Review', label: 'In Review', color: 'border-yellow-300 dark:border-yellow-700', headerBg: 'bg-yellow-50 dark:bg-yellow-950/30', dot: 'bg-yellow-500' },
  { key: 'Done', label: 'Done', color: 'border-teal-300 dark:border-teal-700', headerBg: 'bg-teal-50 dark:bg-teal-950/30', dot: 'bg-teal-500' },
];

const ADO_STATES = ['New', 'Active', 'In Progress', 'Resolved', 'Closed', 'Done', 'Committed'];

function normalizeState(state: string | null): string {
  if (!state) return 'New';
  const s = state.toLowerCase();
  if (s === 'done' || s === 'closed') return 'Done';
  if (s === 'in review' || s === 'resolved') return 'In Review';
  if (s === 'active' || s === 'committed' || s === 'in progress') return 'In Progress';
  return 'New';
}

export default function AdoView() {
  const [items, setItems] = useState<AdoItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [patStatus, setPatStatus] = useState<PatStatus | null>(null);

  const [selectedSprint, setSelectedSprint] = useState<string>(() => localStorage.getItem('ado-filter-sprint') || '');
  const [filterAssigned, setFilterAssigned] = useState<string>(() => localStorage.getItem('ado-filter-assigned') || '');

  useEffect(() => {
    selectedSprint ? localStorage.setItem('ado-filter-sprint', selectedSprint) : localStorage.removeItem('ado-filter-sprint');
    filterAssigned ? localStorage.setItem('ado-filter-assigned', filterAssigned) : localStorage.removeItem('ado-filter-assigned');
  }, [selectedSprint, filterAssigned]);

  const [linkMode, setLinkMode] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [todosByProject, setTodosByProject] = useState<Record<number, Todo[]>>({});
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stateChanging, setStateChanging] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getAdoItems();
      setItems(data);
      if (!selectedSprint && data.length > 0) {
        const sprints = [...new Set(data.map((i) => i.sprint_name).filter(Boolean) as string[])].sort().reverse();
        if (sprints.length > 0) setSelectedSprint(sprints[0]);
      }
    } catch { setItems([]); }
    try { setPatStatus(await api.getAdoPatStatus()); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (linkMode) {
      (async () => {
        const p = await api.getProjects();
        setProjects(p);
        const allTodos = await api.getTodos();
        const grouped: Record<number, Todo[]> = {};
        for (const t of allTodos) { if (!grouped[t.project_id]) grouped[t.project_id] = []; grouped[t.project_id].push(t); }
        setTodosByProject(grouped);
        setExpandedProjects(new Set(p.map((pr: Project) => pr.id)));
      })();
    }
  }, [linkMode]);

  const sync = async () => {
    setSyncing(true); setError(null);
    try { const r = await api.syncAdo(); setItems(r.items || []); }
    catch (err: any) { if (err.message.includes('env vars')) setConfigured(false); setError(err.message); }
    finally { setSyncing(false); }
  };

  const handleDrop = async (targetId: number, adoItemId: number, targetType: 'project' | 'todo') => {
    try {
      targetType === 'project' ? await api.linkProjectAdoItem(targetId, adoItemId) : await api.linkAdoItem(targetId, adoItemId);
      setLinkSuccess('Linked!'); load();
      setTimeout(() => setLinkSuccess(null), 2000);
    } catch (err: any) { setError(err.message); }
  };

  const handleStateChange = async (item: AdoItem, newState: string) => {
    setStateChanging(item.id);
    try {
      await api.updateAdoItemState(item.ado_work_item_id, newState);
      load();
    } catch (err: any) { setError(err.message); }
    finally { setStateChanging(null); }
  };

  const handleCreateItem = async (data: { type: string; title: string; description?: string; assignedTo?: string; iterationPath?: string }) => {
    try {
      await api.createAdoItem(data);
      setShowCreateModal(false);
      load();
      setLinkSuccess('Created!');
      setTimeout(() => setLinkSuccess(null), 2000);
    } catch (err: any) { setError(err.message); }
  };

  const allSprints = [...new Set(items.map((i) => i.sprint_name).filter(Boolean) as string[])].sort().reverse();
  const allAssigned = [...new Set(items.map((i) => i.assigned_to || 'Unassigned'))].sort();

  const filtered = items.filter((item) => {
    if (selectedSprint && (item.sprint_name || '') !== selectedSprint) return false;
    if (filterAssigned === '__unassigned__' && item.assigned_to) return false;
    if (filterAssigned && filterAssigned !== '__unassigned__' && item.assigned_to !== filterAssigned) return false;
    return true;
  });

  const byState: Record<string, AdoItem[]> = {};
  for (const col of KANBAN_COLUMNS) byState[col.key] = [];
  for (const item of filtered) byState[normalizeState(item.state)].push(item);

  const typeIcon = (type: string) => type === 'Feature' ? <Layers size={12} className="text-purple-500" /> : <FileText size={12} className="text-blue-500" />;
  const patOk = patStatus && patStatus.status !== 'not_configured' && patStatus.status !== 'expired' && patStatus.status !== 'expiring_soon';

  return (
    <div className={`h-[calc(100vh-140px)] flex flex-col ${linkMode ? 'lg:flex-row gap-4' : ''}`}>
      <div className={`flex flex-col min-h-0 ${linkMode ? 'flex-1 min-w-0' : 'flex-1'}`}>
        {/* Toolbar */}
        <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
          <button onClick={sync} disabled={syncing} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <button onClick={() => setLinkMode(!linkMode)} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${linkMode ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
            <Link2 size={14} /> {linkMode ? 'Exit Link Mode' : 'Link to Tasks'}
          </button>
          <button onClick={() => setShowCreateModal(true)} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors flex items-center gap-1.5">
            <Plus size={14} /> New Item
          </button>
          <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
            <select value={filterAssigned} onChange={(e) => setFilterAssigned(e.target.value)} className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-2 py-1.5 text-sm">
              <option value="">Everyone</option>
              <option value="__unassigned__">Unassigned</option>
              {allAssigned.filter((a) => a !== 'Unassigned').map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={selectedSprint} onChange={(e) => setSelectedSprint(e.target.value)} className="border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-2 py-1.5 text-sm font-medium">
              <option value="">All Sprints</option>
              {allSprints.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* PAT — minimal */}
        {patStatus && patOk && (
          <div className="flex items-center gap-2 mb-3 text-xs text-gray-400 dark:text-gray-500">
            <Shield size={12} className="text-teal-500" />
            <span>PAT: {patStatus.status === 'active' ? `Active (${patStatus.daysRemaining}d)` : 'Configured'}</span>
            {patStatus.organization && <span>· {patStatus.organization}</span>}
          </div>
        )}
        {patStatus && !patOk && (
          <div className="border border-orange-200 dark:border-orange-800 rounded-lg mb-3 px-4 py-2 flex items-center gap-3">
            <Shield size={14} className="text-orange-500" />
            <span className="text-sm text-gray-700 dark:text-gray-200 flex-1">{patStatus.status === 'not_configured' ? 'PAT not configured' : patStatus.status === 'expired' ? 'PAT expired' : `PAT expiring — ${patStatus.daysRemaining}d`}</span>
            {patStatus.manageUrl && <a href={patStatus.manageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">Manage <ExternalLink size={10} /></a>}
          </div>
        )}

        {error && <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 rounded-lg p-3 mb-3 text-sm">{error}</div>}
        {!configured && <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3 text-sm text-amber-800 dark:text-amber-300">Set ADO_ORG, ADO_PROJECT, ADO_PAT env vars.</div>}
        {linkSuccess && <div className="bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 rounded-lg p-2 mb-3 text-sm flex items-center gap-2"><CheckCircle2 size={14} /> {linkSuccess}</div>}

        {items.length === 0 && !error && <div className="text-center text-gray-400 dark:text-gray-500 py-16">No ADO items synced yet. Click "Sync" to pull your work items.</div>}

        {/* Kanban Board */}
        {filtered.length > 0 && (
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 min-h-0">
            {KANBAN_COLUMNS.map((col) => {
              const colItems = byState[col.key];
              return (
                <div key={col.key} className={`flex flex-col border ${col.color} rounded-lg overflow-hidden bg-gray-50/50 dark:bg-gray-900/50 min-h-0`}>
                  <div className={`${col.headerBg} px-3 py-2 border-b ${col.color} flex items-center gap-2 shrink-0`}>
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{col.label}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{colItems.length}</span>
                  </div>
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                    {colItems.map((item) => <KanbanCard key={item.id} item={item} typeIcon={typeIcon} draggable={linkMode} onStateChange={handleStateChange} stateChanging={stateChanging === item.id} />)}
                    {colItems.length === 0 && <div className="text-xs text-gray-400 dark:text-gray-600 text-center py-6">—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {filtered.length === 0 && items.length > 0 && <div className="text-center text-gray-400 dark:text-gray-500 py-12">No items match your filters.</div>}
      </div>

      {/* Link Mode Panel */}
      {linkMode && (
        <div className="w-full lg:w-72 shrink-0 bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-800 rounded-lg shadow-sm overflow-hidden">
          <div className="px-3 py-2.5 bg-purple-50 dark:bg-purple-950/30 border-b border-purple-100 dark:border-purple-900">
            <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2"><Link2 size={14} /> Link ADO Items</h3>
            <p className="text-xs text-purple-500 dark:text-purple-400 mt-0.5"><strong>Features</strong> → projects · <strong>PBIs</strong> → tasks</p>
          </div>
          <div className="p-2 max-h-[calc(100vh-200px)] overflow-y-auto space-y-0.5">
            {projects.map((project) => {
              const todos = todosByProject[project.id] || [];
              const isExp = expandedProjects.has(project.id);
              return (
                <div key={project.id}>
                  <ProjectDropTarget project={project} isExpanded={isExp}
                    onToggle={() => setExpandedProjects((prev) => { const n = new Set(prev); n.has(project.id) ? n.delete(project.id) : n.add(project.id); return n; })}
                    onDrop={(adoItemId) => handleDrop(project.id, adoItemId, 'project')} />
                  {isExp && todos.map((todo) => <TodoDropTarget key={todo.id} todo={todo} onDrop={(todoId, adoItemId) => handleDrop(todoId, adoItemId, 'todo')} />)}
                </div>
              );
            })}
            {projects.length === 0 && <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">No projects yet.</div>}
          </div>
        </div>
      )}

      {/* Create Work Item Modal */}
      {showCreateModal && (
        <CreateAdoItemModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateItem}
        />
      )}
    </div>
  );
}

function KanbanCard({ item, typeIcon, draggable, onStateChange, stateChanging }: { item: AdoItem; typeIcon: (t: string) => React.ReactNode; draggable?: boolean; onStateChange: (item: AdoItem, state: string) => void; stateChanging?: boolean }) {
  const [showStateDropdown, setShowStateDropdown] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-ado-item', JSON.stringify({ id: item.id, title: item.title, type: item.type }));
    e.dataTransfer.effectAllowed = 'link';
  };
  return (
    <div draggable={draggable} onDragStart={draggable ? handleDragStart : undefined}
      className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 shadow-sm hover:shadow transition-shadow ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {typeIcon(item.type)}
        <span className="text-xs text-gray-400 dark:text-gray-500">#{item.ado_work_item_id}</span>
        <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="ml-auto text-gray-300 hover:text-blue-500"><ExternalLink size={10} /></a>
      </div>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-800 dark:text-gray-100 font-medium leading-snug line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 block">{item.title}</a>
      {/* Effort + Priority row */}
      {(item.effort !== null || item.priority !== null || item.tags) && (
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {item.priority !== null && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              item.priority === 1 ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-300' :
              item.priority === 2 ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300' :
              'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}>P{item.priority}</span>
          )}
          {item.effort !== null && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 font-medium">{item.effort}pt</span>
          )}
          {item.tags && item.tags.split('; ').slice(0, 2).map((tag) => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 truncate max-w-[60px]" title={tag}>{tag}</span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {/* State change button */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowStateDropdown(!showStateDropdown); }}
            disabled={stateChanging}
            className={`text-xs px-1.5 py-0.5 rounded font-medium transition-colors ${
              stateChanging ? 'opacity-50' :
              'hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-600'
            } ${
              item.state === 'Active' || item.state === 'In Progress' || item.state === 'Committed'
                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300'
                : item.state === 'Done' || item.state === 'Closed'
                ? 'bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-300'
                : item.state === 'Resolved'
                ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            {stateChanging ? '...' : item.state || 'New'}
          </button>
          {showStateDropdown && (
            <div className="absolute z-20 top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[120px]">
              {ADO_STATES.map((s) => (
                <button
                  key={s}
                  onClick={(e) => { e.stopPropagation(); setShowStateDropdown(false); if (s !== item.state) onStateChange(item, s); }}
                  className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 ${s === item.state ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-200'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        {item.assigned_to ? (
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded truncate max-w-[80px]" title={item.assigned_to}>{item.assigned_to.split(' ')[0]}</span>
        ) : (
          <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400 px-1.5 py-0.5 rounded">Unassigned</span>
        )}
        {(item.linked_projects || []).map((l) => <span key={`p-${l.project_id}`} className="text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 truncate max-w-[80px]" title={`Project: ${l.project_name}`}>{l.project_name}</span>)}
        {(item.linked_todos || []).map((l) => <span key={`t-${l.todo_id}`} className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 truncate max-w-[80px]" title={`Task: ${l.todo_title} (${l.project_name})`}>{l.todo_title}</span>)}
      </div>
    </div>
  );
}

function ProjectDropTarget({ project, isExpanded, onToggle, onDrop }: { project: Project; isExpanded: boolean; onToggle: () => void; onDrop: (adoItemId: number) => void }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'link'; setDragOver(true); }} onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const d = e.dataTransfer.getData('application/x-ado-item'); if (d) { const { id, type } = JSON.parse(d); if (type === 'Feature') onDrop(id); } }}
      className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded text-sm transition-colors ${dragOver ? 'bg-purple-100 dark:bg-purple-900/50 border border-purple-300 dark:border-purple-700 border-dashed' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`} onClick={onToggle}>
      <ChevronRight size={12} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
      <Layers size={12} className="text-purple-500 shrink-0" />
      <span className="font-medium text-gray-700 dark:text-gray-200 truncate">{project.name}</span>
      {dragOver && <span className="text-xs text-purple-400 ml-auto">Feature →</span>}
    </div>
  );
}

function TodoDropTarget({ todo, onDrop }: { todo: Todo; onDrop: (todoId: number, adoItemId: number) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const icon = todo.status === 'done' ? <CheckCircle2 size={12} className="text-teal-500 shrink-0" /> : todo.status === 'in_progress' ? <div className="w-3 h-3 rounded-full border-2 border-blue-500 shrink-0" /> : <div className="w-3 h-3 rounded-full border-2 border-gray-300 dark:border-gray-600 shrink-0" />;
  return (
    <div onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'link'; setDragOver(true); }} onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const d = e.dataTransfer.getData('application/x-ado-item'); if (d) { const { id, type } = JSON.parse(d); if (type === 'Product Backlog Item') onDrop(todo.id, id); } }}
      className={`flex items-center gap-2 ml-5 px-2 py-1.5 rounded text-sm transition-colors ${dragOver ? 'bg-purple-100 dark:bg-purple-900/50 border border-purple-300 dark:border-purple-700 border-dashed' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
      {icon}
      <span className={`truncate ${todo.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-200'}`}>{todo.title}</span>
      {dragOver && <span className="text-xs text-purple-400 ml-auto">PBI →</span>}
    </div>
  );
}

function CreateAdoItemModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (data: { type: string; title: string; description?: string; assignedTo?: string; iterationPath?: string }) => void;
}) {
  const [type, setType] = useState('Product Backlog Item');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const TYPES = ['Product Backlog Item', 'Task', 'Feature', 'Bug', 'Epic', 'Test Case'];

  const typeIcons: Record<string, React.ReactNode> = {
    'Product Backlog Item': <FileText size={14} className="text-blue-500" />,
    'Task': <Clipboard size={14} className="text-yellow-500" />,
    'Feature': <Layers size={14} className="text-purple-500" />,
    'Bug': <Bug size={14} className="text-red-500" />,
    'Epic': <Layers size={14} className="text-orange-500" />,
    'Test Case': <CheckCircle2 size={14} className="text-teal-500" />,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onCreate({ type, title: title.trim(), description: description.trim() || undefined });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Plus size={18} /> Create Work Item
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Type</label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    type === t
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {typeIcons[t]} {t}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter work item title..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the work item..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || submitting}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <Send size={14} /> {submitting ? 'Creating...' : 'Create in ADO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
