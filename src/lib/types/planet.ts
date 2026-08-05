import type { StarParams } from "@/lib/types/star";

/**
 * Rows still live in the `planets` table — only the visual changed. The four
 * `params1..4` columns are gone; the star's tunables ride in `star_params`.
 */
export type Planet = {
  id: string;
  name: string;
  creator_name: string;
  creator_email: string;
  anonymous_id: string;
  answer1: string | null;
  answer2: string | null;
  answer3: string | null;
  star_params: StarParams;
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
  star_params: StarParams;
  is_staged?: boolean;
};

export type PlanetUpdate = Partial<
  Omit<Planet, "id" | "created_at" | "updated_at" | "anonymous_id">
> & {
  anonymous_id?: string;
};
