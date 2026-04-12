import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { GithubItem } from '../types';
import { RefreshCw, ChevronRight, ChevronsDown, ChevronsUp, CircleDot, GitPullRequest, ExternalLink, Tag } from 'lucide-react';

export default function GithubView() {
  const [items, setItems] = useState<GithubItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const data = await api.getGithubIssues();
      setItems(data);
    } catch (_) {
      setItems([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const result = await api.syncGithub();
      setItems(result.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const toggleRepo = (repo: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(repo) ? next.delete(repo) : next.add(repo);
      return next;
    });
  };

  // Group by repo
  const byRepo: Record<string, GithubItem[]> = {};
  for (const item of items) {
    const key = item.repo || 'Unknown';
    if (!byRepo[key]) byRepo[key] = [];
    byRepo[key].push(item);
  }

  const repoNames = Object.keys(byRepo).sort();

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={sync}
          disabled={syncing}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync from GitHub'}
        </button>
        {items.length > 0 && (
          <>
            <button onClick={() => setExpanded(new Set(repoNames))} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1">
              <ChevronsDown size={14} /> Expand all
            </button>
            <button onClick={() => setExpanded(new Set())} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1">
              <ChevronsUp size={14} /> Collapse all
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {items.length === 0 && !error && (
        <div className="text-center text-gray-400 dark:text-gray-500 py-12">
          No GitHub items synced yet. Click "Sync from GitHub" to pull your issues and PRs.
        </div>
      )}

      <div className="space-y-3">
        {repoNames.map((repo) => {
          const repoItems = byRepo[repo];
          const isExpanded = expanded.has(repo);
          const issues = repoItems.filter((i) => i.type === 'issue');
          const prs = repoItems.filter((i) => i.type === 'pull_request');

          return (
            <div key={repo} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 select-none"
                onClick={() => toggleRepo(repo)}
              >
                <span className="text-gray-400 transition-transform duration-200"
                  style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                  <ChevronRight size={14} />
                </span>
                <span className="font-semibold text-gray-800 dark:text-gray-100">{repo}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{repoItems.length} items</span>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                  {issues.length > 0 && (
                    <div className="px-4 py-2">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Issues</div>
                      {issues.map((item) => (
                        <GithubItemRow key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                  {prs.length > 0 && (
                    <div className="px-4 py-2">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Pull Requests</div>
                      {prs.map((item) => (
                        <GithubItemRow key={item.id} item={item} />
                      ))}
                    </div>
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

function GithubItemRow({ item }: { item: GithubItem }) {
  const stateColor = item.state === 'open'
    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
    : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300';

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-blue-50 dark:hover:bg-gray-800 rounded px-2 -mx-2 transition-colors"
    >
      {item.type === 'pull_request'
        ? <GitPullRequest size={14} className="text-purple-500" />
        : <CircleDot size={14} className="text-green-500" />
      }
      <span className="text-sm text-gray-700 dark:text-gray-200 flex-1 min-w-0 truncate">{item.title}</span>
      {item.labels && (
        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
          <Tag size={10} /> {item.labels}
        </span>
      )}
      <span className={`text-xs px-2 py-0.5 rounded-full ${stateColor}`}>
        {item.state || 'unknown'}
      </span>
      <ExternalLink size={12} className="text-gray-300 dark:text-gray-600" />
    </a>
  );
}
