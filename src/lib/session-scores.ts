import { createClient } from "@/utils/supabase/client";
import type { SessionScore } from "@/lib/types/session-score";

export async function listSessionScores(): Promise<SessionScore[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_scores")
    .select("*")
    .order("recorded_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as SessionScore[];
}

export async function getLatestSessionScore(): Promise<SessionScore | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_scores")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as SessionScore | null) ?? null;
}

export async function getSessionScoreByYqId(
  yqSessionId: string,
): Promise<SessionScore | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("session_scores")
    .select("*")
    .eq("yq_session_id", yqSessionId)
    .maybeSingle();

  if (error) throw error;
  return (data as SessionScore | null) ?? null;
}
