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
