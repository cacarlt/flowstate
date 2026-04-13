import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { AdoItem, PatStatus, Project, Todo } from '../types';
import { RefreshCw, ChevronRight, Layers, FileText, Shield, ExternalLink, CheckCircle2, Link2 } from 'lucide-react';

const KANBAN_COLUMNS = [
  { key: 'New', label: 'New', color: 'border-gray-300 dark:border-gray-600', headerBg: 'bg-gray-50 dark:bg-gray-800', dot: 'bg-gray-400' },
  { key: 'In Progress', label: 'In Progress', color: 'border-blue-300 dark:border-blue-700', headerBg: 'bg-blue-50 dark:bg-blue-950/30', dot: 'bg-blue-500' },
  { key: 'In Review', label: 'In Review', color: 'border-yellow-300 dark:border-yellow-700', headerBg: 'bg-yellow-50 dark:bg-yellow-950/30', dot: 'bg-yellow-500' },
  { key: 'Done', label: 'Done', color: 'border-green-300 dark:border-green-700', headerBg: 'bg-green-50 dark:bg-green-950/30', dot: 'bg-green-500' },
];

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
    <div className={linkMode ? 'flex flex-col lg:flex-row gap-4' : ''}>
      <div className={linkMode ? 'flex-1 min-w-0' : ''}>
        {/* Toolbar */}
        <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
          <button onClick={sync} disabled={syncing} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <button onClick={() => setLinkMode(!linkMode)} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${linkMode ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
            <Link2 size={14} /> {linkMode ? 'Exit Link Mode' : 'Link to Tasks'}
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
            <Shield size={12} className="text-green-500" />
            <span>PAT: {patStatus.status === 'active' ? `Active (${patStatus.daysRemaining}d)` : 'Configured'}</span>
            {patStatus.organization && <span>· {patStatus.organization}</span>}
          </div>
        )}
        {patStatus && !patOk && (
          <div className="border border-red-200 dark:border-red-800 rounded-lg mb-3 px-4 py-2 flex items-center gap-3">
            <Shield size={14} className="text-red-500" />
            <span className="text-sm text-gray-700 dark:text-gray-200 flex-1">{patStatus.status === 'not_configured' ? 'PAT not configured' : patStatus.status === 'expired' ? 'PAT expired' : `PAT expiring — ${patStatus.daysRemaining}d`}</span>
            {patStatus.manageUrl && <a href={patStatus.manageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">Manage <ExternalLink size={10} /></a>}
          </div>
        )}

        {error && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg p-3 mb-3 text-sm">{error}</div>}
        {!configured && <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3 text-sm text-amber-800 dark:text-amber-300">Set ADO_ORG, ADO_PROJECT, ADO_PAT env vars.</div>}
        {linkSuccess && <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-lg p-2 mb-3 text-sm flex items-center gap-2"><CheckCircle2 size={14} /> {linkSuccess}</div>}

        {items.length === 0 && !error && <div className="text-center text-gray-400 dark:text-gray-500 py-16">No ADO items synced yet. Click "Sync" to pull your work items.</div>}

        {/* Kanban Board */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {KANBAN_COLUMNS.map((col) => {
              const colItems = byState[col.key];
              return (
                <div key={col.key} className={`border ${col.color} rounded-lg overflow-hidden bg-gray-50/50 dark:bg-gray-900/50`}>
                  <div className={`${col.headerBg} px-3 py-2 border-b ${col.color} flex items-center gap-2`}>
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{col.label}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{colItems.length}</span>
                  </div>
                  <div className="p-2 space-y-2 min-h-[100px] max-h-[calc(100vh-280px)] overflow-y-auto">
                    {colItems.map((item) => <KanbanCard key={item.id} item={item} typeIcon={typeIcon} draggable={linkMode} />)}
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
    </div>
  );
}

function KanbanCard({ item, typeIcon, draggable }: { item: AdoItem; typeIcon: (t: string) => React.ReactNode; draggable?: boolean }) {
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
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
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
  const icon = todo.status === 'done' ? <CheckCircle2 size={12} className="text-green-500 shrink-0" /> : todo.status === 'in_progress' ? <div className="w-3 h-3 rounded-full border-2 border-blue-500 shrink-0" /> : <div className="w-3 h-3 rounded-full border-2 border-gray-300 dark:border-gray-600 shrink-0" />;
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
