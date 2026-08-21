import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getBootstrap, getManagerEntry, getManagerPicks, getLiveGW } from '../lib/fpl-api';

const POS_COLOR = {
  1: { bg: 'rgba(234,179,8,0.85)',  color: '#0a1120' },
  2: { bg: 'rgba(59,130,246,0.85)', color: '#0a1120' },
  3: { bg: 'rgba(64,196,255,0.85)', color: '#0a1120' },
  4: { bg: 'rgba(239,68,68,0.85)',  color: '#0a1120' },
};

export default function MyTeamPage() {
  const { user, profile } = useOutletContext();
  const fplId = profile?.fpl_manager_id;

  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [bootstrap,  setBootstrap]  = useState(null);
  const [entry,      setEntry]      = useState(null);
  const [picks,      setPicks]      = useState(null);
  const [picksError, setPicksError] = useState(null);
  const [liveData,   setLiveData]   = useState(null);

  useEffect(() => {
    if (!fplId) { setLoading(false); return; }
    async function load() {
      try {
        setLoading(true);
        setPicksError(null);
        const [bs, ent] = await Promise.all([getBootstrap(), getManagerEntry(fplId)]);
        setBootstrap(bs);
        setEntry(ent);

        const gw =
          bs.events.find((e) => e.is_current)?.id ||
          [...bs.events].reverse().find((e) => e.finished)?.id ||
          bs.events.find((e) => e.is_next)?.id || 1;

        try {
          const [pk, live] = await Promise.all([getManagerPicks(fplId, gw), getLiveGW(gw)]);
          setPicks(pk);
          setLiveData(live);
        } catch {
          setPicksError('Picks aren’t public until the gameweek deadline passes — check back after kickoff.');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [fplId]);

  if (!user) return <Empty icon="👤" text="Sign in to see your team." />;
  if (!fplId) return <Empty icon="⚽" text="Add your FPL Manager ID in your profile (account button) to see your team." />;
  if (loading) return <Skeleton />;
  if (error) return <ErrorCard error={error} />;

  const playerMap = Object.fromEntries(bootstrap.elements.map((p) => [p.id, p]));
  const teamMap   = Object.fromEntries(bootstrap.teams.map((t) => [t.id, t]));
  const livePoints = Object.fromEntries(
    (liveData?.elements || []).map((el) => [el.id, el.stats.total_points])
  );

  const starting = (picks?.picks || []).filter((p) => p.position <= 11);
  const bench    = (picks?.picks || []).filter((p) => p.position > 11).sort((a, b) => a.position - b.position);
  const formation = [1, 2, 3, 4]
    .map((type) => starting.filter((p) => playerMap[p.element]?.element_type === type).length)
    .slice(1) // drop GK from the formation label
    .join('-');

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">{entry.name}</h1>
        <p className="text-liu-muted text-sm font-mono">
          {entry.player_first_name} {entry.player_last_name}
        </p>
      </div>

      {/* Summary meta */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Overall Points', value: entry.summary_overall_points ?? '—' },
          { label: 'Overall Rank', value: entry.summary_overall_rank ? entry.summary_overall_rank.toLocaleString() : '—' },
          {
            label: 'Bank',
            value: picks?.entry_history?.bank != null ? `£${(picks.entry_history.bank / 10).toFixed(1)}m` : '—',
          },
          {
            label: 'Team Value',
            value: picks?.entry_history?.value != null ? `£${(picks.entry_history.value / 10).toFixed(1)}m` : '—',
          },
        ].map(({ label, value }) => (
          <div key={label} className="card">
            <div className="text-xs font-mono uppercase tracking-widest text-liu-muted mb-1">{label}</div>
            <div className="font-semibold text-sm">{value}</div>
          </div>
        ))}
      </div>

      {picksError && (
        <div className="card text-center py-10 text-liu-muted text-sm font-mono">{picksError}</div>
      )}

      {!picksError && picks && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex flex-wrap gap-3 text-xs text-liu-muted font-mono">
              <span>
                Transfers: {picks.entry_history?.event_transfers}
                {picks.entry_history?.event_transfers_cost > 0 &&
                  ` (−${picks.entry_history.event_transfers_cost}pts)`}
              </span>
              <span>GW Points: {picks.entry_history?.points}</span>
              {picks.active_chip && (
                <span style={{ color: '#fbbf24' }}>Chip: {picks.active_chip}</span>
              )}
            </div>
            {formation && (
              <span className="text-xs font-mono uppercase tracking-widest text-liu-muted">
                Formation {formation}
              </span>
            )}
          </div>

          <Pitch picks={starting} playerMap={playerMap} teamMap={teamMap} livePoints={livePoints} />

          <div className="mt-4">
            <h2 className="text-xs font-mono uppercase tracking-widest text-liu-muted mb-2">
              Bench · {picks.entry_history?.points_on_bench} pts
            </h2>
            <div className="card flex justify-center gap-4 md:gap-8 flex-wrap py-5">
              {bench.map((pick) => (
                <PlayerToken
                  key={pick.element}
                  pick={pick}
                  player={playerMap[pick.element]}
                  team={teamMap[playerMap[pick.element]?.team]}
                  livePoints={livePoints}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Pitch({ picks, playerMap, teamMap, livePoints }) {
  const rows = [1, 2, 3, 4].map((type) =>
    picks.filter((p) => playerMap[p.element]?.element_type === type)
  );

  return (
    <div
      className="relative rounded-2xl overflow-hidden p-4 md:p-6 space-y-4 md:space-y-8"
      style={{
        background: 'radial-gradient(ellipse at center, #0f4028 0%, #0a2e1c 65%, #082418 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Pitch markings */}
      <div
        className="absolute inset-4 md:inset-6 rounded-lg pointer-events-none"
        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
      />
      <div
        className="absolute left-1/2 top-1/2 w-20 h-20 md:w-28 md:h-28 rounded-full pointer-events-none"
        style={{ border: '1px solid rgba(255,255,255,0.1)', transform: 'translate(-50%, -50%)' }}
      />
      <div
        className="absolute left-4 right-4 md:left-6 md:right-6 top-1/2 pointer-events-none"
        style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
      />

      {rows.map((row, i) => (
        <div key={i} className="relative z-10 flex justify-center gap-3 md:gap-8 flex-wrap">
          {row.map((pick) => (
            <PlayerToken
              key={pick.element}
              pick={pick}
              player={playerMap[pick.element]}
              team={teamMap[playerMap[pick.element]?.team]}
              livePoints={livePoints}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function PlayerToken({ pick, player, team, livePoints }) {
  const pts = livePoints[pick.element] ?? 0;
  const displayPts = pick.multiplier > 1 ? pts * pick.multiplier : pts;
  const pc = POS_COLOR[player?.element_type];

  return (
    <div className="flex flex-col items-center gap-1 w-16 md:w-20">
      <div className="relative">
        <div
          className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold font-mono shrink-0"
          style={{ background: pc?.bg, color: pc?.color, boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }}
        >
          {team?.short_name || '—'}
        </div>
        {(pick.is_captain || pick.is_vice_captain) && (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold font-mono"
            style={{
              background: pick.is_captain ? '#fbbf24' : '#7a94b0',
              color: '#0a1120',
              border: '1px solid rgba(10,17,32,0.4)',
            }}
          >
            {pick.is_captain ? 'C' : 'V'}
          </span>
        )}
      </div>
      <div
        className="text-[10px] md:text-xs font-semibold text-white text-center truncate w-full px-1 py-0.5 rounded"
        style={{ background: 'rgba(0,0,0,0.35)' }}
      >
        {player?.web_name || '—'}
      </div>
      <div
        className="text-[10px] font-bold font-mono px-1.5 rounded"
        style={{ color: displayPts > 0 ? '#40c4ff' : 'rgba(255,255,255,0.4)' }}
      >
        {displayPts} pts
      </div>
    </div>
  );
}

function Empty({ icon, text }) {
  return (
    <div className="text-center py-24 text-liu-muted">
      <p className="text-5xl mb-4">{icon}</p>
      <p className="font-mono text-sm">{text}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 rounded-xl w-48" style={{ background: 'rgba(255,255,255,0.05)' }} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card h-14" />
        ))}
      </div>
      <div className="card h-96" />
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
