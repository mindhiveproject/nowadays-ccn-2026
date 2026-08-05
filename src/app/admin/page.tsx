"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import StarSliders from "@/components/StarSliders";
import StarSwatch from "@/components/StarSwatch";
import { ADMIN_SESSION_KEY, MAX_STAGED } from "@/lib/constants";
import { createClient } from "@/utils/supabase/client";
import {
  listPlanets,
  normalizePlanet,
  setPlanetStaged,
  updatePlanet,
} from "@/lib/planets";
import { getLatestSessionScore } from "@/lib/session-scores";
import type { Planet, PlanetUpdate } from "@/lib/types/planet";
import type { SessionScore } from "@/lib/types/session-score";
import { clampStar, type StarKey } from "@/lib/types/star";

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatJsonValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [planets, setPlanets] = useState<Planet[]>([]);
  const [latestScore, setLatestScore] = useState<SessionScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Planet | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") {
      setAuthed(true);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planetsResult, scoreResult] = await Promise.allSettled([
        listPlanets(),
        getLatestSessionScore(),
      ]);

      if (planetsResult.status === "fulfilled") {
        setPlanets(planetsResult.value);
      } else {
        setError(
          planetsResult.reason instanceof Error
            ? planetsResult.reason.message
            : "Failed to load planets.",
        );
      }

      if (scoreResult.status === "fulfilled") {
        setLatestScore(scoreResult.value);
      } else {
        setLatestScore(null);
        if (planetsResult.status === "fulfilled") {
          setError(
            scoreResult.reason instanceof Error
              ? `Session scores unavailable: ${scoreResult.reason.message}`
              : "Session scores unavailable.",
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load planets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    void load();

    let supabase: ReturnType<typeof createClient> | null = null;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null =
      null;

    try {
      supabase = createClient();
      channel = supabase
        .channel("admin-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "planets" },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const row = normalizePlanet(payload.new);
              setPlanets((prev) => {
                if (prev.some((p) => p.id === row.id)) return prev;
                return [row, ...prev];
              });
            } else if (payload.eventType === "UPDATE") {
              const row = normalizePlanet(payload.new);
              setPlanets((prev) =>
                prev.map((p) => (p.id === row.id ? row : p)),
              );
            } else if (payload.eventType === "DELETE") {
              const row = payload.old as Planet;
              setPlanets((prev) => prev.filter((p) => p.id !== row.id));
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "session_scores" },
          (payload) => {
            if (
              payload.eventType === "INSERT" ||
              payload.eventType === "UPDATE"
            ) {
              const row = payload.new as SessionScore;
              setLatestScore((prev) => {
                if (!prev) return row;
                if (prev.id === row.id) return row;
                return new Date(row.recorded_at) >= new Date(prev.recorded_at)
                  ? row
                  : prev;
              });
            } else if (payload.eventType === "DELETE") {
              const row = payload.old as SessionScore;
              setLatestScore((prev) => (prev?.id === row.id ? null : prev));
            }
          },
        )
        .subscribe();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Realtime subscription failed.",
      );
    }

    return () => {
      if (supabase && channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [authed, load]);

  const staged = useMemo(
    () => planets.filter((p) => p.is_staged),
    [planets],
  );

  const scorePlanetNames = useMemo(() => {
    if (!latestScore) return null;
    const a = planets.find((p) => p.id === latestScore.planet_a_id);
    const b = planets.find((p) => p.id === latestScore.planet_b_id);
    return {
      a: a?.name ?? latestScore.planet_a_id.slice(0, 8),
      b: b?.name ?? latestScore.planet_b_id.slice(0, 8),
    };
  }, [latestScore, planets]);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setLoginError(data.error ?? "Login failed");
        return;
      }
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      setAuthed(true);
    } catch {
      setLoginError("Login failed");
    }
  }

  async function toggleStage(planet: Planet) {
    setStageError(null);
    const next = !planet.is_staged;
    if (next && staged.length >= MAX_STAGED && !planet.is_staged) {
      setStageError(
        `Already staging ${MAX_STAGED} planets. Unstage one before staging another.`,
      );
      return;
    }
    try {
      await setPlanetStaged(planet.id, next);
    } catch (err) {
      setStageError(
        err instanceof Error ? err.message : "Failed to update staging.",
      );
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const payload: PlanetUpdate = {
        name: editing.name,
        creator_name: editing.creator_name,
        creator_email: editing.creator_email,
        answers: editing.answers,
        params: editing.params,
        is_staged: editing.is_staged,
      };

      if (
        payload.is_staged &&
        !planets.find((p) => p.id === editing.id)?.is_staged
      ) {
        const others = staged.filter((p) => p.id !== editing.id).length;
        if (others >= MAX_STAGED) {
          setStageError(
            `Already staging ${MAX_STAGED} planets. Unstage one before staging another.`,
          );
          setSaving(false);
          return;
        }
      }

      await updatePlanet(editing.id, payload);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (!authed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-base-200 p-6">
        <form
          onSubmit={onLogin}
          className="card w-full max-w-sm bg-base-100 shadow-xl"
        >
          <div className="card-body gap-4">
            <h1 className="card-title">Admin</h1>
            <p className="text-sm opacity-70">
              Enter the shared admin password to monitor planets.
            </p>
            <input
              type="password"
              className="input input-bordered w-full"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {loginError && <p className="text-sm text-error">{loginError}</p>}
            <button type="submit" className="btn btn-primary">
              Enter
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-base-200 text-base-content">
      <header className="sticky top-0 z-20 border-b border-base-300 bg-base-100/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-xl font-semibold">Planet Sync Admin</h1>
            <p className="text-xs opacity-60">
              Live monitor · edit · stage up to {MAX_STAGED}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`badge badge-lg ${
                staged.length >= MAX_STAGED ? "badge-warning" : "badge-neutral"
              }`}
            >
              Staged ({staged.length}/{MAX_STAGED})
            </div>
            {latestScore && (
              <div className="badge badge-lg badge-primary">
                Score {latestScore.score}
                {scorePlanetNames
                  ? ` · ${scorePlanetNames.a} × ${scorePlanetNames.b}`
                  : null}
              </div>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void load()}
            >
              Refresh
            </button>
          </div>
        </div>
        {staged.length > 0 && (
          <div className="mx-auto flex max-w-7xl flex-wrap gap-2 px-4 pb-3">
            {staged.map((p) => (
              <span key={p.id} className="badge badge-outline">
                {p.name}
              </span>
            ))}
          </div>
        )}
        {latestScore && (
          <div className="mx-auto max-w-7xl px-4 pb-3 text-xs opacity-60">
            Latest YQ session {latestScore.yq_session_id} · recorded{" "}
            {formatDate(latestScore.recorded_at)}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl p-4">
        {stageError && (
          <div className="alert alert-warning mb-4 text-sm">{stageError}</div>
        )}
        {error && (
          <div className="alert alert-error mb-4 text-sm">{error}</div>
        )}
        {loading && planets.length === 0 ? (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : planets.length === 0 ? (
          <div className="rounded-box border border-dashed border-base-300 p-12 text-center opacity-60">
            No planets yet. Waiting for mobile submissions…
          </div>
        ) : (
          <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
            <table className="table">
              <thead>
                <tr>
                  <th>Preview</th>
                  <th>Name</th>
                  <th>Date</th>
                  <th>Link</th>
                  <th>Staged</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {planets.map((planet) => (
                  <tr key={planet.id} className="hover">
                    <td>
                      <StarSwatch params={planet.params} size={72} />
                    </td>
                    <td>
                      <div className="font-medium">{planet.name}</div>
                      <div className="text-xs opacity-60">
                        {planet.creator_name}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-sm">
                      <div>{formatDate(planet.created_at)}</div>
                      <div className="text-xs opacity-50">
                        upd {formatDate(planet.updated_at)}
                      </div>
                    </td>
                    <td>
                      <Link
                        href={`/p/${planet.id}`}
                        className="link link-primary text-sm"
                        target="_blank"
                      >
                        Open
                      </Link>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        className="toggle toggle-warning toggle-sm"
                        checked={planet.is_staged}
                        onChange={() => void toggleStage(planet)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditing({ ...planet });
                          setStageError(null);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {editing && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="text-lg font-bold">Edit planet</h3>
            <form onSubmit={saveEdit} className="mt-4 flex flex-col gap-3">
              <label className="form-control">
                <span className="label-text">Name</span>
                <input
                  className="input input-bordered"
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  required
                />
              </label>
              <label className="form-control">
                <span className="label-text">Creator name</span>
                <input
                  className="input input-bordered"
                  value={editing.creator_name}
                  onChange={(e) =>
                    setEditing({ ...editing, creator_name: e.target.value })
                  }
                  required
                />
              </label>
              <label className="form-control">
                <span className="label-text">Creator email</span>
                <input
                  type="email"
                  className="input input-bordered"
                  value={editing.creator_email}
                  onChange={(e) =>
                    setEditing({ ...editing, creator_email: e.target.value })
                  }
                  required
                />
              </label>
              <div className="flex flex-col gap-3">
                <span className="label-text">Answers</span>
                {Object.keys(editing.answers).length === 0 ? (
                  <p className="text-sm opacity-60">No answers stored.</p>
                ) : (
                  Object.entries(editing.answers).map(([key, value]) => (
                    <label key={key} className="form-control">
                      <span className="label-text font-mono text-xs opacity-70">
                        {key}
                      </span>
                      <input
                        className="input input-bordered"
                        value={
                          value === null || value === undefined
                            ? ""
                            : typeof value === "string"
                              ? value
                              : JSON.stringify(value)
                        }
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            answers: {
                              ...editing.answers,
                              [key]: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  ))
                )}
              </div>

              <div className="flex items-start gap-4">
                <StarSwatch
                  params={editing.params}
                  size={96}
                  className="shrink-0"
                />
                <StarSliders
                  className="min-w-0 flex-1"
                  params={editing.params}
                  onChange={(key: StarKey, value) =>
                    setEditing({
                      ...editing,
                      params: {
                        ...editing.params,
                        [key]: clampStar(key, value),
                      },
                    })
                  }
                />
              </div>

              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="toggle toggle-warning"
                  checked={editing.is_staged}
                  onChange={(e) =>
                    setEditing({ ...editing, is_staged: e.target.checked })
                  }
                />
                <span className="label-text">Staged</span>
              </label>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setEditing(null)}>
              close
            </button>
          </form>
        </dialog>
      )}
    </div>
  );
}
