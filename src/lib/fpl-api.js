const proxy = (path) =>
  `/.netlify/functions/fpl-proxy?path=${encodeURIComponent(path)}`;

async function fplFetch(path) {
  const res = await fetch(proxy(path));
  if (!res.ok) throw new Error(`FPL API error ${res.status} for ${path}`);
  return res.json();
}

export const getBootstrap = () => fplFetch('bootstrap-static/');
export const getLeagueStandings = (id) =>
  fplFetch(`leagues-classic/${id}/standings/`);
export const getManagerPicks = (managerId, gw) =>
  fplFetch(`entry/${managerId}/event/${gw}/picks/`);
export const getManagerHistory = (managerId) =>
  fplFetch(`entry/${managerId}/history/`);
export const getFixtures = () => fplFetch('fixtures/');
export const getPlayerSummary = (playerId) =>
  fplFetch(`element-summary/${playerId}/`);
export const getLiveGW = (gw) => fplFetch(`event/${gw}/live/`);

// Normalises standings — falls back to new_entries + history when the league
// was created mid-season and standings haven't been populated yet.
export async function getLeagueMembers(leagueId) {
  const data = await getLeagueStandings(leagueId);
  const standing = data.standings?.results || [];

  if (standing.length > 0) {
    return { league: data.league, members: standing };
  }

  // Build a standings-shaped array from new_entries then hydrate with history
  const entries = data.new_entries?.results || [];
  const settled = await Promise.allSettled(
    entries.map((e) => getManagerHistory(e.entry))
  );

  const members = entries.map((e, i) => {
    const hist = settled[i].status === 'fulfilled'
      ? settled[i].value.current || []
      : [];
    const last = hist[hist.length - 1];
    return {
      entry:       e.entry,
      entry_name:  e.entry_name,
      player_name: `${e.player_first_name} ${e.player_last_name}`,
      rank:        0,        // will be set after sort
      last_rank:   0,
      total:       last?.total_points ?? 0,
      event_total: last?.points ?? 0,
    };
  });

  // Sort by total descending and assign ranks
  members.sort((a, b) => b.total - a.total);
  members.forEach((m, i) => { m.rank = i + 1; m.last_rank = i + 1; });

  return { league: data.league, members };
}
