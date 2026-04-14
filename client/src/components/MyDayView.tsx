import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { Todo, CopilotSession } from '../types';
import { Calendar, Clock, Circle, CircleDot, CircleCheck, AlertTriangle, Bot, CheckCircle, Zap, StickyNote, ChevronLeft, ChevronRight, CalendarPlus } from 'lucide-react';
import TaskDetailModal from './TaskDetailModal';

type MyDayTask = Todo & { project_name: string; project_due_date: string | null };

interface MyDayData {
  date: string;
  dueTasks: MyDayTask[];
  scheduledToday: MyDayTask[];
  inProgress: MyDayTask[];
  unscheduled: MyDayTask[];
  completedToday: MyDayTask[];
  activeSessions: (CopilotSession & { project_name: string; todo_title: string })[];
  stats: { totalDue: number; totalInProgress: number; totalCompletedToday: number; totalActiveSessions: number; plannedHours: number };
}

const COLUMNS = [
  { key: 'todo' as const, label: 'To Do', color: 'border-gray-300 dark:border-gray-600', headerBg: 'bg-gray-50 dark:bg-gray-800', dot: 'bg-gray-400', icon: <Circle size={14} /> },
  { key: 'in_progress' as const, label: 'In Progress', color: 'border-blue-300 dark:border-blue-700', headerBg: 'bg-blue-50 dark:bg-blue-950/30', dot: 'bg-blue-500', icon: <CircleDot size={14} className="text-blue-500" /> },
  { key: 'done' as const, label: 'Done', color: 'border-teal-300 dark:border-teal-700', headerBg: 'bg-teal-50 dark:bg-teal-950/30', dot: 'bg-teal-500', icon: <CircleCheck size={14} className="text-teal-500" /> },
];

function formatDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function MyDayView() {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [data, setData] = useState<MyDayData | null>(null);
  const [selectedTask, setSelectedTask] = useState<MyDayTask | null>(null);
  const [dragTaskId, setDragTaskId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [showUnscheduled, setShowUnscheduled] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const isToday = selectedDate === getTodayStr();

  const load = useCallback(async () => {
    const d = await api.getMyDay(selectedDate);
    setData(d);
  }, [selectedDate]);

  useEffect(() => { load(); }, [load]);

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
    return task.project_due_date < selectedDate;
  };

  const isDueToday = (task: MyDayTask) => {
    if (!task.project_due_date) return false;
    return task.project_due_date === selectedDate;
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
    setSelectedTask(null);
  };

  const handleScheduleTask = async (todoId: number) => {
    setScheduling(true);
    try {
      await api.scheduleTodos(selectedDate, [todoId]);
      load();
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with date picker */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              {isToday ? 'My Day' : formatDateStr(selectedDate)}
            </h2>
            {isToday && <p className="text-sm text-gray-400 dark:text-gray-500">{formatDateStr(selectedDate)}</p>}
          </div>
          {/* Date navigation */}
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
              title="Previous day"
            >
              <ChevronLeft size={16} />
            </button>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(getTodayStr())}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
              >
                Today
              </button>
            )}
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
              title="Next day"
            >
              <ChevronRight size={16} />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="ml-1 px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
        </div>
        {/* Stats pills + Unscheduled toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUnscheduled(!showUnscheduled)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium transition-colors ${
              showUnscheduled
                ? 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900 border-indigo-300 dark:border-indigo-700'
                : 'text-gray-500 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            }`}
            title="Show unscheduled tasks"
          >
            <CalendarPlus size={12} />
            <span>{data.unscheduled.length}</span>
          </button>
          {data.stats.plannedHours > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium text-cyan-500 bg-cyan-50 dark:bg-cyan-950 border-cyan-200 dark:border-cyan-800">
              <Clock size={12} />
              <span>{data.stats.plannedHours}h</span>
            </div>
          )}
          <StatPill icon={<AlertTriangle size={12} />} value={data.stats.totalDue} color="text-orange-500 bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800" />
          <StatPill icon={<Zap size={12} />} value={data.stats.totalInProgress} color="text-blue-500 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800" />
          <StatPill icon={<Bot size={12} />} value={data.stats.totalActiveSessions} color="text-purple-500 bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800" />
          <StatPill icon={<CheckCircle size={12} />} value={data.stats.totalCompletedToday} color="text-teal-500 bg-teal-50 dark:bg-teal-950 border-teal-200 dark:border-teal-800" />
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

      {/* Main content: kanban + optional unscheduled sidebar */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Kanban board */}
        <div className={`flex-1 grid grid-cols-3 gap-4 min-h-0`}>
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

        {/* Unscheduled sidebar */}
        {showUnscheduled && data.unscheduled.length > 0 && (
          <div className="w-64 shrink-0 flex flex-col rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20">
            <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-t-xl border-b border-indigo-200 dark:border-indigo-700">
              <CalendarPlus size={14} className="text-indigo-500" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Unscheduled</span>
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{data.unscheduled.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {data.unscheduled.map((task) => (
                <div
                  key={task.id}
                  className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 group"
                >
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">{task.title}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{task.project_name}</p>
                  <button
                    onClick={() => handleScheduleTask(task.id)}
                    disabled={scheduling}
                    className="text-xs px-2 py-1 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    Schedule for {isToday ? 'today' : selectedDate}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
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
        isOverdue ? 'border-orange-300 dark:border-orange-700' : 'border-gray-200 dark:border-gray-700'
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
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-300 font-medium">
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
