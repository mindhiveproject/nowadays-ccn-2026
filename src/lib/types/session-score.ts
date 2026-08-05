export type SessionScore = {
  id: string;
  yq_session_id: string;
  planet_a_id: string;
  planet_b_id: string;
  score: number;
  /**
   * A sentence or two on how the pair went about syncing. The column doesn't
   * exist yet — until it lands rows read back `undefined` and the scoreboard
   * simply leaves the line out, so nothing here has to change when it does.
   */
  strategy?: string | null;
  recorded_at: string;
  created_at: string;
  updated_at: string;
};

export type SessionScoreInsert = {
  yq_session_id: string;
  planet_a_id: string;
  planet_b_id: string;
  score: number;
  strategy?: string | null;
  recorded_at?: string;
};

export type SessionScoreUpdate = Partial<
  Omit<SessionScore, "id" | "yq_session_id" | "created_at" | "updated_at">
>;
