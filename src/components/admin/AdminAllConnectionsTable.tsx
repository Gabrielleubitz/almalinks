import React, { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Zap, UserPlus, Link2 } from 'lucide-react';
import {
  AdminConnectionService,
  AdminConnectionListRow,
  PrimaryConnectionKind
} from '../../services/adminConnectionService';

const KIND_STYLES: Record<
  PrimaryConnectionKind,
  { className: string; Icon: typeof Zap }
> = {
  auto: { className: 'bg-green-100 text-green-900 border-green-200', Icon: Zap },
  manual: { className: 'bg-purple-100 text-purple-900 border-purple-200', Icon: UserPlus },
  admin: { className: 'bg-amber-100 text-amber-900 border-amber-200', Icon: Link2 }
};

interface AdminAllConnectionsTableProps {
  className?: string;
  maxRows?: number;
}

const AdminAllConnectionsTable: React.FC<AdminAllConnectionsTableProps> = ({
  className = '',
  maxRows = 300
}) => {
  const [rows, setRows] = useState<AdminConnectionListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<PrimaryConnectionKind | 'all'>('all');

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await AdminConnectionService.getAllConnectionsEnriched(maxRows);
      setRows(data);
    } catch (e) {
      console.error(e);
      setError('Could not load connections. Check Firestore rules and indexes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [maxRows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (kindFilter !== 'all' && r.primaryKind !== kindFilter) return false;
      if (!q) return true;
      const hay = [
        r.personAName,
        r.personBName,
        r.personAEmail,
        r.personBEmail,
        r.sourceSummary,
        r.primaryLabel,
        r.id,
        r.uid1,
        r.uid2
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, kindFilter]);

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6 ${className}`}>
      <div className="flex flex-col gap-4 mb-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">All connections</h3>
          <p className="mt-1 text-sm text-gray-600">
            Every member-to-member link in Alma, newest first.{' '}
            <span className="font-medium text-gray-800">Source</span> is derived from stored reasons:{' '}
            <span className="text-green-800">by event</span> (check-in / event flows),{' '}
            <span className="text-purple-800">by request</span> (member-initiated),{' '}
            <span className="text-amber-800">by admin</span> (dashboard or bulk tools).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              placeholder="Search by name, email, UID, or source…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={kindFilter}
              onChange={e => setKindFilter(e.target.value as PrimaryConnectionKind | 'all')}
              className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All sources</option>
              <option value="auto">By event</option>
              <option value="manual">By request</option>
              <option value="admin">By admin</option>
            </select>
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-700 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">Loading connections…</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-3">
            Showing {filtered.length} of {rows.length} loaded
            {rows.length >= maxRows ? ` (max ${maxRows} most recent)` : ''}.
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-200 -mx-px">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="py-3 px-3 font-semibold text-gray-900">Members</th>
                  <th className="py-3 px-3 font-semibold text-gray-900">Source</th>
                  <th className="py-3 px-3 font-semibold text-gray-900">Details</th>
                  <th className="py-3 px-3 font-semibold text-gray-900 whitespace-nowrap">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 px-4 text-center text-gray-600">
                      No connections match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map(r => {
                    const style = KIND_STYLES[r.primaryKind];
                    const Icon = style.Icon;
                    return (
                      <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80 align-top">
                        <td className="py-3 px-3">
                          <div className="font-medium text-gray-900">{r.personAName}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[220px]">{r.personAEmail}</div>
                          <div className="mt-1 text-gray-400">↔</div>
                          <div className="font-medium text-gray-900">{r.personBName}</div>
                          <div className="text-xs text-gray-500 truncate max-w-[220px]">{r.personBEmail}</div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${style.className}`}
                          >
                            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                            {r.primaryLabel}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-gray-700 max-w-md">
                          <span className="line-clamp-3" title={r.sourceSummary}>
                            {r.sourceSummary}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-gray-600 whitespace-nowrap text-xs">
                          {r.updatedAtLabel}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminAllConnectionsTable;
