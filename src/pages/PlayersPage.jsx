import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getBootstrap, getFixtures } from '../lib/fpl-api';
import { buildFixtureMap, getRecommendations } from '../lib/ml';

const POSITION_MAP   = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const POSITION_COLOR = {
  GKP: '#fbbf24',
  DEF: '#60a5fa',
  MID: '#40c4ff',
  FWD: '#f87171',
};
const SORT_OPTIONS = [
  { value: 'total_points',      label: 'Total Points' },
  { value: 'points_per_game',   label: 'Pts / Game' },
  { value: 'form',              label: 'Form' },
  { value: 'selected_by_percent', label: 'Owned %' },
  { value: 'now_cost',          label: 'Price' },
  { value: 'goals_scored',      label: 'Goals' },
  { value: 'assists',           label: 'Assists' },
  { value: 'clean_sheets',      label: 'Clean Sheets' },
  { value: 'bonus',             label: 'Bonus' },
];
const COMPARE_COLORS = ['#40c4ff', '#0070bb', '#fbbf24'];
const COMPARE_STATS  = [
  { key: 'total_points',    label: 'Pts' },
  { key: 'goals_scored',    label: 'Goals' },
  { key: 'assists',         label: 'Assists' },
  { key: 'clean_sheets',    label: 'CS' },
  { key: 'bonus',           label: 'Bonus' },
  { key: 'points_per_game', label: 'PPG' },
];
const REC_POSITIONS  = ['GKP', 'DEF', 'MID', 'FWD'];
const REC_SORT_MODES = [
  { value: 'xpts',         label: 'xPts',         desc: 'Highest expected points' },
  { value: 'value',        label: 'Value',         desc: 'Best xPts per £m' },
  { value: 'differential', label: 'Differential',  desc: '<10% ownership' },
];
// FDR 1-5: green → red
const FDR_BG   = ['', '#16a34a', '#65a30d', '#ca8a04', '#ea580c', '#dc2626'];
const FDR_TEXT = ['', '#fff',    '#fff',    '#fff',    '#fff',    '#fff'];

export default function PlayersPage() {
  const [bootstrap,   setBootstrap]   = useState(null);
  const [fixtures,    setFixtures]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [mode,        setMode]        = useState('browse'); // 'browse' | 'recommend'

  const [search,      setSearch]      = useState('');
  const [position,    setPosition]    = useState('All');
  const [sortBy,      setSortBy]      = useState('total_points');
  const [compareList, setCompareList] = useState([]);
  const [showCompare, setShowCompare] = useState(false);

  const [recPosition,  setRecPosition]  = useState('MID');
  const [recSortMode,  setRecSortMode]  = useState('xpts');
  const [recMaxBudget, setRecMaxBudget] = useState('');

  useEffect(() => {
    Promise.all([getBootstrap(), getFixtures()])
      .then(([bs, fx]) => { setBootstrap(bs); setFixtures(fx); })
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
        position:  POSITION_MAP[p.element_type],
        cost:      p.now_cost / 10,
      }))
      .filter((p) => {
        if (position !== 'All' && p.position !== position) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!`${p.web_name} ${p.second_name} ${p.teamShort}`.toLowerCase().includes(q))
            return false;
        }
        return true;
      })
      .sort((a, b) => (parseFloat(b[sortBy]) || 0) - (parseFloat(a[sortBy]) || 0));
  }, [bootstrap, search, position, sortBy]);

  const { recPlayers, fixturesByTeam, teamMap } = useMemo(() => {
    if (!bootstrap || !fixtures.length)
      return { recPlayers: [], fixturesByTeam: {}, teamMap: {} };

    const currentGw =
      bootstrap.events.find((e) => e.is_current)?.id ||
      [...bootstrap.events].reverse().find((e) => e.finished)?.id ||
      bootstrap.events.find((e) => e.is_next)?.id || 1;

    const teamMap        = Object.fromEntries(bootstrap.teams.map((t) => [t.id, t]));
    const fixturesByTeam = buildFixtureMap(fixtures, currentGw);
    const budget         = recMaxBudget ? parseFloat(recMaxBudget) : null;
    const recs           = getRecommendations(bootstrap.elements, fixturesByTeam, recPosition, budget);

    const list =
      recSortMode === 'xpts'  ? recs.topXpts :
      recSortMode === 'value' ? recs.topValue :
                                 recs.differentials;

    return { recPlayers: list, fixturesByTeam, teamMap };
  }, [bootstrap, fixtures, recPosition, recSortMode, recMaxBudget]);

  function toggleCompare(player) {
    setCompareList((prev) => {
      if (prev.find((p) => p.id === player.id)) return prev.filter((p) => p.id !== player.id);
      if (prev.length >= 3) return [...prev.slice(1), player];
      return [...prev, player];
    });
  }

  if (loading) return <Skeleton />;
  if (error)   return <ErrorCard error={error} />;

  const compareData = COMPARE_STATS.map(({ key, label }) => ({
    name: label,
    ...Object.fromEntries(compareList.map((p) => [p.web_name, parseFloat(p[key]) || 0])),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Players</h1>
        <div className="flex items-center gap-2">
          {mode === 'browse' && compareList.length > 0 && (
            <button onClick={() => setShowCompare((v) => !v)} className="btn-primary text-sm">
              {showCompare ? 'Hide' : 'Compare'} ({compareList.length})
            </button>
          )}
          <div className="flex gap-1">
            {[{ value: 'browse', label: 'Browse' }, { value: 'recommend', label: 'Recommend' }].map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-widest transition-all"
                style={
                  mode === m.value
                    ? { background: 'linear-gradient(135deg,#0070bb,#09ddff)', color: '#fff' }
                    : { background: 'rgba(255,255,255,0.05)', color: '#7a94b0', border: '1px solid rgba(255,255,255,0.06)' }
                }
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode === 'browse' ? (
        <>
          {/* Compare chart */}
          {showCompare && compareList.length >= 2 && (
            <div className="card mb-5">
              <h2 className="font-semibold mb-4 text-white">
                Comparing:{' '}
                {compareList.map((p, i) => (
                  <span key={p.id} style={{ color: COMPARE_COLORS[i] }}>
                    {p.web_name}{i < compareList.length - 1 ? ' vs ' : ''}
                  </span>
                ))}
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={compareData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: '#7a94b0', fontSize: 11, fontFamily: 'Geist Mono' }} />
                  <YAxis tick={{ fill: '#7a94b0', fontSize: 11, fontFamily: 'Geist Mono' }} />
                  <Tooltip
                    contentStyle={{
                      background: '#070f1d',
                      border: '1px solid rgba(64,196,255,0.2)',
                      borderRadius: '10px',
                      fontSize: 12,
                      fontFamily: 'Geist Mono',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Geist Mono' }} />
                  {compareList.map((p, i) => (
                    <Bar key={p.id} dataKey={p.web_name} fill={COMPARE_COLORS[i]} radius={[3, 3, 0, 0]} />
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
              className="flex-1 min-w-36 rounded-xl px-3 py-1.5 text-sm font-mono text-white focus:outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(64,196,255,0.45)';
                e.target.style.background  = 'rgba(64,196,255,0.04)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                e.target.style.background  = 'rgba(255,255,255,0.05)';
              }}
            />
            <div className="flex gap-1 flex-wrap">
              {['All', 'GKP', 'DEF', 'MID', 'FWD'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPosition(p)}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-widest transition-all"
                  style={
                    position === p
                      ? { background: 'linear-gradient(135deg,#0070bb,#09ddff)', color: '#fff' }
                      : { background: 'rgba(255,255,255,0.05)', color: '#7a94b0', border: '1px solid rgba(255,255,255,0.06)' }
                  }
                >
                  {p}
                </button>
              ))}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl px-3 py-1.5 text-sm font-mono text-white focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} style={{ background: '#070f1d' }}>
                  Sort: {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs font-mono uppercase tracking-widest text-liu-muted"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
                >
                  <th className="py-3 pl-5 text-left">Player</th>
                  <th className="py-3 pr-3 text-right">Cost</th>
                  <th className="py-3 pr-3 text-right">Pts</th>
                  <th className="py-3 pr-3 text-right hidden sm:table-cell">PPG</th>
                  <th className="py-3 pr-3 text-right hidden sm:table-cell">Form</th>
                  <th className="py-3 pr-3 text-right hidden md:table-cell">Owned</th>
                  <th className="py-3 pr-5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody>
                {players.slice(0, 60).map((p) => {
                  const inCompare = !!compareList.find((c) => c.id === p.id);
                  const formVal   = parseFloat(p.form);
                  return (
                    <tr
                      key={p.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="py-2.5 pl-5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold" style={{ color: POSITION_COLOR[p.position] }}>
                            {p.position}
                          </span>
                          <span className="font-medium text-white">{p.web_name}</span>
                          <span className="text-liu-muted text-xs font-mono">{p.teamShort}</span>
                          {p.status !== 'a' && (
                            <span
                              title={p.news || 'Unavailable'}
                              className="text-xs px-1.5 py-0.5 rounded font-mono"
                              style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}
                            >
                              {p.status === 'd' ? `${p.chance_of_playing_next_round ?? '?'}%` : '✕'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono text-liu-muted">£{p.cost}m</td>
                      <td className="py-2.5 pr-3 text-right font-bold font-mono text-white">{p.total_points}</td>
                      <td className="py-2.5 pr-3 text-right font-mono text-liu-muted hidden sm:table-cell">{p.points_per_game}</td>
                      <td className="py-2.5 pr-3 text-right font-mono hidden sm:table-cell">
                        <span style={{ color: formVal > 7 ? '#40c4ff' : formVal > 4 ? '#fbbf24' : '#7a94b0', fontWeight: formVal > 7 ? 600 : 400 }}>
                          {p.form}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono text-liu-muted hidden md:table-cell">
                        {p.selected_by_percent}%
                      </td>
                      <td className="py-2.5 pr-5 text-center">
                        <button
                          onClick={() => toggleCompare(p)}
                          title={inCompare ? 'Remove from compare' : 'Add to compare'}
                          className="w-6 h-6 rounded-lg text-xs font-bold transition-all"
                          style={
                            inCompare
                              ? { background: 'linear-gradient(135deg,#0070bb,#09ddff)', color: '#fff' }
                              : { background: 'rgba(255,255,255,0.07)', color: '#7a94b0', border: '1px solid rgba(255,255,255,0.08)' }
                          }
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
              <div
                className="text-center text-xs font-mono text-liu-muted py-3"
                style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
              >
                Showing 60 of {players.length} — refine search to narrow results
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Recommendation controls */}
          <div className="card mb-4 flex flex-wrap gap-3 items-center">
            <div className="flex gap-1">
              {REC_POSITIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => setRecPosition(p)}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-widest transition-all"
                  style={
                    recPosition === p
                      ? { background: 'linear-gradient(135deg,#0070bb,#09ddff)', color: '#fff' }
                      : { background: 'rgba(255,255,255,0.05)', color: '#7a94b0', border: '1px solid rgba(255,255,255,0.06)' }
                  }
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="flex gap-1">
              {REC_SORT_MODES.map((m) => (
                <button
                  key={m.value}
                  title={m.desc}
                  onClick={() => setRecSortMode(m.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-widest transition-all"
                  style={
                    recSortMode === m.value
                      ? { background: 'rgba(64,196,255,0.12)', color: '#40c4ff', border: '1px solid rgba(64,196,255,0.25)' }
                      : { background: 'rgba(255,255,255,0.04)', color: '#7a94b0', border: '1px solid rgba(255,255,255,0.06)' }
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-sm font-mono">
              <span className="text-liu-muted">Max £</span>
              <input
                type="number"
                step="0.1"
                min="4"
                max="15"
                value={recMaxBudget}
                onChange={(e) => setRecMaxBudget(e.target.value)}
                placeholder="any"
                className="w-20 rounded-xl px-3 py-1.5 text-sm font-mono text-white focus:outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(64,196,255,0.45)'; }}
                onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              />
              <span className="text-liu-muted">m</span>
            </div>
          </div>

          {/* Model explainer */}
          <div
            className="mb-4 px-4 py-2.5 rounded-xl text-xs font-mono"
            style={{ background: 'rgba(64,196,255,0.06)', border: '1px solid rgba(64,196,255,0.15)', color: '#9bdfff' }}
          >
            <strong>xPts</strong> = (form-weighted PPG, or PPG alone pre-season) × fixture factor × availability ·{' '}
            <strong>Value</strong> = xPts / cost · Fixture: green = easy, red = hard
          </div>

          {/* Cards */}
          <div className="space-y-2">
            {recPlayers.length === 0 ? (
              <div className="card text-center text-liu-muted font-mono py-10">
                No players match the current filters.
              </div>
            ) : (
              recPlayers.map((p, i) => (
                <RecommendationCard
                  key={p.id}
                  rank={i + 1}
                  player={p}
                  teamMap={teamMap}
                  upcomingFixtures={(fixturesByTeam[p.team] || []).slice(0, 5)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function RecommendationCard({ rank, player, teamMap, upcomingFixtures }) {
  const team = teamMap[player.team];

  return (
    <div className="card transition-all" style={{ cursor: 'default' }}>
      <div className="flex items-center gap-3">
        <span className="text-liu-muted w-5 text-xs text-right font-mono">{rank}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-xs font-mono font-semibold" style={{ color: POSITION_COLOR[POSITION_MAP[player.element_type]] }}>
              {POSITION_MAP[player.element_type]}
            </span>
            <span className="font-semibold text-white">{player.web_name}</span>
            <span className="text-liu-muted text-xs font-mono">{team?.short_name}</span>
            {player.status !== 'a' && (
              <span
                className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}
              >
                {player.status === 'd' ? `${player.chance_of_playing_next_round ?? '?'}% fit` : 'OUT'}
              </span>
            )}
            {player.ownership < 5 && (
              <span
                className="text-xs font-mono px-1.5 py-0.5 rounded uppercase tracking-widest"
                style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' }}
              >
                DIFF
              </span>
            )}
          </div>
          <div className="flex gap-3 text-xs font-mono text-liu-muted">
            <span>Form <strong className="text-white">{player.form}</strong></span>
            <span>PPG <strong className="text-white">{player.points_per_game}</strong></span>
            <span>Owned <strong className="text-white">{player.ownership}%</strong></span>
          </div>
        </div>

        {/* Fixture chips */}
        <div className="hidden sm:flex items-center gap-1">
          {upcomingFixtures.map((f, i) => {
            const opp = teamMap[f.opponent];
            return (
              <div
                key={i}
                title={`${f.isHome ? 'H' : 'A'} · FDR ${f.difficulty}`}
                className="w-8 text-center text-[10px] font-mono font-bold rounded py-0.5"
                style={{
                  background: FDR_BG[f.difficulty] || '#334155',
                  color:      FDR_TEXT[f.difficulty] || '#fff',
                }}
              >
                {opp?.short_name || '?'}
              </div>
            );
          })}
        </div>

        {/* Scores */}
        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-liu-muted">xPts</div>
            <div className="font-bold text-lg leading-none font-mono" style={{ color: '#40c4ff' }}>
              {player.xpts}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-liu-muted">Cost</div>
            <div className="font-bold font-mono text-white">£{player.cost}m</div>
          </div>
          <div className="hidden sm:block">
            <div className="text-[10px] font-mono uppercase tracking-widest text-liu-muted">Value</div>
            <div className="font-semibold font-mono" style={{ color: '#60a5fa' }}>{player.valueScore}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 rounded-xl w-32" style={{ background: 'rgba(255,255,255,0.05)' }} />
      <div className="card h-14" />
      <div className="card h-80" />
    </div>
  );
}

function ErrorCard({ error }) {
  return (
    <div className="card text-sm" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', color: '#f87171' }}>
      <p className="font-semibold mb-1">Failed to load</p>
      <p className="opacity-80">{error}</p>
    </div>
  );
}
