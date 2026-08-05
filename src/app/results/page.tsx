"use client";

import Link from "next/link";
import { useMemo } from "react";
import Leaderboard from "@/components/Leaderboard";
import StarCanvasClient from "@/components/StarCanvasClient";
import { buildPlanetLeaderboard } from "@/lib/leaderboard";
import { PAPER_COLOR, VOID_COLOR } from "@/lib/theme";
import { useStoredIdentity } from "@/lib/use-identity";
import { useScoreboard } from "@/lib/use-scoreboard";
import { hueToCss, starInkColor } from "@/lib/types/star";

const EMPTY_MESSAGE =
  "participate in the experience to start seeing your results with different pairs and strategies";

/**
 * A participant's own board: every run their planet took part in, best first.
 * Same component as the global page — the planet on the left of each `/` is
 * always theirs.
 */
export default function ResultsPage() {
  const { scores, planetById, loading, error } = useScoreboard();
  const { planetId, anonymousId, hydrated } = useStoredIdentity();

  /** Only their own planet — a stale or foreign id shows nothing. */
  const planet = useMemo(() => {
    if (!planetId) return null;
    const found = planetById.get(planetId);
    if (!found || found.anonymous_id !== anonymousId) return null;
    return found;
  }, [planetId, anonymousId, planetById]);

  const rows = useMemo(
    () => (planet ? buildPlanetLeaderboard(scores, planetById, planet.id) : []),
    [planet, planetById, scores],
  );

  const resolving = loading || !hydrated;

  return (
    <div
      className="font-terminal relative min-h-dvh"
      style={{ backgroundColor: VOID_COLOR, color: PAPER_COLOR }}
    >
      {/* Grain only — the list is the subject here, not the star. */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <StarCanvasClient intensity={0} />
      </div>

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-16 pt-6">
        <header className="flex items-baseline justify-between gap-3">
          <h1 className="text-lg">your results</h1>
          <Link
            href="/"
            className="shrink-0 text-xs text-dim underline underline-offset-4 hover:text-paper/80"
          >
            back
          </Link>
        </header>

        {resolving ? (
          <p className="mt-10 text-sm text-dim">loading...</p>
        ) : !planet ? (
          <div className="mt-10">
            <p className="max-w-[34ch] text-sm leading-relaxed text-dim">
              no planet on this device yet — create one to take part in the
              experience
            </p>
            <Link
              href="/"
              className="mt-6 inline-block text-sm underline underline-offset-4"
            >
              create your planet
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-3 flex min-w-0 items-baseline gap-3">
              <span
                className="shrink-0 text-sm"
                style={{ color: starInkColor(planet.params.hue) }}
              >
                planet_name :
              </span>
              <span
                className="truncate text-base"
                style={{ color: hueToCss(planet.params.hue, 45, 90) }}
                title={planet.name}
              >
                {planet.name}
              </span>
            </div>

            <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-dim">
              every pair you have synced with, best run first
            </p>

            <div className="mt-10">
              <Leaderboard rows={rows} emptyMessage={EMPTY_MESSAGE} />
            </div>
          </>
        )}

        {error && <p className="mt-6 text-sm text-red-300">{error}</p>}
      </main>
    </div>
  );
}
