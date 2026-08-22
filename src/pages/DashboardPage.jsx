import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  getBootstrap,
  getLeagueMembers,
  getManagerPicks,
  getLiveGW,
} from '../lib/fpl-api';

const POS_LABEL = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const POS_COLOR = {
  1: { bg: 'rgba(234,179,8,0.15)',  color: '#fbbf24' },
  2: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  3: { bg: 'rgba(64,196,255,0.15)', color: '#40c4ff' },
  4: { bg: 'rgba(239,68,68,0.15)',  color: '#f87171' },
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
        const [bs, ls] = await Promise.all([getBootstrap(), getLeagueMembers(leagueId)]);
        setBootstrap(bs);
        setStandings(ls);
        const gw =
          bs.events.find((e) => e.is_current)?.id ||
          [...bs.events].reverse().find((e) => e.finished)?.id || 1;
        setLiveData(await getLiveGW(gw));
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
      [...(bootstrap?.events || [])].reverse().find((e) => e.finished)?.id || 1;
    setSelected(managerId);
    setLoadingPicks(true);
    try { setPicks(await getManagerPicks(managerId, gw)); }
    catch { setPicks(null); }
    finally { setLoadingPicks(false); }
  }

  if (!leagueId) return <Empty text="Enter your league ID in settings to start tracking." />;
  if (loading) return <Skeleton />;
  if (error) return <ErrorCard error={error} />;

  const currentGw =
    bootstrap.events.find((e) => e.is_current) ||
    [...bootstrap.events].reverse().find((e) => e.finished) ||
    bootstrap.events.find((e) => e.is_next) ||
    bootstrap.events[0];
  const managers = standings?.members || [];
  const playerMap = Object.fromEntries(bootstrap.elements.map((p) => [p.id, p]));
  const teamMap   = Object.fromEntries(bootstrap.teams.map((t) => [t.id, t]));
  const livePoints = Object.fromEntries(
    (liveData?.elements || []).map((el) => [el.id, el.stats.total_points])
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-0.5">
          <h1 className="text-2xl font-bold tracking-tight">Gameweek {currentGw?.id}</h1>
          {currentGw?.is_current && (
            <span
              className="text-xs font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(64,196,255,0.12)', color: '#40c4ff', border: '1px solid rgba(64,196,255,0.25)' }}
            >
              LIVE
            </span>
          )}
        </div>
        <p className="text-liu-muted text-sm font-mono">{standings?.league?.name || 'LiU AIS'}</p>
      </div>

      {/* GW meta */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          {
            label: 'Deadline',
            value: currentGw?.deadline_time
              ? new Date(currentGw.deadline_time).toLocaleString('en-GB', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })
              : '—',
          },
          {
            label: 'Most Captained',
            value: currentGw?.most_captained
              ? playerMap[currentGw.most_captained]?.web_name || '—'
              : '—',
          },
          {
            label: 'GW Average',
            value: currentGw?.average_entry_score ? `${currentGw.average_entry_score} pts` : '—',
          },
        ].map(({ label, value }) => (
          <div key={label} className="card">
            <div className="text-xs font-mono uppercase tracking-widest text-liu-muted mb-1">{label}</div>
            <div className="font-semibold text-sm">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Manager scores */}
        <div className="card">
          <h2 className="text-xs font-mono uppercase tracking-widest text-liu-muted mb-3">GW Scores</h2>
          <div className="space-y-1">
            {managers.map((m) => (
              <button
                key={m.entry}
                onClick={() => selectManager(m.entry)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                style={
                  selected === m.entry
                    ? { background: 'rgba(64,196,255,0.08)', border: '1px solid rgba(64,196,255,0.22)' }
                    : { border: '1px solid transparent' }
                }
                onMouseEnter={(e) => {
                  if (selected !== m.entry)
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }}
                onMouseLeave={(e) => {
                  if (selected !== m.entry)
                    e.currentTarget.style.background = 'transparent';
                }}
              >
                <span className="text-liu-muted w-4 text-xs text-right font-mono">{m.rank}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate text-white">{m.player_name}</div>
                  <div className="text-xs text-liu-muted truncate">{m.entry_name}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm" style={{ color: '#40c4ff' }}>{m.event_total} pts</div>
                  <div className="text-xs text-liu-muted">Total: {m.total}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Team picks */}
        <div className="card">
          <h2 className="text-xs font-mono uppercase tracking-widest text-liu-muted mb-3">
            {selected
              ? `${managers.find((m) => m.entry === selected)?.player_name}'s Team`
              : 'Team View'}
          </h2>

          {!selected && (
            <div className="text-center py-10 text-liu-muted text-sm">
              Click a manager to view their team
            </div>
          )}

          {selected && loadingPicks && (
            <div className="text-center py-10 text-liu-muted text-sm animate-pulse">
              Loading picks…
            </div>
          )}

          {selected && !loadingPicks && picks && (
            <>
              <div className="flex flex-wrap gap-3 text-xs text-liu-muted mb-3 font-mono">
                <span>
                  Transfers: {picks.entry_history?.event_transfers}
                  {picks.entry_history?.event_transfers_cost > 0 &&
                    ` (−${picks.entry_history.event_transfers_cost}pts)`}
                </span>
                <span>Bank: £{((picks.entry_history?.bank || 0) / 10).toFixed(1)}m</span>
                {picks.active_chip && (
                  <span style={{ color: '#fbbf24' }}>Chip: {picks.active_chip}</span>
                )}
              </div>

              <div className="space-y-0.5">
                {picks.picks?.map((pick, i) => {
                  const player = playerMap[pick.element];
                  const pts = livePoints[pick.element] ?? 0;
                  const displayPts = pick.multiplier > 1 ? pts * pick.multiplier : pts;
                  const onBench = pick.position > 11;
                  const pc = POS_COLOR[player?.element_type];

                  return (
                    <div
                      key={pick.element}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-opacity ${onBench ? 'opacity-40' : ''} ${i === 11 ? 'mt-2 border-t' : ''}`}
                      style={i === 11 ? { borderColor: 'rgba(255,255,255,0.06)' } : {}}
                    >
                      <span
                        className="text-xs w-4 font-bold font-mono"
                        style={{
                          color: pick.is_captain ? '#fbbf24' : pick.is_vice_captain ? '#7a94b0' : 'transparent',
                        }}
                      >
                        {pick.is_captain ? 'C' : pick.is_vice_captain ? 'V' : 'x'}
                      </span>
                      {pc && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold"
                          style={{ background: pc.bg, color: pc.color }}
                        >
                          {POS_LABEL[player?.element_type]}
                        </span>
                      )}
                      <span className="flex-1 truncate text-white">{player?.web_name || '—'}</span>
                      <span className="text-liu-muted text-xs font-mono">
                        {teamMap[player?.team]?.short_name}
                      </span>
                      <span
                        className="font-bold w-7 text-right text-sm font-mono"
                        style={{ color: displayPts > 0 ? '#40c4ff' : 'rgba(122,148,176,0.4)' }}
                      >
                        {displayPts}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div
                className="mt-3 pt-3 text-xs text-liu-muted font-mono"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                Bench pts: {picks.entry_history?.points_on_bench}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="text-center py-24 text-liu-muted">
      <p className="font-mono text-sm">{text}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 rounded-xl w-48" style={{ background: 'rgba(255,255,255,0.05)' }} />
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
    <div
      className="card text-sm"
      style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', color: '#f87171' }}
    >
      <p className="font-semibold mb-1">Failed to load</p>
      <p className="opacity-80">{error}</p>
    </div>
  );
}
