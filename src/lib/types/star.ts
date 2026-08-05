import { VOID_COLOR } from "@/lib/theme";

/**
 * The five values a participant actually customizes. Everything else in the
 * sketch is pinned to SKETCH_DEFAULTS below. This object is what gets stored
 * as JSON on the row.
 */
export type StarParams = {
  freq: number;
  noise: number;
  core: number;
  hue: number;
  hue2: number;
};

export type StarControl = {
  key: StarKey;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Renders the slider track as the HSB hue ramp the value maps to. */
  hue?: boolean;
};

export const STAR_CONTROLS: readonly StarControl[] = [
  { key: "freq", label: "Frequency", min: 1, max: 12, step: 0.1 },
  { key: "noise", label: "Noise", min: 1, max: 100, step: 1 },
  { key: "core", label: "Core", min: 0, max: 100, step: 1 },
  { key: "hue", label: "Corona hue", min: 0, max: 255, step: 1, hue: true },
  { key: "hue2", label: "Outer hue", min: 0, max: 255, step: 1, hue: true },
] as const;

export type StarKey = keyof StarParams;

export const STAR_KEYS = ["freq", "noise", "core", "hue", "hue2"] as const;

export const DEFAULT_STAR_PARAMS: StarParams = {
  freq: 5,
  noise: 20,
  core: 50,
  hue: 69,
  hue2: 0,
};

const CONTROL_BY_KEY = Object.fromEntries(
  STAR_CONTROLS.map((c) => [c.key, c]),
) as Record<StarKey, StarControl>;

/** Clamps one value to its control's range; falls back to the default. */
export function clampStar(key: StarKey, value: unknown): number {
  const c = CONTROL_BY_KEY[key];
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_STAR_PARAMS[key];
  return Math.min(c.max, Math.max(c.min, n));
}

/**
 * Coerces whatever came back from the `star_params` jsonb column into a
 * complete, in-range StarParams. Missing or junk keys fall back to defaults.
 */
export function toStarParams(value: unknown): StarParams {
  if (!value || typeof value !== "object") return { ...DEFAULT_STAR_PARAMS };
  const raw = value as Record<string, unknown>;
  return {
    freq: clampStar("freq", raw.freq),
    noise: clampStar("noise", raw.noise),
    core: clampStar("core", raw.core),
    hue: clampStar("hue", raw.hue),
    hue2: clampStar("hue2", raw.hue2),
  };
}

/**
 * Everything the sketch reads that participants don't touch. Merged with
 * StarParams at draw time — tweak the look here rather than in the component.
 */
export const SKETCH_DEFAULTS = {
  star: {
    x: 0.5,
    y: 0.5,
    size: 120, // fixed — not exposed as a slider
  },
  glow: {
    tone: 1.5,
    thresh: 2,
    fuse: 3,
    blend: 3,
    halo: 0.95,
    grad: 0.3,
    soft: 3,
    sat: 0.8,
    bri: 0.3,
    radBase: 0.5,
    radCore: 0.6,
    base: VOID_COLOR,
  },
  particles: {
    num: 100,
    size: 12,
    detail: 10,
    sat: 180,
    coronaR: 140,
    coronaW: 0.45,
    hueSpread: 1.7,
    noiseGain: 2.2,
    noiseSpeed: 0.3,
    noiseOctaves: 4,
    follow: 0.35,
  },
  post: {
    ca: 0.01,
    grain: 0.5,
    grainDisplace: 5,
    grainAnimate: true,
  },
} as const;

/**
 * HSB hue (0–255, the sketch's scale) → CSS color. Used for slider track
 * gradients and the cheap non-WebGL previews in admin.
 */
export function hueToCss(hue: number, saturation = 85, lightness = 55): string {
  const h = (((hue / 255) * 360) % 360).toFixed(1);
  return `hsl(${h} ${saturation}% ${lightness}%)`;
}
