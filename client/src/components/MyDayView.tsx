import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { Todo, CopilotSession } from '../types';
import { Calendar, Clock, Circle, CircleDot, CircleCheck, AlertTriangle, Bot, CheckCircle, Zap, StickyNote } from 'lucide-react';
import TaskDetailModal from './TaskDetailModal';

type MyDayTask = Todo & { project_name: string; project_due_date: string | null };

interface MyDayData {
  dueTasks: MyDayTask[];
  scheduledToday: MyDayTask[];
  inProgress: MyDayTask[];
  unscheduled: MyDayTask[];
  completedToday: MyDayTask[];
  activeSessions: (CopilotSession & { project_name: string; todo_title: string })[];
  stats: { totalDue: number; totalInProgress: number; totalCompletedToday: number; totalActiveSessions: number };
}

const COLUMNS = [
  { key: 'todo' as const, label: 'To Do', color: 'border-gray-300 dark:border-gray-600', headerBg: 'bg-gray-50 dark:bg-gray-800', dot: 'bg-gray-400', icon: <Circle size={14} /> },
  { key: 'in_progress' as const, label: 'In Progress', color: 'border-blue-300 dark:border-blue-700', headerBg: 'bg-blue-50 dark:bg-blue-950/30', dot: 'bg-blue-500', icon: <CircleDot size={14} className="text-blue-500" /> },
  { key: 'done' as const, label: 'Done', color: 'border-green-300 dark:border-green-700', headerBg: 'bg-green-50 dark:bg-green-950/30', dot: 'bg-green-500', icon: <CircleCheck size={14} className="text-green-500" /> },
];

export default function MyDayView() {
  const [data, setData] = useState<MyDayData | null>(null);
  const [selectedTask, setSelectedTask] = useState<MyDayTask | null>(null);
  const [dragTaskId, setDragTaskId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await api.getMyDay();
    setData(d);
  }, []);

  useEffect(() => { load(); }, [load]);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (!data) return null;

  // Collect all tasks into columns by status, deduplicating by id
  const allTasks: MyDayTask[] = [];
  const seen = new Set<number>();
  for (const task of [...data.dueTasks, ...data.scheduledToday, ...data.inProgress, ...data.unscheduled, ...data.completedToday]) {
    if (!seen.has(task.id)) {
      seen.add(task.id);
      allTasks.push(task);
    }
  }

  const tasksByStatus: Record<string, MyDayTask[]> = { todo: [], in_progress: [], done: [] };
  for (const task of allTasks) {
    tasksByStatus[task.status]?.push(task);
  }

  const isOverdue = (task: MyDayTask) => {
    if (!task.project_due_date) return false;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return task.project_due_date < todayStr;
  };

  const isDueToday = (task: MyDayTask) => {
    if (!task.project_due_date) return false;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return task.project_due_date === todayStr;
  };

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId.toString());
    setDragTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnKey);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    setDragTaskId(null);
    const taskId = parseInt(e.dataTransfer.getData('text/plain'));
    if (!taskId) return;
    const task = allTasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;
    await api.updateTodo(taskId, { status: targetStatus });
    load();
  };

  const handleDragEnd = () => {
    setDragTaskId(null);
    setDragOverColumn(null);
  };

  const handleTaskClick = (task: MyDayTask) => {
    setSelectedTask(task);
  };

  const handleModalUpdate = () => {
    load();
    // Refresh selectedTask with latest data
    setSelectedTask(null);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">My Day</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500">{today}</p>
        </div>
        {/* Stats pills */}
        <div className="flex items-center gap-2">
          <StatPill icon={<AlertTriangle size={12} />} value={data.stats.totalDue} color="text-red-500 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800" />
          <StatPill icon={<Zap size={12} />} value={data.stats.totalInProgress} color="text-blue-500 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800" />
          <StatPill icon={<Bot size={12} />} value={data.stats.totalActiveSessions} color="text-purple-500 bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800" />
          <StatPill icon={<CheckCircle size={12} />} value={data.stats.totalCompletedToday} color="text-green-500 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" />
        </div>
      </div>

      {/* Active sessions bar */}
      {data.activeSessions.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {data.activeSessions.map((s) => (
            <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg text-xs shrink-0">
              <Bot size={12} className="text-purple-400" />
              <span className="text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{s.notes}</span>
              <span className={`px-1.5 py-0.5 rounded ${
                s.status === 'launched' || s.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
                'bg-gray-100 dark:bg-gray-800 text-gray-500'
              }`}>{s.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Kanban board */}
      <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
        {COLUMNS.map((col) => {
          const tasks = tasksByStatus[col.key] || [];
          const isDropTarget = dragOverColumn === col.key && dragTaskId !== null;

          return (
            <div
              key={col.key}
              className={`flex flex-col rounded-xl border-2 transition-colors ${isDropTarget ? 'border-blue-400 dark:border-blue-500 bg-blue-50/30 dark:bg-blue-950/20' : col.color} bg-gray-50/50 dark:bg-gray-800/30`}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              {/* Column header */}
              <div className={`flex items-center gap-2 px-4 py-3 ${col.headerBg} rounded-t-xl border-b border-gray-200 dark:border-gray-700`}>
                <div className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{col.label}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{tasks.length}</span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {tasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    isOverdue={isOverdue(task)}
                    isDueToday={isDueToday(task)}
                    isDragging={dragTaskId === task.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleTaskClick(task)}
                  />
                ))}
                {tasks.length === 0 && (
                  <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-8">
                    {isDropTarget ? 'Drop here' : 'No tasks'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          todo={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleModalUpdate}
        />
      )}
    </div>
  );
}

function StatPill({ icon, value, color }: { icon: React.ReactNode; value: number; color: string }) {
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium ${color}`}>
      {icon}
      <span>{value}</span>
    </div>
  );
}

function KanbanCard({ task, isOverdue, isDueToday, isDragging, onDragStart, onDragEnd, onClick }: {
  task: MyDayTask;
  isOverdue: boolean;
  isDueToday: boolean;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`bg-white dark:bg-gray-900 rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 select-none ${
        isDragging ? 'opacity-40 scale-95' : ''
      } ${
        isOverdue ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* Title */}
      <p className={`text-sm font-medium mb-1.5 ${task.status === 'done' ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}>
        {task.title}
      </p>

      {/* Project name */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{task.project_name}</p>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {isOverdue && (
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 font-medium">
            <AlertTriangle size={10} /> Overdue
          </span>
        )}
        {isDueToday && !isOverdue && (
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300 font-medium">
            <AlertTriangle size={10} /> Due Today
          </span>
        )}
        {task.estimate_hours && (
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            <Clock size={10} /> {task.estimate_hours}h
          </span>
        )}
        {task.due_date && (
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            <Calendar size={10} /> {task.due_date}
          </span>
        )}
        {task.notes && (
          <span className="text-amber-400 dark:text-amber-500">
            <StickyNote size={10} />
          </span>
        )}
        {task.session_count > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-500 dark:text-purple-300">
            <Bot size={10} /> {task.session_count}
          </span>
        )}
      </div>
    </div>
  );
}
