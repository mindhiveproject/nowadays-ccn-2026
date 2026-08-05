import { createClient } from "@/utils/supabase/client";
import type {
  Planet,
  PlanetInsert,
  PlanetUpdate,
} from "@/lib/types/planet";
import { toStarParams } from "@/lib/types/star";

/**
 * `star_params` is jsonb, so anything could come back — including rows written
 * before a control existed. Coerce every read through the star schema.
 */
export function normalizePlanet(row: unknown): Planet {
  const planet = row as Planet;
  return { ...planet, star_params: toStarParams(planet.star_params) };
}

export async function listPlanets(): Promise<Planet[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("planets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizePlanet);
}

export async function getPlanet(id: string): Promise<Planet | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("planets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizePlanet(data) : null;
}

export async function createPlanet(payload: PlanetInsert): Promise<Planet> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("planets")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return normalizePlanet(data);
}

export async function updatePlanet(
  id: string,
  payload: PlanetUpdate,
): Promise<Planet> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("planets")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return normalizePlanet(data);
}

export async function upsertPlanetById(
  id: string | null,
  payload: PlanetInsert,
): Promise<Planet> {
  if (id) {
    return updatePlanet(id, payload);
  }
  return createPlanet(payload);
}

export async function countStaged(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("planets")
    .select("*", { count: "exact", head: true })
    .eq("is_staged", true);

  if (error) throw error;
  return count ?? 0;
}

export async function setPlanetStaged(
  id: string,
  is_staged: boolean,
): Promise<Planet> {
  return updatePlanet(id, { is_staged });
}
