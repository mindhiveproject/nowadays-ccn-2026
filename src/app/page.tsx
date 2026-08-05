"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import StarCanvasClient from "@/components/StarCanvasClient";
import StarControls from "@/components/StarControls";
import {
  TermButton,
  TermField,
  TermGhostButton,
} from "@/components/terminal";
import {
  clearStoredPlanetId,
  getOrCreateAnonymousId,
  getStoredPlanetId,
  setStoredPlanetId,
} from "@/lib/identity";
import { getPlanet, upsertPlanetById } from "@/lib/planets";
import { PAPER_COLOR, VOID_COLOR } from "@/lib/theme";
import type { Planet } from "@/lib/types/planet";
import {
  DEFAULT_STAR_PARAMS,
  clampStar,
  hueToCss,
  starInkColor,
  type StarKey,
  type StarParams,
} from "@/lib/types/star";

type Step = "identity" | "questions" | "editor" | "done";

/**
 * Star's vertical center. Sits above the middle so the controls at the bottom
 * of the editor land on empty void rather than on the corona.
 */
const STAR_CENTER_Y = 0.4;

function answerText(answers: Planet["answers"], key: string): string {
  const value = answers[key];
  return typeof value === "string" ? value : "";
}

export default function PublicStarFlow() {
  const [step, setStep] = useState<Step>("identity");
  const [restoring, setRestoring] = useState(true);
  const [anonymousId, setAnonymousId] = useState("");
  const [planetId, setPlanetId] = useState<string | null>(null);

  const [creatorName, setCreatorName] = useState("");
  const [creatorEmail, setCreatorEmail] = useState("");
  const [answer1, setAnswer1] = useState("");
  const [params, setParams] = useState<StarParams>(DEFAULT_STAR_PARAMS);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function applyPlanet(planet: Planet) {
    setPlanetId(planet.id);
    setCreatorName(planet.creator_name);
    setCreatorEmail(planet.creator_email);
    setAnswer1(answerText(planet.answers, "answer1") || planet.name);
    setParams(planet.params);
    setStep("done");
  }

  function resetForm() {
    const confirmed = window.confirm(
      "Start a brand-new star? Your current one stays saved — this just begins a fresh one on this device.",
    );
    if (!confirmed) return;
    clearStoredPlanetId();
    setPlanetId(null);
    setCreatorName("");
    setCreatorEmail("");
    setAnswer1("");
    setParams({ ...DEFAULT_STAR_PARAMS });
    setError(null);
    setToast(null);
    setStep("identity");
  }

  useEffect(() => {
    let cancelled = false;
    const anon = getOrCreateAnonymousId();
    const storedId = getStoredPlanetId();
    setAnonymousId(anon);

    if (!storedId) {
      setRestoring(false);
      return;
    }

    void getPlanet(storedId)
      .then((planet) => {
        if (cancelled) return;
        if (planet && planet.anonymous_id === anon) {
          applyPlanet(planet);
          setToast("welcome back — your planet is still here");
          window.setTimeout(() => setToast(null), 3000);
        } else {
          // Stale or foreign id — don't leave a trap that overwrites later.
          clearStoredPlanetId();
          setPlanetId(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearStoredPlanetId();
          setPlanetId(null);
        }
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const starName = useMemo(() => {
    const trimmed = answer1.trim();
    if (trimmed) return trimmed;
    if (creatorName.trim()) return `${creatorName.trim()}'s planet`;
    return "untitled";
  }, [answer1, creatorName]);

  /** Label ink, and a lighter grade of it for the planet's own name. */
  const ink = starInkColor(params.hue);
  const inkBright = hueToCss(params.hue, 45, 90);

  function setParam(key: StarKey, value: number) {
    setParams((prev) => ({ ...prev, [key]: clampStar(key, value) }));
  }

  function onIdentitySubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!creatorName.trim()) {
      setError("first_name is required");
      return;
    }
    setStep("questions");
  }

  function onQuestionsSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!answer1.trim()) {
      setError("planet_name is required");
      return;
    }
    setStep("editor");
  }

  async function onValidate() {
    setSaving(true);
    setError(null);
    try {
      const saved = await upsertPlanetById(planetId, {
        name: starName,
        creator_name: creatorName.trim(),
        creator_email: creatorEmail.trim(),
        anonymous_id: anonymousId || getOrCreateAnonymousId(),
        answers: {
          answer1: answer1.trim(),
        },
        params,
        is_staged: false,
      });
      setPlanetId(saved.id);
      setStoredPlanetId(saved.id);
      setToast("planet saved");
      setStep("done");
      window.setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to save planet");
    } finally {
      setSaving(false);
    }
  }

  if (restoring) {
    return (
      <div
        className="font-terminal flex min-h-dvh items-center justify-center text-dim"
        style={{ backgroundColor: VOID_COLOR }}
      >
        loading...
      </div>
    );
  }

  const showStar = step === "editor" || step === "done";

  return (
    <div
      className="font-terminal relative min-h-dvh"
      style={{ backgroundColor: VOID_COLOR, color: PAPER_COLOR }}
    >
      {/*
       * Full-bleed noisy void. It never unmounts between steps — the intro
       * screens just run it at zero intensity, so the grain is there and the
       * star fades in when the editor opens.
       */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <StarCanvasClient
          params={params}
          intensity={showStar ? 1 : 0}
          centerY={STAR_CENTER_Y}
        />
      </div>

      {/*
       * Sinks the star back into the void behind the controls. Kept partly
       * transparent so the grain still reads through it.
       */}
      {showStar && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[1] h-[52vh] bg-gradient-to-t from-void via-void/90 to-transparent" />
      )}

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-8 pt-6">
        {step === "identity" && (
          <form onSubmit={onIdentitySubmit} className="flex flex-1 flex-col">
            <p className="max-w-[34ch] pt-[16vh] text-sm leading-relaxed text-dim">
              welcome! before creating your planet, we want to know about you
            </p>

            <div className="mt-16 flex flex-col gap-12">
              <TermField
                label="first_name:"
                value={creatorName}
                onChange={setCreatorName}
                inkColor={ink}
                autoComplete="name"
                required
              />
              <TermField
                label="email (optional):"
                type="email"
                value={creatorEmail}
                onChange={setCreatorEmail}
                inkColor={ink}
                autoComplete="email"
              />
            </div>

            {error && <p className="mt-6 text-sm text-red-300">{error}</p>}

            <div className="mt-auto mb-[22vh] flex justify-end">
              <TermButton type="submit">next</TermButton>
            </div>
          </form>
        )}

        {step === "questions" && (
          <form onSubmit={onQuestionsSubmit} className="flex flex-1 flex-col">
            <p className="max-w-[34ch] pt-[16vh] text-sm leading-relaxed text-dim">
              create your own planet to participate in the experience
            </p>

            <div className="mt-16">
              <TermField
                label="planet_name:"
                value={answer1}
                onChange={setAnswer1}
                inkColor={ink}
                autoFocus
                required
              />
            </div>

            {error && <p className="mt-6 text-sm text-red-300">{error}</p>}

            <div className="mt-auto mb-[22vh] flex items-center justify-between">
              <TermGhostButton onClick={() => setStep("identity")}>
                back
              </TermGhostButton>
              <TermButton type="submit">next</TermButton>
            </div>
          </form>
        )}

        {showStar && (
          <div className="flex flex-1 flex-col">
            <header className="flex items-baseline gap-3">
              <span className="text-sm" style={{ color: ink }}>
                planet_name :
              </span>
              <span
                className="truncate text-lg"
                style={{ color: inkBright }}
                title={starName}
              >
                {starName}
              </span>
            </header>

            {/* Status line, held open so a toast doesn't shift the layout. */}
            <p className="mt-2 h-5 text-sm text-dim">{toast}</p>

            {/* Empty space the star lives behind. */}
            <div className="min-h-[38vh] flex-1" />

            <StarControls
              params={params}
              onChange={setParam}
              onOrbitModeChange={(mode) =>
                setParams((prev) => ({ ...prev, orbit_mode: mode }))
              }
            />

            {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

            <div className="mt-8 flex items-center justify-between">
              <TermGhostButton onClick={() => setStep("questions")}>
                back
              </TermGhostButton>
              <TermButton disabled={saving} onClick={() => void onValidate()}>
                {saving ? "saving..." : "save"}
              </TermButton>
            </div>

            {step === "done" && (
              <button
                type="button"
                onClick={resetForm}
                className="mt-6 self-center text-xs text-dim underline underline-offset-4 hover:text-paper/80"
              >
                start a new planet
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
