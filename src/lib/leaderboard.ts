import { DIM_COLOR } from "@/lib/theme";
import type { Planet } from "@/lib/types/planet";
import type { SessionScore } from "@/lib/types/session-score";
import { starInkColor } from "@/lib/types/star";

/**
 * Shapes a `session_scores` row into what the scoreboard actually draws: two
 * named, colored planets and the numbers around them. Both boards — global and
 * per-participant — go through here so a row looks identical on either page.
 */

export type LeaderboardPlanet = {
  id: string;
  name: string;
  /** The planet's own star ink, so a name carries the color it was tuned to. */
  ink: string;
};

export type LeaderboardRow = {
  /** The session score's id — stable across realtime updates. */
  id: string;
  rank: number;
  score: number;
  recordedAt: string;
  strategy: string | null;
  planets: readonly [LeaderboardPlanet, LeaderboardPlanet];
};

export type PlanetById = Map<string, Planet>;

export function indexPlanets(planets: Planet[]): PlanetById {
  return new Map(planets.map((planet) => [planet.id, planet]));
}

/** A score can outlive its planet's row in the list we happen to hold. */
function toLeaderboardPlanet(id: string, planetById: PlanetById) {
  const planet = planetById.get(id);
  if (!planet) return { id, name: "unknown planet", ink: DIM_COLOR };
  return { id, name: planet.name, ink: starInkColor(planet.params.hue) };
}

/** Highest score first; the more recent run breaks a tie. */
function byScoreDesc(a: SessionScore, b: SessionScore): number {
  if (b.score !== a.score) return b.score - a.score;
  return Date.parse(b.recorded_at) - Date.parse(a.recorded_at);
}

function toRow(
  score: SessionScore,
  planetById: PlanetById,
  rank: number,
  /** Pins this planet to the left of the `/` — used on a participant's board. */
  leadPlanetId?: string,
): LeaderboardRow {
  const flip = leadPlanetId !== undefined && score.planet_b_id === leadPlanetId;
  const [aId, bId] = flip
    ? [score.planet_b_id, score.planet_a_id]
    : [score.planet_a_id, score.planet_b_id];

  const strategy =
    typeof score.strategy === "string" && score.strategy.trim()
      ? score.strategy.trim()
      : null;

  return {
    id: score.id,
    rank,
    score: score.score,
    recordedAt: score.recorded_at,
    strategy,
    planets: [
      toLeaderboardPlanet(aId, planetById),
      toLeaderboardPlanet(bId, planetById),
    ],
  };
}

/**
 * One row per planet: everyone's best pairing, ranked.
 *
 * Walks the scores from best down and keeps a row only when it introduces a
 * planet that hasn't been placed yet. A planet's own best row can only be
 * skipped once that planet has already appeared higher up, so no one with a
 * score falls off the board.
 */
export function buildGlobalLeaderboard(
  scores: SessionScore[],
  planetById: PlanetById,
): LeaderboardRow[] {
  const placed = new Set<string>();
  const rows: LeaderboardRow[] = [];

  for (const score of [...scores].sort(byScoreDesc)) {
    if (placed.has(score.planet_a_id) && placed.has(score.planet_b_id)) {
      continue;
    }
    placed.add(score.planet_a_id);
    placed.add(score.planet_b_id);
    rows.push(toRow(score, planetById, rows.length + 1));
  }

  return rows;
}

/** Every run one planet took part in, best to worst, itself always on the left. */
export function buildPlanetLeaderboard(
  scores: SessionScore[],
  planetById: PlanetById,
  planetId: string,
): LeaderboardRow[] {
  return scores
    .filter(
      (score) =>
        score.planet_a_id === planetId || score.planet_b_id === planetId,
    )
    .sort(byScoreDesc)
    .map((score, i) => toRow(score, planetById, i + 1, planetId));
}

/** Scores land on a 0–100 scale; one decimal is all the board needs. */
export function formatScore(score: number): string {
  return Number.isFinite(score) ? score.toFixed(1) : "--";
}

/** `01`, `02`, … — a ranked list reads better with the column held open. */
export function formatRank(rank: number): string {
  return String(rank).padStart(2, "0");
}

/** Time of day only: the whole thing runs in a single sitting. */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
