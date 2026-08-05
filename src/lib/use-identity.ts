"use client";

import { useSyncExternalStore } from "react";
import { getAnonymousId, getStoredPlanetId } from "@/lib/identity";

/** localStorage only changes under us from another tab. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

const serverPlanetId = () => null;
const serverAnonymousId = () => null;
const clientHydrated = () => true;
const serverHydrated = () => false;

/**
 * Who this device is, straight out of localStorage.
 *
 * Read through `useSyncExternalStore` rather than an effect so the values are
 * there on the first client render. `hydrated` is false until then — without
 * it a read-only page can't tell "no planet saved" apart from "not read yet"
 * and flashes the wrong empty state.
 */
export function useStoredIdentity(): {
  planetId: string | null;
  anonymousId: string | null;
  hydrated: boolean;
} {
  const planetId = useSyncExternalStore(
    subscribe,
    getStoredPlanetId,
    serverPlanetId,
  );
  const anonymousId = useSyncExternalStore(
    subscribe,
    getAnonymousId,
    serverAnonymousId,
  );
  const hydrated = useSyncExternalStore(
    subscribe,
    clientHydrated,
    serverHydrated,
  );

  return { planetId, anonymousId, hydrated };
}
