import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { AdoItem, PatStatus } from '../types';
import { RefreshCw, ChevronRight, ChevronsDown, ChevronsUp, Layers, FileText, Shield, ExternalLink, AlertTriangle, CheckCircle, XCircle, HelpCircle } from 'lucide-react';

export default function AdoView() {
  const [items, setItems] = useState<AdoItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [configured, setConfigured] = useState(true);
  const [patStatus, setPatStatus] = useState<PatStatus | null>(null);
  const [showPatDetails, setShowPatDetails] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getAdoItems();
      setItems(data);
    } catch (err: any) {
      setItems([]);
    }
    try {
      const pat = await api.getAdoPatStatus();
      setPatStatus(pat);
    } catch (_) {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const sync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const result = await api.syncAdo();
      setItems(result.items || []);
    } catch (err: any) {
      if (err.message.includes('env vars')) {
        setConfigured(false);
      }
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const toggleSprint = (sprint: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(sprint) ? next.delete(sprint) : next.add(sprint);
      return next;
    });
  };

  // Group by sprint
  const bySprint: Record<string, AdoItem[]> = {};
  for (const item of items) {
    const key = item.sprint_name || 'Unassigned';
    if (!bySprint[key]) bySprint[key] = [];
    bySprint[key].push(item);
  }

  const sprintNames = Object.keys(bySprint).sort().reverse();

  const stateColor = (state: string | null) => {
    if (!state) return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
    const s = state.toLowerCase();
    if (s === 'done' || s === 'closed') return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300';
    if (s === 'active' || s === 'committed') return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300';
    if (s === 'new') return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
    return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300';
  };

  const typeIcon = (type: string) => type === 'Feature' ? <Layers size={14} className="text-purple-500" /> : <FileText size={14} className="text-blue-500" />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={sync}
          disabled={syncing}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync from ADO'}
        </button>
        {items.length > 0 && (
          <>
            <button onClick={() => setExpanded(new Set(sprintNames))} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1">
              <ChevronsDown size={14} /> Expand all
            </button>
            <button onClick={() => setExpanded(new Set())} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1">
              <ChevronsUp size={14} /> Collapse all
            </button>
          </>
        )}
      </div>

      {/* PAT Status Card */}
      {patStatus && (
        <div className={`border rounded-lg mb-4 overflow-hidden ${
          patStatus.status === 'active' ? 'border-green-200 dark:border-green-800' :
          patStatus.status === 'expiring_soon' ? 'border-amber-200 dark:border-amber-800' :
          patStatus.status === 'expired' || patStatus.status === 'not_configured' ? 'border-red-200 dark:border-red-800' :
          'border-gray-200 dark:border-gray-700'
        }`}>
          <div
            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 select-none"
            onClick={() => setShowPatDetails(!showPatDetails)}
          >
            <Shield size={16} className={
              patStatus.status === 'active' ? 'text-green-500' :
              patStatus.status === 'expiring_soon' ? 'text-amber-500' :
              patStatus.status === 'expired' || patStatus.status === 'not_configured' ? 'text-red-500' :
              'text-gray-400'
            } />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 flex-1">
              PAT: {patStatus.name || 'Not configured'}
            </span>
            {patStatus.status === 'active' && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <CheckCircle size={12} /> Active — {patStatus.daysRemaining}d left
              </span>
            )}
            {patStatus.status === 'expiring_soon' && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle size={12} /> Expiring soon — {patStatus.daysRemaining}d left
              </span>
            )}
            {patStatus.status === 'expired' && (
              <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                <XCircle size={12} /> Expired
              </span>
            )}
            {patStatus.status === 'not_configured' && (
              <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                <XCircle size={12} /> Not configured
              </span>
            )}
            {patStatus.status === 'unknown' && (
              <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                <HelpCircle size={12} /> Unknown
              </span>
            )}
            <ChevronRight size={14} className={`text-gray-400 transition-transform ${showPatDetails ? 'rotate-90' : ''}`} />
          </div>
          {showPatDetails && (
            <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 text-sm space-y-1.5">
              {patStatus.organization && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Organization</span>
                  <span className="text-gray-800 dark:text-gray-200">{patStatus.organization}</span>
                </div>
              )}
              {patStatus.scopes && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Scopes</span>
                  <span className="text-gray-800 dark:text-gray-200 font-mono text-xs">{patStatus.scopes}</span>
                </div>
              )}
              {patStatus.expiresAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Expires</span>
                  <span className="text-gray-800 dark:text-gray-200">{new Date(patStatus.expiresAt).toLocaleDateString()} ({patStatus.daysRemaining} days)</span>
                </div>
              )}
              {patStatus.manageUrl && (
                <a
                  href={patStatus.manageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline mt-2"
                >
                  Manage tokens <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {!configured && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
          <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">ADO not configured</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Set these environment variables on the server:
          </p>
          <code className="text-xs block mt-2 bg-amber-100 dark:bg-amber-900 p-2 rounded font-mono">
            ADO_ORG=your-org<br />
            ADO_PROJECT=your-project<br />
            ADO_PAT=your-personal-access-token
          </code>
        </div>
      )}

      {items.length === 0 && !error && (
        <div className="text-center text-gray-400 dark:text-gray-500 py-12">
          No ADO items synced yet. Click "Sync from ADO" to pull your PBIs and Features.
        </div>
      )}

      <div className="space-y-3">
        {sprintNames.map((sprint) => {
          const sprintItems = bySprint[sprint];
          const isExpanded = expanded.has(sprint);
          const features = sprintItems.filter((i) => i.type === 'Feature');
          const pbis = sprintItems.filter((i) => i.type === 'Product Backlog Item');

          return (
            <div key={sprint} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 select-none"
                onClick={() => toggleSprint(sprint)}
              >
                <span className="text-gray-400 transition-transform duration-200"
                  style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                  <ChevronRight size={14} />
                </span>
                <span className="font-semibold text-gray-800 dark:text-gray-100">{sprint}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{sprintItems.length} items</span>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                  {features.length > 0 && (
                    <div className="px-4 py-2">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Features</div>
                      {features.map((item) => (
                        <AdoItemRow key={item.id} item={item} stateColor={stateColor} typeIcon={typeIcon} />
                      ))}
                    </div>
                  )}
                  {pbis.length > 0 && (
                    <div className="px-4 py-2">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Product Backlog Items</div>
                      {pbis.map((item) => (
                        <AdoItemRow key={item.id} item={item} stateColor={stateColor} typeIcon={typeIcon} />
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

function AdoItemRow({ item, stateColor, typeIcon }: { item: AdoItem; stateColor: (s: string | null) => string; typeIcon: (t: string) => React.ReactNode }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-blue-50 dark:hover:bg-gray-800 rounded px-2 -mx-2 transition-colors"
    >
      <span>{typeIcon(item.type)}</span>
      <span className="text-sm text-gray-700 dark:text-gray-200 flex-1 min-w-0 truncate">{item.title}</span>
      <span className={`text-xs px-2 py-0.5 rounded-full ${stateColor(item.state)}`}>
        {item.state || 'Unknown'}
      </span>
      <span className="text-xs text-gray-400 dark:text-gray-500">#{item.ado_work_item_id}</span>
    </a>
  );
}
