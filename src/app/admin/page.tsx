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
import {
  deleteSessionScore,
  listSessionScores,
  updateSessionScore,
} from "@/lib/session-scores";
import type { Planet, PlanetUpdate } from "@/lib/types/planet";
import type {
  SessionScore,
  SessionScoreUpdate,
} from "@/lib/types/session-score";
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

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sortScoresByRecordedAt(scores: SessionScore[]): SessionScore[] {
  return [...scores].sort(
    (a, b) =>
      new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
  );
}

function PlanetSummaryCard({
  label,
  planet,
  planetId,
}: {
  label: string;
  planet: Planet | undefined;
  planetId: string;
}) {
  return (
    <div className="rounded-box border border-base-300 bg-base-200/50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase opacity-60">
          {label}
        </span>
        <Link
          href={`/p/${planetId}`}
          className="link link-primary text-xs"
          target="_blank"
        >
          Open
        </Link>
      </div>
      {planet ? (
        <div className="flex gap-3">
          <StarSwatch params={planet.params} size={64} className="shrink-0" />
          <div className="min-w-0 text-sm">
            <div className="font-medium truncate">{planet.name}</div>
            <div className="opacity-70 truncate">{planet.creator_name}</div>
            <div className="opacity-50 truncate text-xs">
              {planet.creator_email}
            </div>
            <div className="mt-1 text-xs opacity-70">
              Answer: {formatJsonValue(planet.answers.answer1) || "—"}
            </div>
            <div className="text-xs opacity-50">
              {planet.is_staged ? "Staged" : "Not staged"}
            </div>
          </div>
        </div>
      ) : (
        <p className="font-mono text-xs opacity-60">{planetId}</p>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [planets, setPlanets] = useState<Planet[]>([]);
  const [sessionScores, setSessionScores] = useState<SessionScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [staging, setStaging] = useState(false);
  const [editing, setEditing] = useState<Planet | null>(null);
  const [viewingScore, setViewingScore] = useState<SessionScore | null>(null);
  const [saving, setSaving] = useState(false);
  const [scoreSaving, setScoreSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"planets" | "scores">("planets");

  useEffect(() => {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") {
      setAuthed(true);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planetsResult, scoresResult] = await Promise.allSettled([
        listPlanets(),
        listSessionScores(),
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

      if (scoresResult.status === "fulfilled") {
        setSessionScores(scoresResult.value);
      } else {
        setSessionScores([]);
        if (planetsResult.status === "fulfilled") {
          setError(
            scoresResult.reason instanceof Error
              ? `Session scores unavailable: ${scoresResult.reason.message}`
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
            if (payload.eventType === "INSERT") {
              const row = payload.new as SessionScore;
              setSessionScores((prev) => {
                if (prev.some((s) => s.id === row.id)) {
                  return sortScoresByRecordedAt(
                    prev.map((s) => (s.id === row.id ? row : s)),
                  );
                }
                return sortScoresByRecordedAt([row, ...prev]);
              });
              setViewingScore((prev) => (prev?.id === row.id ? row : prev));
            } else if (payload.eventType === "UPDATE") {
              const row = payload.new as SessionScore;
              setSessionScores((prev) =>
                sortScoresByRecordedAt(
                  prev.map((s) => (s.id === row.id ? row : s)),
                ),
              );
              setViewingScore((prev) => (prev?.id === row.id ? row : prev));
            } else if (payload.eventType === "DELETE") {
              const row = payload.old as SessionScore;
              setSessionScores((prev) => prev.filter((s) => s.id !== row.id));
              setViewingScore((prev) => (prev?.id === row.id ? null : prev));
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

  const planetById = useMemo(() => {
    const map = new Map<string, Planet>();
    for (const p of planets) map.set(p.id, p);
    return map;
  }, [planets]);

  const latestScore = sessionScores[0] ?? null;

  const scorePlanetNames = useMemo(() => {
    if (!latestScore) return null;
    const a = planetById.get(latestScore.planet_a_id);
    const b = planetById.get(latestScore.planet_b_id);
    return {
      a: a?.name ?? latestScore.planet_a_id.slice(0, 8),
      b: b?.name ?? latestScore.planet_b_id.slice(0, 8),
    };
  }, [latestScore, planetById]);

  function planetLabel(id: string) {
    return planetById.get(id)?.name ?? id.slice(0, 8);
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
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
    setStaging(true);
    try {
      const updated = await setPlanetStaged(planet.id, next);
      setPlanets((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p)),
      );
    } catch (err) {
      setStageError(
        err instanceof Error ? err.message : "Failed to update staging.",
      );
    } finally {
      setStaging(false);
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
        answers: {
          answer1:
            editing.answers.answer1 === null ||
            editing.answers.answer1 === undefined
              ? ""
              : typeof editing.answers.answer1 === "string"
                ? editing.answers.answer1
                : JSON.stringify(editing.answers.answer1),
        },
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

  async function saveScoreEdit(e: FormEvent) {
    e.preventDefault();
    if (!viewingScore) return;
    setScoreSaving(true);
    setError(null);
    try {
      const payload: SessionScoreUpdate = {
        score: viewingScore.score,
        planet_a_id: viewingScore.planet_a_id,
        planet_b_id: viewingScore.planet_b_id,
        recorded_at: viewingScore.recorded_at,
      };
      const updated = await updateSessionScore(viewingScore.id, payload);
      setSessionScores((prev) =>
        sortScoresByRecordedAt(
          prev.map((s) => (s.id === updated.id ? updated : s)),
        ),
      );
      setViewingScore(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save session score.",
      );
    } finally {
      setScoreSaving(false);
    }
  }

  async function onDeleteScore(score: SessionScore) {
    const label = `${score.score} · ${score.yq_session_id}`;
    if (!confirm(`Delete session score ${label}?`)) return;
    setScoreSaving(true);
    setError(null);
    try {
      await deleteSessionScore(score.id);
      setSessionScores((prev) => prev.filter((s) => s.id !== score.id));
      setViewingScore((prev) => (prev?.id === score.id ? null : prev));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete session score.",
      );
    } finally {
      setScoreSaving(false);
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

      {staging && (
        <div className="toast toast-top toast-center z-50">
          <div className="alert alert-info text-sm gap-2">
            <span className="loading loading-spinner loading-sm" />
            Updating stage…
          </div>
        </div>
      )}

      <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4">
        {stageError && (
          <div className="alert alert-warning text-sm">{stageError}</div>
        )}
        {error && <div className="alert alert-error text-sm">{error}</div>}

        <div role="tablist" className="tabs tabs-box w-fit">
          <button
            type="button"
            role="tab"
            className={`tab ${activeTab === "planets" ? "tab-active" : ""}`}
            aria-selected={activeTab === "planets"}
            onClick={() => setActiveTab("planets")}
          >
            Planets
            <span className="ml-1.5 opacity-60">{planets.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            className={`tab ${activeTab === "scores" ? "tab-active" : ""}`}
            aria-selected={activeTab === "scores"}
            onClick={() => setActiveTab("scores")}
          >
            Session scores
            <span className="ml-1.5 opacity-60">{sessionScores.length}</span>
          </button>
        </div>

        {loading && planets.length === 0 && sessionScores.length === 0 ? (
          <div className="flex justify-center py-20">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : activeTab === "planets" ? (
          <section>
            {planets.length === 0 ? (
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
                            disabled={staging}
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
          </section>
        ) : (
          <section>
            {sessionScores.length === 0 ? (
              <div className="rounded-box border border-dashed border-base-300 p-8 text-center text-sm opacity-60">
                No session scores yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Score</th>
                      <th>YQ session</th>
                      <th>Planet A</th>
                      <th>Planet B</th>
                      <th>Recorded</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sessionScores.map((score) => (
                      <tr key={score.id} className="hover">
                        <td className="font-medium">{score.score}</td>
                        <td>
                          <span className="font-mono text-xs">
                            {score.yq_session_id.length > 24
                              ? `${score.yq_session_id.slice(0, 24)}…`
                              : score.yq_session_id}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/p/${score.planet_a_id}`}
                            className="link link-primary text-sm"
                            target="_blank"
                          >
                            {planetLabel(score.planet_a_id)}
                          </Link>
                        </td>
                        <td>
                          <Link
                            href={`/p/${score.planet_b_id}`}
                            className="link link-primary text-sm"
                            target="_blank"
                          >
                            {planetLabel(score.planet_b_id)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-sm">
                          {formatDate(score.recorded_at)}
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setViewingScore({ ...score })}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm text-error"
                              disabled={scoreSaving}
                              onClick={() => void onDeleteScore(score)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
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
              <label className="form-control">
                <span className="label-text">Planet name answer</span>
                <input
                  className="input input-bordered"
                  value={
                    editing.answers.answer1 === null ||
                    editing.answers.answer1 === undefined
                      ? ""
                      : typeof editing.answers.answer1 === "string"
                        ? editing.answers.answer1
                        : JSON.stringify(editing.answers.answer1)
                  }
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      answers: { answer1: e.target.value },
                    })
                  }
                />
              </label>

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
                  onOrbitModeChange={(mode) =>
                    setEditing({
                      ...editing,
                      params: { ...editing.params, orbit_mode: mode },
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

      {viewingScore && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="text-lg font-bold">Session score</h3>
            <p className="mt-1 font-mono text-xs opacity-60 break-all">
              id {viewingScore.id}
            </p>
            <p className="font-mono text-xs opacity-60 break-all">
              yq {viewingScore.yq_session_id}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <PlanetSummaryCard
                label="Planet A"
                planet={planetById.get(viewingScore.planet_a_id)}
                planetId={viewingScore.planet_a_id}
              />
              <PlanetSummaryCard
                label="Planet B"
                planet={planetById.get(viewingScore.planet_b_id)}
                planetId={viewingScore.planet_b_id}
              />
            </div>

            <form
              onSubmit={saveScoreEdit}
              className="mt-4 flex flex-col gap-3"
            >
              <label className="form-control">
                <span className="label-text">Score</span>
                <input
                  type="number"
                  step="any"
                  className="input input-bordered"
                  value={viewingScore.score}
                  onChange={(e) =>
                    setViewingScore({
                      ...viewingScore,
                      score: Number(e.target.value),
                    })
                  }
                  required
                />
              </label>
              <label className="form-control">
                <span className="label-text">Recorded at</span>
                <input
                  type="datetime-local"
                  className="input input-bordered"
                  value={toDatetimeLocalValue(viewingScore.recorded_at)}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    if (Number.isNaN(d.getTime())) return;
                    setViewingScore({
                      ...viewingScore,
                      recorded_at: d.toISOString(),
                    });
                  }}
                  required
                />
              </label>
              <label className="form-control">
                <span className="label-text">Planet A</span>
                <select
                  className="select select-bordered"
                  value={viewingScore.planet_a_id}
                  onChange={(e) =>
                    setViewingScore({
                      ...viewingScore,
                      planet_a_id: e.target.value,
                    })
                  }
                >
                  {!planetById.has(viewingScore.planet_a_id) && (
                    <option value={viewingScore.planet_a_id}>
                      {viewingScore.planet_a_id} (missing)
                    </option>
                  )}
                  {planets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.creator_name})
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control">
                <span className="label-text">Planet B</span>
                <select
                  className="select select-bordered"
                  value={viewingScore.planet_b_id}
                  onChange={(e) =>
                    setViewingScore({
                      ...viewingScore,
                      planet_b_id: e.target.value,
                    })
                  }
                >
                  {!planetById.has(viewingScore.planet_b_id) && (
                    <option value={viewingScore.planet_b_id}>
                      {viewingScore.planet_b_id} (missing)
                    </option>
                  )}
                  {planets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.creator_name})
                    </option>
                  ))}
                </select>
              </label>

              <div className="text-xs opacity-50">
                Created {formatDate(viewingScore.created_at)} · Updated{" "}
                {formatDate(viewingScore.updated_at)}
              </div>

              <div className="mt-2 flex flex-wrap justify-between gap-2">
                <button
                  type="button"
                  className="btn btn-error btn-outline"
                  disabled={scoreSaving}
                  onClick={() => void onDeleteScore(viewingScore)}
                >
                  Delete
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setViewingScore(null)}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={scoreSaving}
                  >
                    {scoreSaving ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      "Save"
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setViewingScore(null)}>
              close
            </button>
          </form>
        </dialog>
      )}
    </div>
  );
}
