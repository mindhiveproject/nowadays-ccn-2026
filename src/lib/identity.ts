import { ANONYMOUS_ID_KEY, PLANET_ID_KEY } from "@/lib/constants";

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateAnonymousId(): string {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(ANONYMOUS_ID_KEY);
  if (existing) return existing;
  const id = uuid();
  localStorage.setItem(ANONYMOUS_ID_KEY, id);
  return id;
}

export function getStoredPlanetId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PLANET_ID_KEY);
}

export function setStoredPlanetId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLANET_ID_KEY, id);
}

export function clearStoredPlanetId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PLANET_ID_KEY);
}
