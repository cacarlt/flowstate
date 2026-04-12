import { useState, useEffect } from 'react';
import { Tab, AppConfig } from './types';
import { api } from './api';
import TasksView from './components/TasksView';
import AdoView from './components/AdoView';
import GithubView from './components/GithubView';
import SessionsView from './components/SessionsView';
import MyDayView from './components/MyDayView';
import { Sunrise, ClipboardList, GitBranch, Bot, Sun, Moon, CheckSquare } from 'lucide-react';

const allTabs: { key: Tab; label: string; icon: React.ReactNode; integration?: string }[] = [
  { key: 'myday', label: 'My Day', icon: <Sunrise size={16} /> },
  { key: 'tasks', label: 'My Tasks', icon: <CheckSquare size={16} /> },
  { key: 'ado', label: 'ADO Items', icon: <ClipboardList size={16} />, integration: 'ado' },
  { key: 'github', label: 'GitHub', icon: <GitBranch size={16} />, integration: 'github' },
  { key: 'sessions', label: 'Copilot Sessions', icon: <Bot size={16} /> },
];

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return [dark, () => setDark(!dark)] as const;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('myday');
  const [dark, toggleDark] = useDarkMode();
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    api.getConfig().then(setConfig).catch(() => {});
  }, []);

  const visibleTabs = allTabs.filter(
    (tab) => !tab.integration || (config?.integrations || []).includes(tab.integration)
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 tracking-tight">FlowState</h1>
            {config && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: config.profileColor }}
              >
                {config.profileName}
              </span>
            )}
          </div>
          <button
            onClick={toggleDark}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        {/* Tab bar */}
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-1">
            {visibleTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.key
                    ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-b-2 border-blue-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {activeTab === 'myday' && <MyDayView />}
        {activeTab === 'tasks' && <TasksView />}
        {activeTab === 'ado' && <AdoView />}
        {activeTab === 'github' && <GithubView />}
        {activeTab === 'sessions' && <SessionsView />}
      </main>
    </div>
  );
}
