
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getTenantId(
  supabase: SupabaseClient
): Promise<string | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data, error } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error || !data?.tenant_id) {
    return null;
  }

  return data.tenant_id;
}
