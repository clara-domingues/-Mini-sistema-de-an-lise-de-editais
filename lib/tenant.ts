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

export async function deductAiCredit(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  // 1. Busca os créditos na tabela correta: tenant_ai_credits
  const { data, error } = await supabase
    .from("tenant_ai_credits")
    .select("credits_balance")
    .eq("tenant_id", tenantId)
    .single();

  if (error || !data || (data.credits_balance ?? 0) <= 0) {
    return false;
  }

  const currentCredits = data.credits_balance;

  // 2. Atualiza o saldo decrementando 1 unidade filtrando por tenant_id
  const { error: updateError } = await supabase
    .from("tenant_ai_credits")
    .update({ 
      credits_balance: currentCredits - 1,
      updated_at: new Date().toISOString()
    })
    .eq("tenant_id", tenantId); // 

  if (updateError) {
    console.error("Erro ao atualizar créditos:", updateError.message);
    return false;
  }

  return true;
}