import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getBootstrap, getManagerEntry, getManagerPicks, getLiveGW } from '../lib/fpl-api';
import { Pitch, PlayerToken } from '../components/Pitch';

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

  if (!user) return <Empty text="Sign in to see your team." />;
  if (!fplId) return <Empty text="Add your FPL Manager ID in your profile (account button) to see your team." />;
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
              Bench | {picks.entry_history?.points_on_bench} pts
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
