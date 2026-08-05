"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import StarCanvasClient from "@/components/StarCanvasClient";
import { getPlanet } from "@/lib/planets";
import { VOID_COLOR } from "@/lib/theme";
import type { Planet } from "@/lib/types/planet";
import { STAR_CONTROLS } from "@/lib/types/star";

export default function StarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [planet, setPlanet] = useState<Planet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getPlanet(id)
      .then((row) => {
        if (!cancelled) {
          setPlanet(row);
          if (!row) setError("Star not found.");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center"
        style={{ backgroundColor: VOID_COLOR }}
      >
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (error || !planet) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-base-200 p-6">
        <p className="text-error">{error ?? "Not found"}</p>
        <Link href="/admin" className="btn btn-ghost btn-sm">
          Back to admin
        </Link>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-dvh text-base-content"
      style={{ backgroundColor: VOID_COLOR }}
    >
      <div className="pointer-events-none fixed inset-0 z-0">
        <StarCanvasClient params={planet.star_params} />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col p-5">
        <div className="mt-auto flex flex-col gap-3 rounded-box border border-white/10 bg-black/50 p-5 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{planet.name}</h1>
              <p className="text-sm opacity-60">
                by {planet.creator_name}
                {planet.is_staged ? " · staged" : ""}
              </p>
            </div>
            <Link href="/admin" className="btn btn-ghost btn-sm">
              Admin
            </Link>
          </div>

          <ul className="text-sm opacity-80">
            {planet.answer1 && <li>Name answer: {planet.answer1}</li>}
            {planet.answer2 && <li>Mood: {planet.answer2}</li>}
            {planet.answer3 && <li>Motion: {planet.answer3}</li>}
          </ul>

          <div className="grid grid-cols-2 gap-2 text-sm">
            {STAR_CONTROLS.map((control) => (
              <div
                key={control.key}
                className="rounded-box border border-white/10 px-3 py-2"
              >
                <div className="opacity-60">{control.label}</div>
                <div className="font-mono">
                  {planet.star_params[control.key]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
