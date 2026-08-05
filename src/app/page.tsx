"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import StarCanvasClient from "@/components/StarCanvasClient";
import StarSliders from "@/components/StarSliders";
import { QUESTIONS } from "@/lib/constants";
import {
  getOrCreateAnonymousId,
  getStoredPlanetId,
  setStoredPlanetId,
} from "@/lib/identity";
import { upsertPlanetById } from "@/lib/planets";
import { VOID_COLOR } from "@/lib/theme";
import {
  DEFAULT_STAR_PARAMS,
  clampStar,
  type StarKey,
  type StarParams,
} from "@/lib/types/star";

type Step = "identity" | "questions" | "editor" | "done";

export default function PublicStarFlow() {
  const [step, setStep] = useState<Step>("identity");
  const [anonymousId, setAnonymousId] = useState("");
  const [planetId, setPlanetId] = useState<string | null>(null);

  const [creatorName, setCreatorName] = useState("");
  const [creatorEmail, setCreatorEmail] = useState("");
  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [answer3, setAnswer3] = useState("");
  const [params, setParams] = useState<StarParams>(DEFAULT_STAR_PARAMS);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setAnonymousId(getOrCreateAnonymousId());
    setPlanetId(getStoredPlanetId());
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
    if (!creatorName.trim() || !creatorEmail.trim()) {
      setError("Name and email are required.");
      return;
    }
    setStep("questions");
  }

  function onQuestionsSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!answer1.trim() || !answer2.trim() || !answer3.trim()) {
      setError("Please answer all three questions.");
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
        answer1: answer1.trim(),
        answer2: answer2.trim(),
        answer3: answer3.trim(),
        star_params: params,
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
              <span className="label-text mb-1">Email</span>
              <input
                type="email"
                className="input input-bordered w-full"
                value={creatorEmail}
                onChange={(e) => setCreatorEmail(e.target.value)}
                autoComplete="email"
                required
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
                A few short questions
              </p>
              <h1 className="mt-1 text-2xl font-semibold">Shape your star</h1>
            </div>

            {QUESTIONS.map((q) => {
              if (q.type === "select") {
                return (
                  <label key={q.id} className="form-control w-full">
                    <span className="label-text mb-1">{q.label}</span>
                    <select
                      className="select select-bordered w-full"
                      value={answer2}
                      onChange={(e) => setAnswer2(e.target.value)}
                      required
                    >
                      <option value="" disabled>
                        Choose one
                      </option>
                      {q.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }

              const value = q.id === "answer1" ? answer1 : answer3;
              const setValue = q.id === "answer1" ? setAnswer1 : setAnswer3;

              return (
                <label key={q.id} className="form-control w-full">
                  <span className="label-text mb-1">{q.label}</span>
                  <input
                    className="input input-bordered w-full"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={q.placeholder}
                    required
                  />
                </label>
              );
            })}

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
                Tune your star, then validate your choice.
              </p>
            </div>

            <StarSliders params={params} onChange={setParam} />

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
                  Edit answers
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
