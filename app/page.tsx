"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/client";

type Bid = {
  id: string;
  title?: string;
  objeto?: string;
  orgao?: string;
  client_name?: string;
  estimated_value?: number;
  status?: string;
  deadline?: string;
};

export default function Home() {
  const supabase = createClient();
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBids() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("bids")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data) {
          setBids(data);
        }
      } catch (err) {
        console.error("Erro ao carregar editais:", err);
      } finally {
        setLoading(false);
      }
    }

    void loadBids();
  }, [supabase]);

  const totalEditais = bids.length;
  const emDisputa = bids.filter(
    (b) => b.status === "go" || b.status === "GO" || b.status === "em_andamento"
  );
  const ganhas = bids.filter(
    (b) => b.status === "ganho" || b.status === "homologado"
  );

  const valorEmDisputa = emDisputa.reduce(
    (acc, b) => acc + (Number(b.estimated_value) || 0),
    0
  );

  const taxaSucesso =
    totalEditais > 0 ? Math.round((ganhas.length / totalEditais) * 100) : 0;

  const formatBRL = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);

  const formatData = (dateString?: string) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString("pt-BR");
    } catch {
      return null;
    }
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
                Visão Geral & Indicadores
              </h1>
              <p className="text-sm text-slate-500">
                Acompanhe o desempenho global das suas licitações, valores em disputa e métricas de sucesso.
              </p>
            </div>
            <Link
              href="/editais"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition shadow-sm self-start"
            >
              Ver Kanban de Editais
            </Link>
          </header>

          {/* Cards de Métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Oportunidades Ativas
              </p>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-slate-900">
                  {loading ? "..." : totalEditais}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  De {totalEditais} totais
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Valor Total em Disputa
              </p>
              <p className="text-2xl font-extrabold text-blue-600 truncate">
                {loading ? "..." : formatBRL(valorEmDisputa)}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Licitações Ganhas (Homologadas)
              </p>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-emerald-600">
                  {loading ? "..." : ganhas.length}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  0 finalizadas
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Taxa de Sucesso
              </p>
              <p className="text-3xl font-extrabold text-blue-600">
                {loading ? "..." : `${taxaSucesso}%`}
              </p>
            </div>
          </div>

          {/* Listagens */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editais Próximos do Prazo */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900">
                Editais Próximos do Prazo
              </h2>

              <div className="space-y-3">
                {bids.length > 0 ? (
                  bids.slice(0, 5).map((bid) => {
                    const dataFormatada = formatData(bid.deadline);

                    return (
                      <Link
                        key={bid.id}
                        href={`/editais/${bid.id}`}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 hover:bg-blue-50/50 hover:border-blue-200 transition group cursor-pointer"
                      >
                        <div className="min-w-0 pr-3">
                          <p className="text-xs font-bold text-slate-800 group-hover:text-blue-600 truncate transition">
                            {bid.title || bid.objeto || "Edital sem título"}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {bid.client_name || bid.orgao || "Cliente não informado"}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 font-medium text-[10px] px-2.5 py-1 rounded-full ${
                            dataFormatada
                              ? "bg-blue-50 text-blue-600 font-semibold"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {dataFormatada || "Prazo não definido"}
                        </span>
                      </Link>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400 p-4 text-center">
                    Nenhum edital cadastrado.
                  </p>
                )}
              </div>
            </div>

            {/* Últimos Resultados */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900">
                Últimos Resultados
              </h2>
              <p className="text-xs text-slate-400 pt-2">
                Ainda sem histórico de resultados.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}