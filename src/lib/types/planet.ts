/** Param indices: 1=movement, 2=color, 3=size, 4=agitation */
export type PlanetParams = {
  params1: number;
  params2: number;
  params3: number;
  params4: number;
};

export type Planet = {
  id: string;
  name: string;
  creator_name: string;
  creator_email: string;
  anonymous_id: string;
  answer1: string | null;
  answer2: string | null;
  answer3: string | null;
  params1: number;
  params2: number;
  params3: number;
  params4: number;
  is_staged: boolean;
  created_at: string;
  updated_at: string;
};

export type PlanetInsert = {
  name: string;
  creator_name: string;
  creator_email: string;
  anonymous_id: string;
  answer1?: string | null;
  answer2?: string | null;
  answer3?: string | null;
  params1: number;
  params2: number;
  params3: number;
  params4: number;
  is_staged?: boolean;
};

export type PlanetUpdate = Partial<
  Omit<Planet, "id" | "created_at" | "updated_at" | "anonymous_id">
> & {
  anonymous_id?: string;
};

export const PARAM_KEYS = [
  "params1",
  "params2",
  "params3",
  "params4",
] as const;

export type ParamKey = (typeof PARAM_KEYS)[number];

export const DEFAULT_PARAMS: PlanetParams = {
  params1: 0.5,
  params2: 0.5,
  params3: 0.5,
  params4: 0.5,
};

export function clampParam(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function toPlanetParams(planet: PlanetParams): PlanetParams {
  return {
    params1: clampParam(planet.params1),
    params2: clampParam(planet.params2),
    params3: clampParam(planet.params3),
    params4: clampParam(planet.params4),
  };
}
