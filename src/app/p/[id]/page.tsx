"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import PlanetCanvasClient from "@/components/PlanetCanvasClient";
import { PARAM_LABELS } from "@/lib/constants";
import { getPlanet } from "@/lib/planets";
import { PARAM_KEYS, type Planet } from "@/lib/types/planet";

export default function PlanetDetailPage({
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
          if (!row) setError("Planet not found.");
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
      <div className="flex min-h-dvh items-center justify-center bg-black">
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
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-base-100">
      <div className="w-full">
        <PlanetCanvasClient params={planet} />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
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
          {PARAM_KEYS.map((key) => (
            <div
              key={key}
              className="rounded-box border border-base-300 px-3 py-2"
            >
              <div className="opacity-60">{PARAM_LABELS[key]}</div>
              <div className="font-mono">{planet[key].toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
