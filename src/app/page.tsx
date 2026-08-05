"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import PlanetCanvasClient from "@/components/PlanetCanvasClient";
import { PARAM_LABELS, QUESTIONS } from "@/lib/constants";
import {
  getOrCreateAnonymousId,
  getStoredPlanetId,
  setStoredPlanetId,
} from "@/lib/identity";
import { upsertPlanetById } from "@/lib/planets";
import {
  DEFAULT_PARAMS,
  PARAM_KEYS,
  type ParamKey,
  type PlanetParams,
} from "@/lib/types/planet";

type Step = "identity" | "questions" | "editor" | "done";

export default function PublicPlanetFlow() {
  const [step, setStep] = useState<Step>("identity");
  const [anonymousId, setAnonymousId] = useState("");
  const [planetId, setPlanetId] = useState<string | null>(null);

  const [creatorName, setCreatorName] = useState("");
  const [creatorEmail, setCreatorEmail] = useState("");
  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [answer3, setAnswer3] = useState("");
  const [params, setParams] = useState<PlanetParams>(DEFAULT_PARAMS);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setAnonymousId(getOrCreateAnonymousId());
    setPlanetId(getStoredPlanetId());
  }, []);

  const planetName = useMemo(() => {
    const trimmed = answer1.trim();
    if (trimmed) return trimmed;
    if (creatorName.trim()) return `${creatorName.trim()}'s planet`;
    return "Untitled planet";
  }, [answer1, creatorName]);

  function setParam(key: ParamKey, value: number) {
    setParams((prev) => ({ ...prev, [key]: value }));
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
        name: planetName,
        creator_name: creatorName.trim(),
        creator_email: creatorEmail.trim(),
        anonymous_id: anonymousId || getOrCreateAnonymousId(),
        answer1: answer1.trim(),
        answer2: answer2.trim(),
        answer3: answer3.trim(),
        params1: params.params1,
        params2: params.params2,
        params3: params.params3,
        params4: params.params4,
        is_staged: false,
      });
      setPlanetId(saved.id);
      setStoredPlanetId(saved.id);
      setToast("Planet saved.");
      setStep("done");
      window.setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save planet.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-base-100 text-base-content">
      {toast && (
        <div className="toast toast-top toast-center z-50">
          <div className="alert alert-success text-sm">{toast}</div>
        </div>
      )}

      {step === "identity" && (
        <form
          onSubmit={onIdentitySubmit}
          className="flex flex-1 flex-col justify-center gap-6 p-6"
        >
          <div>
            <p className="text-sm uppercase tracking-widest opacity-60">
              Planet Sync
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Who are you?</h1>
            <p className="mt-2 text-sm opacity-70">
              We&apos;ll attach your planet to this profile.
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
          className="flex flex-1 flex-col justify-center gap-5 p-6"
        >
          <div>
            <p className="text-sm uppercase tracking-widest opacity-60">
              A few short questions
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Shape your planet</h1>
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
        <div className="flex min-h-dvh flex-col">
          <div className="w-full shrink-0">
            <PlanetCanvasClient params={params} />
          </div>

          <div className="flex flex-1 flex-col gap-4 p-4 pb-8">
            <div>
              <h2 className="text-lg font-semibold">{planetName}</h2>
              <p className="text-xs opacity-60">
                Tune the system, then validate your choice.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {PARAM_KEYS.map((key) => (
                <label key={key} className="form-control w-full">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{PARAM_LABELS[key]}</span>
                    <span className="opacity-50 tabular-nums">
                      {params[key].toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={params[key]}
                    onChange={(e) => setParam(key, Number(e.target.value))}
                    className="range range-primary range-sm"
                  />
                </label>
              ))}
            </div>

            {error && <p className="text-sm text-error">{error}</p>}

            {step === "done" ? (
              <div className="flex flex-col gap-2">
                <div className="alert alert-success text-sm">
                  Your planet is saved. You can keep tweaking and save again.
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
                    "Update planet"
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
        </div>
      )}
    </div>
  );
}
