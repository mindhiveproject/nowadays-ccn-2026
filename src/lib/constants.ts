import type { ParamKey } from "@/lib/types/planet";

export const ANONYMOUS_ID_KEY = "planet_anonymous_id";
export const PLANET_ID_KEY = "planet_id";
export const ADMIN_SESSION_KEY = "planet_admin_authed";

export const QUESTIONS = [
  {
    id: "answer1",
    label: "What would you name this planet?",
    type: "text" as const,
    placeholder: "e.g. Ember Ring",
  },
  {
    id: "answer2",
    label: "What mood should it carry?",
    type: "select" as const,
    options: [
      "Calm",
      "Curious",
      "Electric",
      "Melancholy",
      "Wild",
      "Dreamy",
    ],
  },
  {
    id: "answer3",
    label: "One word for how it moves through space?",
    type: "text" as const,
    placeholder: "e.g. drift, pulse, scatter",
  },
] as const;

export const PARAM_LABELS: Record<ParamKey, string> = {
  params1: "Movement",
  params2: "Color",
  params3: "Size",
  params4: "Agitation",
};

export const MAX_STAGED = 2;
