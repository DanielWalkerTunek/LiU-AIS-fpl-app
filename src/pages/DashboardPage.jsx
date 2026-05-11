import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  getBootstrap,
  getLeagueStandings,
  getManagerPicks,
  getLiveGW,
} from '../lib/fpl-api';

const POSITION_LABEL = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const POSITION_COLOR = {
  1: 'bg-yellow-500/20 text-yellow-400',
  2: 'bg-blue-500/20 text-blue-400',
  3: 'bg-emerald-500/20 text-emerald-400',
  4: 'bg-red-500/20 text-red-400',
};

export default function DashboardPage() {
  const { leagueId } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bootstrap, setBootstrap] = useState(null);
  const [standings, setStandings] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [picks, setPicks] = useState(null);
  const [loadingPicks, setLoadingPicks] = useState(false);

  useEffect(() => {
    if (!leagueId) { setLoading(false); return; }

    async function load() {
      try {
        setLoading(true);
        const [bs, ls] = await Promise.all([
          getBootstrap(),
          getLeagueStandings(leagueId),
        ]);
        setBootstrap(bs);
        setStandings(ls);

        const gw =
          bs.events.find((e) => e.is_current)?.id ||
          [...bs.events].reverse().find((e) => e.finished)?.id ||
          1;

        const live = await getLiveGW(gw);
        setLiveData(live);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [leagueId]);

  async function selectManager(managerId) {
    const gw =
      bootstrap?.events.find((e) => e.is_current)?.id ||
      [...(bootstrap?.events || [])].reverse().find((e) => e.finished)?.id ||
      1;

    setSelected(managerId);
    setLoadingPicks(true);
    try {
      const p = await getManagerPicks(managerId, gw);
      setPicks(p);
    } catch {
      setPicks(null);
    } finally {
      setLoadingPicks(false);
    }
  }

  if (!leagueId) {
    return (
      <Empty icon="⚽" text="Enter your league ID in settings to start tracking." />
    );
  }
  if (loading) return <Skeleton />;
  if (error) return <ErrorCard error={error} />;

  const currentGw =
    bootstrap.events.find((e) => e.is_current) ||
    [...bootstrap.events].reverse().find((e) => e.finished);

  const managers = standings?.standings?.results || [];

  const playerMap = Object.fromEntries(
    bootstrap.elements.map((p) => [p.id, p])
  );
  const teamMap = Object.fromEntries(
    bootstrap.teams.map((t) => [t.id, t])
  );

  const livePoints = {};
  for (const el of liveData?.elements || []) {
    livePoints[el.id] = el.stats.total_points;
  }

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-0.5">
          <h1 className="text-2xl font-bold">Gameweek {currentGw?.id}</h1>
          {currentGw?.is_current && (
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
              LIVE
            </span>
          )}
        </div>
        <p className="text-gray-500 text-sm">{standings?.league?.name}</p>
      </div>

      {/* GW meta */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard
          label="Deadline"
          value={
            currentGw?.deadline_time
              ? new Date(currentGw.deadline_time).toLocaleString('en-GB', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'
          }
        />
        <StatCard
          label="Most Captained"
          value={
            currentGw?.most_captained
              ? playerMap[currentGw.most_captained]?.web_name || '—'
              : '—'
          }
        />
        <StatCard
          label="GW Average"
          value={currentGw?.average_entry_score ? `${currentGw.average_entry_score} pts` : '—'}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Manager scores */}
        <div className="card">
          <h2 className="font-semibold text-gray-300 mb-3 text-sm uppercase tracking-wide">
            GW Scores
          </h2>
          <div className="space-y-1">
            {managers.map((m) => (
              <button
                key={m.entry}
                onClick={() => selectManager(m.entry)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left ${
                  selected === m.entry
                    ? 'bg-emerald-500/10 border border-emerald-500/30'
                    : 'hover:bg-gray-800'
                }`}
              >
                <span className="text-gray-500 w-4 text-xs text-right">{m.rank}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{m.player_name}</div>
                  <div className="text-xs text-gray-500 truncate">{m.entry_name}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-400 text-sm">{m.event_total} pts</div>
                  <div className="text-xs text-gray-500">Total: {m.total}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Team picks */}
        <div className="card">
          <h2 className="font-semibold text-gray-300 mb-3 text-sm uppercase tracking-wide">
            {selected
              ? `${managers.find((m) => m.entry === selected)?.player_name}'s Team`
              : 'Team View'}
          </h2>

          {!selected && (
            <div className="text-center py-10 text-gray-600 text-sm">
              Click a manager to view their team
            </div>
          )}

          {selected && loadingPicks && (
            <div className="text-center py-10 text-gray-500 text-sm animate-pulse">
              Loading picks…
            </div>
          )}

          {selected && !loadingPicks && picks && (
            <>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
                <span>
                  Transfers: {picks.entry_history?.event_transfers}
                  {picks.entry_history?.event_transfers_cost > 0 &&
                    ` (−${picks.entry_history.event_transfers_cost}pts)`}
                </span>
                <span>
                  Bank: £{((picks.entry_history?.bank || 0) / 10).toFixed(1)}m
                </span>
                {picks.active_chip && (
                  <span className="text-yellow-400 font-medium">
                    Chip: {picks.active_chip}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {picks.picks?.map((pick, i) => {
                  const player = playerMap[pick.element];
                  const pts = livePoints[pick.element] ?? 0;
                  const displayPts = pick.multiplier > 1 ? pts * pick.multiplier : pts;
                  const onBench = pick.position > 11;

                  return (
                    <div
                      key={pick.element}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
                        onBench ? 'opacity-40' : ''
                      } ${i === 11 ? 'border-t border-dashed border-gray-700 mt-2 pt-3' : ''}`}
                    >
                      <span
                        className={`text-xs w-4 font-bold ${
                          pick.is_captain
                            ? 'text-yellow-400'
                            : pick.is_vice_captain
                            ? 'text-gray-400'
                            : 'text-transparent'
                        }`}
                      >
                        {pick.is_captain ? 'C' : pick.is_vice_captain ? 'V' : 'x'}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          POSITION_COLOR[player?.element_type] || 'bg-gray-700 text-gray-400'
                        }`}
                      >
                        {POSITION_LABEL[player?.element_type] || '?'}
                      </span>
                      <span className="flex-1 truncate">{player?.web_name || '—'}</span>
                      <span className="text-gray-500 text-xs">
                        {teamMap[player?.team]?.short_name}
                      </span>
                      <span
                        className={`font-bold w-7 text-right text-sm ${
                          displayPts > 0 ? 'text-emerald-400' : 'text-gray-600'
                        }`}
                      >
                        {displayPts}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-500">
                Bench pts: {picks.entry_history?.points_on_bench}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="font-semibold text-sm">{value}</div>
    </div>
  );
}

function Empty({ icon, text }) {
  return (
    <div className="text-center py-20 text-gray-500">
      <p className="text-4xl mb-3">{icon}</p>
      <p>{text}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-800 rounded w-48" />
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card h-14" />
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card h-64" />
        <div className="card h-64" />
      </div>
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
