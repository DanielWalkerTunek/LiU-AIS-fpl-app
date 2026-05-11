import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getLeagueStandings, getManagerHistory } from '../lib/fpl-api';

export default function StandingsPage() {
  const { leagueId } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [league, setLeague] = useState(null);
  const [standings, setStandings] = useState([]);
  const [histories, setHistories] = useState({});

  useEffect(() => {
    if (!leagueId) { setLoading(false); return; }

    async function load() {
      try {
        setLoading(true);
        const data = await getLeagueStandings(leagueId);
        setLeague(data.league);
        const results = data.standings?.results || [];
        setStandings(results);

        // Fetch all histories in parallel for form sparklines
        const settled = await Promise.allSettled(
          results.map((m) =>
            getManagerHistory(m.entry).then((h) => ({
              id: m.entry,
              history: h.current || [],
            }))
          )
        );
        const hist = {};
        for (const r of settled) {
          if (r.status === 'fulfilled') hist[r.value.id] = r.value.history;
        }
        setHistories(hist);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [leagueId]);

  if (!leagueId) {
    return (
      <Empty icon="🏆" text="Enter your league ID in settings to see standings." />
    );
  }
  if (loading) return <Skeleton />;
  if (error) return <ErrorCard error={error} />;

  const top = standings[0]?.total || 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{league?.name || 'League'}</h1>
        <p className="text-gray-500 text-sm">Classic League · {standings.length} managers</p>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs border-b border-gray-800">
              <th className="py-3 pl-4 text-left w-10">#</th>
              <th className="py-3 text-left">Manager</th>
              <th className="py-3 pr-4 text-right">GW</th>
              <th className="py-3 pr-4 text-right">Total</th>
              <th className="py-3 pr-4 text-right hidden sm:table-cell">Gap</th>
              <th className="py-3 pr-4 text-right hidden md:table-cell">Form (last 5)</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((m) => {
              const delta = m.last_rank - m.rank;
              const hist = (histories[m.entry] || []).slice(-5).map((h) => h.points);

              return (
                <tr
                  key={m.entry}
                  className="border-b border-gray-800/40 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="py-3 pl-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold w-4">{m.rank}</span>
                      <RankBadge delta={delta} />
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="font-medium">{m.player_name}</div>
                    <div className="text-xs text-gray-500">{m.entry_name}</div>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className="font-bold text-emerald-400">{m.event_total}</span>
                  </td>
                  <td className="py-3 pr-4 text-right font-bold">{m.total}</td>
                  <td className="py-3 pr-4 text-right text-gray-500 hidden sm:table-cell">
                    {m.rank === 1 ? '—' : `−${top - m.total}`}
                  </td>
                  <td className="py-3 pr-4 hidden md:table-cell">
                    <Sparkline data={hist} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RankBadge({ delta }) {
  if (delta > 0) return <span className="text-emerald-400 text-xs">▲</span>;
  if (delta < 0) return <span className="text-red-400 text-xs">▼</span>;
  return <span className="text-gray-700 text-xs">—</span>;
}

function Sparkline({ data }) {
  if (!data.length) return <span className="text-gray-700 text-xs">—</span>;
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-px h-5 justify-end">
      {data.map((v, i) => (
        <div
          key={i}
          title={`${v} pts`}
          className="w-3.5 rounded-t bg-emerald-500/60"
          style={{ height: `${Math.max((v / max) * 100, 8)}%` }}
        />
      ))}
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
      <div className="h-8 bg-gray-800 rounded w-56" />
      <div className="card h-72" />
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
