import { SupabaseClient } from "@supabase/supabase-js";

export async function checkAndDeductCredits(
  supabase: SupabaseClient,
  tenantId: string,
  cost: number = 1.0,
  actionType: string = "chat_ia"
): Promise<{ success: boolean; error?: string; remaining?: number }> {
  // 1. Buscar o saldo atual
  const { data: creditRow, error: fetchError } = await supabase
    .from("tenant_ai_credits")
    .select("credits_balance")
    .eq("tenant_id", tenantId)
    .single();

  if (fetchError || !creditRow) {
    // Se não existir registo, cria um saldo inicial padrão
    const { error: insertError } = await supabase
      .from("tenant_ai_credits")
      .insert({ tenant_id: tenantId, credits_balance: 100.00 });

    if (insertError) return { success: false, error: "Erro ao inicializar créditos." };
    return checkAndDeductCredits(supabase, tenantId, cost, actionType);
  }

  if (creditRow.credits_balance < cost) {
    return { success: false, error: "Créditos de IA insuficientes. Recarregue o seu plano." };
  }

  const newBalance = creditRow.credits_balance - cost;

  // 2. Atualizar o saldo
  const { error: updateError } = await supabase
    .from("tenant_ai_credits")
    .update({ credits_balance: newBalance, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId);

  if (updateError) return { success: false, error: "Erro ao atualizar créditos." };

  // 3. Registar o log de consumo
  await supabase.from("ai_credit_usage_logs").insert({
    tenant_id: tenantId,
    amount_deducted: cost,
    action_type: actionType,
  });

  return { success: true, remaining: newBalance };
}