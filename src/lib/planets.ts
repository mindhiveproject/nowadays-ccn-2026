import { createClient } from "@/utils/supabase/client";
import type {
  Planet,
  PlanetInsert,
  PlanetUpdate,
} from "@/lib/types/planet";

export async function listPlanets(): Promise<Planet[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("planets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Planet[];
}

export async function getPlanet(id: string): Promise<Planet | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("planets")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as Planet | null;
}

export async function createPlanet(payload: PlanetInsert): Promise<Planet> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("planets")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as Planet;
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
  return data as Planet;
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
