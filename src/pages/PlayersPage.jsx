import { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { getBootstrap } from '../lib/fpl-api';

const POSITION_MAP = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const POSITION_COLOR = {
  GKP: 'text-yellow-400',
  DEF: 'text-blue-400',
  MID: 'text-emerald-400',
  FWD: 'text-red-400',
};
const SORT_OPTIONS = [
  { value: 'total_points', label: 'Total Points' },
  { value: 'points_per_game', label: 'Pts/Game' },
  { value: 'form', label: 'Form' },
  { value: 'selected_by_percent', label: 'Owned %' },
  { value: 'now_cost', label: 'Price' },
  { value: 'goals_scored', label: 'Goals' },
  { value: 'assists', label: 'Assists' },
  { value: 'clean_sheets', label: 'Clean Sheets' },
  { value: 'bonus', label: 'Bonus' },
];
const COMPARE_COLORS = ['#10b981', '#3b82f6', '#f59e0b'];
const COMPARE_STATS = [
  { key: 'total_points', label: 'Pts' },
  { key: 'goals_scored', label: 'Goals' },
  { key: 'assists', label: 'Assists' },
  { key: 'clean_sheets', label: 'CS' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'points_per_game', label: 'PPG' },
];

export default function PlayersPage() {
  const [bootstrap, setBootstrap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('All');
  const [sortBy, setSortBy] = useState('total_points');
  const [compareList, setCompareList] = useState([]);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    getBootstrap()
      .then(setBootstrap)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const players = useMemo(() => {
    if (!bootstrap) return [];
    const teamMap = Object.fromEntries(bootstrap.teams.map((t) => [t.id, t]));

    return bootstrap.elements
      .map((p) => ({
        ...p,
        teamShort: teamMap[p.team]?.short_name || '',
        position: POSITION_MAP[p.element_type],
        cost: p.now_cost / 10,
      }))
      .filter((p) => {
        if (position !== 'All' && p.position !== position) return false;
        if (search) {
          const q = search.toLowerCase();
          const name = `${p.web_name} ${p.second_name} ${p.teamShort}`.toLowerCase();
          if (!name.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (parseFloat(b[sortBy]) || 0) - (parseFloat(a[sortBy]) || 0));
  }, [bootstrap, search, position, sortBy]);

  function toggleCompare(player) {
    setCompareList((prev) => {
      if (prev.find((p) => p.id === player.id))
        return prev.filter((p) => p.id !== player.id);
      if (prev.length >= 3) return [...prev.slice(1), player];
      return [...prev, player];
    });
  }

  if (loading) return <Skeleton />;
  if (error) return <ErrorCard error={error} />;

  const compareData = COMPARE_STATS.map(({ key, label }) => ({
    name: label,
    ...Object.fromEntries(
      compareList.map((p) => [p.web_name, parseFloat(p[key]) || 0])
    ),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold">Players</h1>
        {compareList.length > 0 && (
          <button
            onClick={() => setShowCompare((v) => !v)}
            className="btn-primary text-sm"
          >
            {showCompare ? 'Hide' : 'Compare'} ({compareList.length})
          </button>
        )}
      </div>

      {/* Compare chart */}
      {showCompare && compareList.length >= 2 && (
        <div className="card mb-5">
          <h2 className="font-semibold mb-4 text-gray-300">
            Comparing:{' '}
            {compareList.map((p, i) => (
              <span key={p.id} style={{ color: COMPARE_COLORS[i] }}>
                {p.web_name}
                {i < compareList.length - 1 ? ' vs ' : ''}
              </span>
            ))}
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={compareData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: '#111827',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {compareList.map((p, i) => (
                <Bar
                  key={p.id}
                  dataKey={p.web_name}
                  fill={COMPARE_COLORS[i]}
                  radius={[3, 3, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search player or team…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-36 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
        />
        <div className="flex gap-1 flex-wrap">
          {['All', 'GKP', 'DEF', 'MID', 'FWD'].map((p) => (
            <button
              key={p}
              onClick={() => setPosition(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                position === p
                  ? 'bg-emerald-500 text-black'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Sort: {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs border-b border-gray-800">
              <th className="py-3 pl-4 text-left">Player</th>
              <th className="py-3 pr-3 text-right">Cost</th>
              <th className="py-3 pr-3 text-right">Pts</th>
              <th className="py-3 pr-3 text-right hidden sm:table-cell">PPG</th>
              <th className="py-3 pr-3 text-right hidden sm:table-cell">Form</th>
              <th className="py-3 pr-3 text-right hidden md:table-cell">Owned</th>
              <th className="py-3 pr-4 text-center w-10"></th>
            </tr>
          </thead>
          <tbody>
            {players.slice(0, 60).map((p) => {
              const inCompare = compareList.find((c) => c.id === p.id);
              return (
                <tr
                  key={p.id}
                  className="border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="py-2.5 pl-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold ${POSITION_COLOR[p.position]}`}
                      >
                        {p.position}
                      </span>
                      <span className="font-medium">{p.web_name}</span>
                      <span className="text-gray-500 text-xs">{p.teamShort}</span>
                      {p.status !== 'a' && (
                        <span
                          title={p.news || 'Unavailable'}
                          className="text-xs bg-red-500/20 text-red-400 px-1 rounded"
                        >
                          {p.status === 'd'
                            ? `${p.chance_of_playing_next_round ?? '?'}%`
                            : '✕'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right text-gray-300">
                    £{p.cost}m
                  </td>
                  <td className="py-2.5 pr-3 text-right font-bold">{p.total_points}</td>
                  <td className="py-2.5 pr-3 text-right text-gray-300 hidden sm:table-cell">
                    {p.points_per_game}
                  </td>
                  <td className="py-2.5 pr-3 text-right hidden sm:table-cell">
                    <span
                      className={
                        parseFloat(p.form) > 7
                          ? 'text-emerald-400 font-semibold'
                          : parseFloat(p.form) > 4
                          ? 'text-yellow-400'
                          : 'text-gray-400'
                      }
                    >
                      {p.form}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right text-gray-400 hidden md:table-cell">
                    {p.selected_by_percent}%
                  </td>
                  <td className="py-2.5 pr-4 text-center">
                    <button
                      onClick={() => toggleCompare(p)}
                      title={inCompare ? 'Remove from compare' : 'Add to compare'}
                      className={`w-6 h-6 rounded text-xs font-bold transition-colors ${
                        inCompare
                          ? 'bg-emerald-500 text-black'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      {inCompare ? '✓' : '+'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {players.length > 60 && (
          <p className="text-center text-gray-600 text-xs py-3">
            Showing 60 of {players.length} — refine search to narrow results
          </p>
        )}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-800 rounded w-32" />
      <div className="card h-14" />
      <div className="card h-80" />
    </div>
  );
}

function ErrorCard({ error }) {
  return (
    <div className="card border-red-500/30 bg-red-500/5 text-red-400">
      <p className="font-semibold mb-1">Failed to load</p>
      <p className="text-sm opacity-80">{error}</p>
    </div>
  );
}
