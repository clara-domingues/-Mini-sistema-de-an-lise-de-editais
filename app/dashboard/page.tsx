"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/client";

type Stats = {
  totalBids: number;
  goBids: number;
  noGoBids: number;
  totalEstimatedValue: number;
};

export default function DashboardPage() {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats>({
    totalBids: 0,
    goBids: 0,
    noGoBids: 0,
    totalEstimatedValue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const { data: bids, error } = await supabase.from("bids").select("*");

        if (error) {
          console.error("Erro ao carregar métricas:", error);
          return;
        }

        if (bids) {
          const totalBids = bids.length;
          const goBids = bids.filter(
            (b) => b.status === "go" || b.status === "GO"
          ).length;
          const noGoBids = bids.filter(
            (b) => b.status === "no_go" || b.status === "NO_GO"
          ).length;
          const totalEstimatedValue = bids.reduce(
            (acc, b) => acc + (Number(b.estimated_value) || 0),
            0
          );

          setStats({
            totalBids,
            goBids,
            noGoBids,
            totalEstimatedValue,
          });
        }
      } catch (err) {
        console.error("Erro inesperado no dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    void loadDashboardData();
  }, [supabase]);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <Nav />

      <main className="flex-1 overflow-y-auto px-8 py-8 lg:px-12">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Cabeçalho */}
          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Visão Geral & Métricas
              </h1>
              <p className="text-sm text-slate-500">
                Acompanhe o desempenho geral da empresa em licitações e oportunidades.
              </p>
            </div>
            <Link
              href="/editais"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-xl text-xs transition shadow-sm self-start"
            >
              Ver Editais & Pipeline →
            </Link>
          </header>

          {/* Cards de Métricas (KPIs) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total de Editais
              </p>
              <p className="text-3xl font-extrabold text-slate-900">
                {loading ? "..." : stats.totalBids}
              </p>
              <p className="text-[11px] text-slate-500">
                Oportunidades mapeadas
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-sm space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                Decisões GO
              </p>
              <p className="text-3xl font-extrabold text-emerald-700">
                {loading ? "..." : stats.goBids}
              </p>
              <p className="text-[11px] text-emerald-600">
                Aprovados para participação
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-red-200/80 shadow-sm space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-red-500">
                Decisões NO-GO
              </p>
              <p className="text-3xl font-extrabold text-red-600">
                {loading ? "..." : stats.noGoBids}
              </p>
              <p className="text-[11px] text-red-500">
                Descartados por inconsistência
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Volume Mapeado
              </p>
              <p className="text-xl font-extrabold text-blue-600 truncate">
                {loading ? "..." : formatBRL(stats.totalEstimatedValue)}
              </p>
              <p className="text-[11px] text-slate-500">
                Valor estimado acumulado
              </p>
            </div>
          </div>

          {/* Atalhos Rápidos & Ações */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900">Ações Rápidas</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/editais"
                className="p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition flex items-center justify-between group"
              >
                <div>
                  <p className="font-semibold text-xs text-slate-900 group-hover:text-blue-600">
                    Gerir Editais
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Aceder ao quadro Kanban
                  </p>
                </div>
                <span className="text-blue-600 font-bold text-sm">→</span>
              </Link>

              <Link
                href="/perfil"
                className="p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition flex items-center justify-between group"
              >
                <div>
                  <p className="font-semibold text-xs text-slate-900 group-hover:text-blue-600">
                    Dados da Empresa
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Atualizar dados e setores
                  </p>
                </div>
                <span className="text-blue-600 font-bold text-sm">→</span>
              </Link>

              <Link
                href="/catalogo"
                className="p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition flex items-center justify-between group"
              >
                <div>
                  <p className="font-semibold text-xs text-slate-900 group-hover:text-blue-600">
                    Catálogo de Produtos
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Gerir itens e preços
                  </p>
                </div>
                <span className="text-blue-600 font-bold text-sm">→</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}