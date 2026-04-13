import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { Todo, CopilotSession } from '../types';
import { Calendar, Clock, Circle, CircleDot, CircleCheck, AlertTriangle, Bot, CheckCircle, Inbox, Zap } from 'lucide-react';

interface MyDayData {
  dueTasks: (Todo & { project_name: string })[];
  inProgress: (Todo & { project_name: string })[];
  unscheduled: (Todo & { project_name: string })[];
  completedToday: (Todo & { project_name: string })[];
  activeSessions: (CopilotSession & { project_name: string; todo_title: string })[];
  stats: { totalDue: number; totalInProgress: number; totalCompletedToday: number; totalActiveSessions: number };
}

export default function MyDayView() {
  const [data, setData] = useState<MyDayData | null>(null);

  const load = useCallback(async () => {
    const d = await api.getMyDay();
    setData(d);
  }, []);

  useEffect(() => { load(); }, [load]);

  const cycleStatus = async (todo: Todo) => {
    const next = todo.status === 'todo' ? 'in_progress' : todo.status === 'in_progress' ? 'done' : 'todo';
    await api.updateTodo(todo.id, { status: next });
    load();
  };

  const statusIcon = (s: string) =>
    s === 'done' ? <CircleCheck size={16} className="text-green-500" /> :
    s === 'in_progress' ? <CircleDot size={16} className="text-blue-500" /> :
    <Circle size={16} className="text-gray-300 dark:text-gray-600" />;

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (!data) return null;

  const isOverdue = (date: string) => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return date < today;
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">My Day</h2>
        <p className="text-sm text-gray-400 dark:text-gray-500">{today}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard icon={<AlertTriangle size={16} />} label="Due / Overdue" value={data.stats.totalDue} color="text-red-500" bg="bg-red-50 dark:bg-red-950" />
        <StatCard icon={<Zap size={16} />} label="In Progress" value={data.stats.totalInProgress} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-950" />
        <StatCard icon={<Bot size={16} />} label="Active Sessions" value={data.stats.totalActiveSessions} color="text-purple-500" bg="bg-purple-50 dark:bg-purple-950" />
        <StatCard icon={<CheckCircle size={16} />} label="Done Today" value={data.stats.totalCompletedToday} color="text-green-500" bg="bg-green-50 dark:bg-green-950" />
      </div>

      {/* Due / Overdue */}
      {data.dueTasks.length > 0 && (
        <Section title="Due & Overdue" icon={<AlertTriangle size={14} className="text-red-500" />}>
          {data.dueTasks.map((task) => (
            <TaskRow key={task.id} task={task} onCycle={cycleStatus} statusIcon={statusIcon} isOverdue={isOverdue(task.due_date!)} />
          ))}
        </Section>
      )}

      {/* In Progress */}
      {data.inProgress.length > 0 && (
        <Section title="In Progress" icon={<Zap size={14} className="text-blue-500" />}>
          {data.inProgress.map((task) => (
            <TaskRow key={task.id} task={task} onCycle={cycleStatus} statusIcon={statusIcon} />
          ))}
        </Section>
      )}

      {/* Active Copilot Sessions */}
      {data.activeSessions.length > 0 && (
        <Section title="Active Sessions" icon={<Bot size={14} className="text-purple-500" />}>
          {data.activeSessions.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2 px-3 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
              <Bot size={14} className="text-purple-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-700 dark:text-gray-200 truncate block">{s.notes}</span>
                {(s.project_name || s.todo_title) && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {s.project_name}{s.project_name && s.todo_title ? ' → ' : ''}{s.todo_title}
                  </span>
                )}
              </div>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                s.status === 'launched' || s.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
                'bg-gray-100 dark:bg-gray-800 text-gray-500'
              }`}>{s.status}</span>
            </div>
          ))}
        </Section>
      )}

      {/* Completed Today */}
      {data.completedToday.length > 0 && (
        <Section title="Completed Today" icon={<CheckCircle size={14} className="text-green-500" />}>
          {data.completedToday.map((task) => (
            <TaskRow key={task.id} task={task} onCycle={cycleStatus} statusIcon={statusIcon} />
          ))}
        </Section>
      )}

      {/* Unscheduled (backlog peek) */}
      {data.unscheduled.length > 0 && data.dueTasks.length === 0 && data.inProgress.length === 0 && (
        <Section title="Up Next (no due date)" icon={<Inbox size={14} className="text-gray-400" />}>
          {data.unscheduled.map((task) => (
            <TaskRow key={task.id} task={task} onCycle={cycleStatus} statusIcon={statusIcon} />
          ))}
        </Section>
      )}

      {/* Empty state */}
      {data.dueTasks.length === 0 && data.inProgress.length === 0 && data.activeSessions.length === 0 && data.completedToday.length === 0 && (
        <div className="text-center text-gray-400 dark:text-gray-500 py-16">
          <CheckCircle size={32} className="mx-auto mb-3 text-green-500" />
          <p className="text-lg font-medium text-gray-600 dark:text-gray-300">All clear!</p>
          <p className="text-sm">No tasks due today. Go to My Tasks to plan ahead.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`${bg} rounded-lg p-3 border border-gray-200 dark:border-gray-700`}>
      <div className={`flex items-center gap-2 ${color} mb-1`}>
        {icon}
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-1">
        {icon}
        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">{title}</span>
      </div>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-50 dark:divide-gray-800">
        {children}
      </div>
    </div>
  );
}

function TaskRow({ task, onCycle, statusIcon, isOverdue }: {
  task: Todo & { project_name: string };
  onCycle: (t: Todo) => void;
  statusIcon: (s: string) => React.ReactNode;
  isOverdue?: boolean;
}) {
  return (
      <div className="flex items-center gap-2 sm:gap-3 py-2.5 px-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
      <button onClick={() => onCycle(task)} className="shrink-0">{statusIcon(task.status)}</button>
      <div className="flex-1 min-w-0">
        <span className={`text-sm block truncate ${task.status === 'done' ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
          {task.title}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">{task.project_name}</span>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 text-xs shrink-0">
        {task.estimate_hours && <span className="flex items-center gap-1 text-gray-400"><Clock size={10} /> {task.estimate_hours}h</span>}
        {task.due_date && (
          <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
            <Calendar size={10} /> {task.due_date}
          </span>
        )}
      </div>
    </div>
  );
}
