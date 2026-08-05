"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import StarCanvasClient from "@/components/StarCanvasClient";
import StarSliders from "@/components/StarSliders";
import { QUESTIONS } from "@/lib/constants";
import {
  clearStoredPlanetId,
  getOrCreateAnonymousId,
  getStoredPlanetId,
  setStoredPlanetId,
} from "@/lib/identity";
import { getPlanet, upsertPlanetById } from "@/lib/planets";
import { VOID_COLOR } from "@/lib/theme";
import type { Planet } from "@/lib/types/planet";
import {
  DEFAULT_STAR_PARAMS,
  clampStar,
  type StarKey,
  type StarParams,
} from "@/lib/types/star";

type Step = "identity" | "questions" | "editor" | "done";

const NAME_QUESTION = QUESTIONS[0];

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
          setToast("Welcome back — your star is still here.");
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
    if (creatorName.trim()) return `${creatorName.trim()}'s star`;
    return "Untitled star";
  }, [answer1, creatorName]);

  function setParam(key: StarKey, value: number) {
    setParams((prev) => ({ ...prev, [key]: clampStar(key, value) }));
  }

  function onIdentitySubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!creatorName.trim()) {
      setError("Name is required.");
      return;
    }
    setStep("questions");
  }

  function onQuestionsSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!answer1.trim()) {
      setError("Please name your planet.");
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
      setToast("Star saved.");
      setStep("done");
      window.setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save star.");
    } finally {
      setSaving(false);
    }
  }

  if (restoring) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center"
        style={{ backgroundColor: VOID_COLOR }}
      >
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div
      className="relative min-h-dvh text-base-content"
      style={{ backgroundColor: VOID_COLOR }}
    >
      {/* Full-bleed star behind everything; it never unmounts between steps. */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <StarCanvasClient params={params} />
      </div>

      {toast && (
        <div className="toast toast-top toast-center z-50">
          <div className="alert alert-success text-sm">{toast}</div>
        </div>
      )}

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col p-6">
        {step === "identity" && (
          <form
            onSubmit={onIdentitySubmit}
            className="m-auto flex w-full flex-col gap-6 rounded-box border border-white/10 bg-black/50 p-6 backdrop-blur-md"
          >
            <div>
              <p className="text-sm uppercase tracking-widest opacity-60">
                Star Sync
              </p>
              <h1 className="mt-1 text-3xl font-semibold">Who are you?</h1>
              <p className="mt-2 text-sm opacity-70">
                We&apos;ll attach your star to this profile.
              </p>
            </div>

            <label className="form-control w-full">
              <span className="label-text mb-1">Name</span>
              <input
                className="input input-bordered w-full"
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>

            <label className="form-control w-full">
              <span className="label-text mb-1">
                Email{" "}
                <span className="opacity-50 font-normal">(optional)</span>
              </span>
              <input
                type="email"
                className="input input-bordered w-full"
                value={creatorEmail}
                onChange={(e) => setCreatorEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>

            {error && <p className="text-sm text-error">{error}</p>}

            <button type="submit" className="btn btn-primary">
              Continue
            </button>
          </form>
        )}

        {step === "questions" && (
          <form
            onSubmit={onQuestionsSubmit}
            className="m-auto flex w-full flex-col gap-5 rounded-box border border-white/10 bg-black/50 p-6 backdrop-blur-md"
          >
            <div>
              <p className="text-sm uppercase tracking-widest opacity-60">
                Name your planet
              </p>
              <h1 className="mt-1 text-2xl font-semibold">Shape your star</h1>
            </div>

            <label className="form-control w-full">
              <span className="label-text mb-1">{NAME_QUESTION.label}</span>
              <input
                className="input input-bordered w-full"
                value={answer1}
                onChange={(e) => setAnswer1(e.target.value)}
                placeholder={NAME_QUESTION.placeholder}
                required
              />
            </label>

            {error && <p className="text-sm text-error">{error}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-ghost flex-1"
                onClick={() => setStep("identity")}
              >
                Back
              </button>
              <button type="submit" className="btn btn-primary flex-1">
                Continue
              </button>
            </div>
          </form>
        )}

        {(step === "editor" || step === "done") && (
          <div className="mt-auto flex w-full flex-col gap-4 rounded-box border border-white/10 bg-black/50 p-5 backdrop-blur-md">
            <div>
              <h2 className="text-lg font-semibold">{starName}</h2>
              <p className="text-xs opacity-60">
                {step === "done"
                  ? "Your star is saved. Tweak anytime, or start a new one."
                  : "Tune your star, then validate your choice."}
              </p>
            </div>

            <StarSliders
              params={params}
              onChange={setParam}
              onOrbitModeChange={(mode) =>
                setParams((prev) => ({ ...prev, orbit_mode: mode }))
              }
            />

            {error && <p className="text-sm text-error">{error}</p>}

            {step === "done" ? (
              <div className="flex flex-col gap-2">
                <div className="alert alert-success text-sm">
                  Your star is saved. You can keep tweaking and save again.
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving}
                  onClick={() => void onValidate()}
                >
                  {saving ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    "Update star"
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setStep("questions")}
                >
                  Edit name
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm opacity-70"
                  onClick={resetForm}
                >
                  Start a new star
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost flex-1"
                  onClick={() => setStep("questions")}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary flex-1"
                  disabled={saving}
                  onClick={() => void onValidate()}
                >
                  {saving ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    "Validate"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
