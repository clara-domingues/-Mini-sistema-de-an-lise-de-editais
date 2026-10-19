"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/client";
import { getTenantId } from "@/lib/tenant";

type Bid = {
  id: string;
  title: string;
  client_name: string | null;
  stage: string;
  due_date: string | null;
  value: number | null;
  created_at: string;
};

export default function DashboardPage() {
  const [supabase] = useState(() => createClient());
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const tenantId = await getTenantId(supabase);
      if (!tenantId) return;

      const { data } = await supabase
        .from("bids")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      setBids(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Cálculos de KPIs
  const activeBids = bids.filter((b) => b.stage !== "Concluído" && b.stage !== "Cancelado");
  const wonBids = bids.filter((b) => b.stage === "Concluído");
  const totalValue = activeBids.reduce((acc, b) => acc + (b.value || 0), 0);
  const successRate = bids.length > 0 ? Math.round((wonBids.length / bids.length) * 100) : 0;

  return (
    <div className="flex min-h-screen w-full bg-slate-100">
      <Nav />
      <main className="flex-1 w-full overflow-y-auto px-8 py-8 text-slate-900 lg:px-12">
        <div className="w-full space-y-8">
          <header className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Visão Geral & Indicadores
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Acompanhe o desempenho global das suas licitações, valores em disputa e métricas de sucesso.
              </p>
            </div>
            <Link
              href="/editais"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Ver Kanban de Editais
            </Link>
          </header>

          {/* Cards de KPIs */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Oportunidades Ativas
              </span>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-slate-900">{activeBids.length}</span>
                <span className="text-xs text-slate-500">De {bids.length} totais</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Valor Total em Disputa
              </span>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-blue-600">
                  {totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Licitações Ganhas (Homologadas)
              </span>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-emerald-600">{wonBids.length}</span>
                <span className="text-xs text-slate-500">{bids.filter(b => b.stage === "Concluído").length} finalizadas</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Taxa de Sucesso
              </span>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-indigo-600">{successRate}%</span>
              </div>
            </div>
          </div>

          {/* Listas resumo */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900">Editais Próximos do Prazo</h2>
              {loading ? (
                <p className="text-sm text-slate-500">Carregando...</p>
              ) : activeBids.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum edital ativo no momento.</p>
              ) : (
                <div className="space-y-3">
                  {activeBids.slice(0, 4).map((bid) => (
                    <div key={bid.id} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                      <div className="max-w-[70%]">
                        <p className="font-semibold text-sm text-slate-800 truncate">{bid.title}</p>
                        <p className="text-xs text-slate-400">{bid.client_name || "Cliente não informado"}</p>
                      </div>
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md">
                        {bid.due_date ? new Date(bid.due_date).toLocaleDateString("pt-BR") : "Sem prazo"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900">Últimos Resultados</h2>
              {wonBids.length === 0 ? (
                <p className="text-sm text-slate-400">Ainda sem histórico de resultados.</p>
              ) : (
                <div className="space-y-3">
                  {wonBids.slice(0, 4).map((bid) => (
                    <div key={bid.id} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="font-semibold text-sm text-slate-800">{bid.title}</p>
                        <p className="text-xs text-slate-400">{bid.client_name}</p>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">Ganhou</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}