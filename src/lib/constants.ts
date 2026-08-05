export const ANONYMOUS_ID_KEY = "planet_anonymous_id";
export const PLANET_ID_KEY = "planet_id";
export const ADMIN_SESSION_KEY = "planet_admin_authed";
/** httpOnly cookie set by /api/admin/login for server-side mutate authorization */
export const ADMIN_COOKIE_NAME = "planet_admin";

export const QUESTIONS = [
  {
    id: "answer1",
    label: "What would you name this planet?",
    type: "text" as const,
    placeholder: "e.g. Ember Ring",
  },
] as const;

export const MAX_STAGED = 2;
