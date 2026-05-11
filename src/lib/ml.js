// Expected-points model for FPL transfer suggestions.
//
// xPts = (0.6 × form + 0.4 × PPG) × fixture_factor × availability_factor
//
// fixture_factor  : (6 − avg_FDR_of_next_3) / 5  →  0.2 (FDR 5) … 1.0 (FDR 1)
// availability    : 1.0 fit | chance/100 doubtful | 0.0 injured/suspended

function fixtureScore(upcoming, n = 3) {
  if (!upcoming.length) return 0.5;
  const slice = upcoming.slice(0, n);
  const avg = slice.reduce((s, f) => s + f.difficulty, 0) / slice.length;
  return (6 - avg) / 5;
}

function availabilityFactor(player) {
  if (player.status === 'a') return 1.0;
  if (player.status === 'd') return (player.chance_of_playing_next_round ?? 50) / 100;
  return 0.0;
}

export function computeXPts(player, fixturesByTeam) {
  const ppg = parseFloat(player.points_per_game) || 0;
  const form = parseFloat(player.form) || 0;
  const base = form * 0.6 + ppg * 0.4;
  const fScore = fixtureScore(fixturesByTeam[player.team] || []);
  const avail = availabilityFactor(player);
  return Math.round(base * fScore * avail * 10) / 10;
}

// Build team → upcoming-fixture array from raw fixtures endpoint data.
export function buildFixtureMap(fixtures, currentGw) {
  const map = {};
  const upcoming = fixtures.filter(
    (f) => f.event !== null && !f.finished_provisional && f.event >= currentGw
  );

  for (const fix of upcoming) {
    if (!map[fix.team_h]) map[fix.team_h] = [];
    if (!map[fix.team_a]) map[fix.team_a] = [];

    map[fix.team_h].push({
      difficulty: fix.team_h_difficulty,
      event: fix.event,
      opponent: fix.team_a,
      isHome: true,
    });
    map[fix.team_a].push({
      difficulty: fix.team_a_difficulty,
      event: fix.event,
      opponent: fix.team_h,
      isHome: false,
    });
  }

  for (const id in map) map[id].sort((a, b) => a.event - b.event);

  return map;
}

export function getRecommendations(players, fixturesByTeam, positionType, maxBudget = null) {
  const typeMap = { GKP: 1, DEF: 2, MID: 3, FWD: 4 };
  const typeId = typeMap[positionType];

  const scored = players
    .filter((p) => p.element_type === typeId && parseFloat(p.total_points) > 0)
    .map((p) => {
      const xpts = computeXPts(p, fixturesByTeam);
      const cost = p.now_cost / 10;
      return {
        ...p,
        xpts,
        cost,
        valueScore: cost > 0 ? Math.round((xpts / cost) * 100) / 100 : 0,
        ownership: parseFloat(p.selected_by_percent) || 0,
      };
    });

  const filtered = maxBudget ? scored.filter((p) => p.cost <= maxBudget) : scored;

  return {
    topXpts: [...filtered].sort((a, b) => b.xpts - a.xpts).slice(0, 12),
    topValue: [...filtered].sort((a, b) => b.valueScore - a.valueScore).slice(0, 12),
    differentials: [...filtered]
      .filter((p) => p.ownership < 10 && p.xpts > 2)
      .sort((a, b) => b.xpts - a.xpts)
      .slice(0, 12),
  };
}
