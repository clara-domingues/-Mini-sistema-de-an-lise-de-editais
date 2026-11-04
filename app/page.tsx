"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/client";

type Bid = {
  id: string;
  title?: string | null;
  objeto?: string | null;
  orgao?: string | null;
  client_name?: string | null;
  estimated_value?: number | string | null;
  status?: string | null;
  deadline?: string | null;
  created_at?: string | null;
};

type DeadlineItem = {
  bid: Bid;
  date: Date;
  status: string;
  day: Date;
};

function normalizeStatus(status?: string | null): string {
  return (status ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null;

  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);

    const date = new Date(year, month, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getEstimatedValue(bid: Bid): number {
  const value = Number(bid.estimated_value);

  return Number.isFinite(value) && value > 0 ? value : 0;
}

const TERMINAL_STATUSES = new Set([
  "ganho",
  "ganha",
  "vencido",
  "perdido",
  "perdida",
  "no_go",
  "nogo",
  "homologado",
  "homologada",
  "desclassificado",
  "desclassificada",
  "encerrado",
  "encerrada",
  "cancelado",
  "cancelada",
  "revogado",
  "revogada",
  "fracassado",
  "fracassada",
  "anulado",
  "anulada",
]);

const WON_STATUSES = new Set([
  "ganho",
  "ganha",
  "homologado",
  "homologada",
]);

const LOST_STATUSES = new Set([
  "perdido",
  "perdida",
  "no_go",
  "nogo",
  "desclassificado",
  "desclassificada",
  "cancelado",
  "cancelada",
  "revogado",
  "revogada",
  "fracassado",
  "fracassada",
  "anulado",
  "anulada",
]);

export default function Home() {
  const [supabase] = useState(() => createClient());
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadBids = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchBids() {
      try {
        setLoadError("");

        const { data, error } = await supabase
          .from("bids")
          .select(
            "id, title, estimated_value, status, deadline, created_at, tenant_id, client_id"
          )
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        if (!cancelled) {
          setBids((data ?? []) as Bid[]);
        }
      } catch (error) {
        console.error("Erro ao carregar editais:", error);

        if (!cancelled) {
          setLoadError(
            "Não foi possível carregar os editais. Verifique sua conexão e as permissões da conta."
          );
          setBids([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchBids();

    return () => {
      cancelled = true;
    };
  }, [supabase, refreshKey]);

  const metrics = useMemo(() => {
    const today = startOfDay(new Date());

    const activeBids = bids.filter((bid) => {
      const status = normalizeStatus(bid.status);

      return status !== "" && !TERMINAL_STATUSES.has(status);
    });

    const wonBids = bids.filter((bid) =>
      WON_STATUSES.has(normalizeStatus(bid.status))
    );

    const lostBids = bids.filter((bid) =>
      LOST_STATUSES.has(normalizeStatus(bid.status))
    );

    const completedBids = wonBids.length + lostBids.length;

    const totalInDispute = activeBids.reduce(
      (total, bid) => total + getEstimatedValue(bid),
      0
    );

    const successRate =
      completedBids > 0
        ? Math.round((wonBids.length / completedBids) * 100)
        : 0;

    const withDeadlines: DeadlineItem[] = bids.flatMap((bid) => {
      const date = parseDate(bid.deadline);
      const status = normalizeStatus(bid.status);

      if (
        date === null ||
        status === "" ||
        TERMINAL_STATUSES.has(status)
      ) {
        return [];
      }

      return [
        {
          bid,
          date,
          status,
          day: startOfDay(date),
        },
      ];
    });

    const overdue = withDeadlines
      .filter((item) => item.day.getTime() < today.getTime())
      .sort((a, b) => b.day.getTime() - a.day.getTime())
      .slice(0, 5);

    const upcoming = withDeadlines
      .filter((item) => item.day.getTime() >= today.getTime())
      .sort((a, b) => a.day.getTime() - b.day.getTime())
      .slice(0, 5);

    return {
      activeBids,
      wonBids,
      lostBids,
      completedBids,
      totalInDispute,
      successRate,
      overdue,
      upcoming,
    };
  }, [bids]);

  const formatBRL = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const formatDate = (date: Date) =>
    date.toLocaleDateString("pt-BR");

  const renderDeadlineList = (
    items: DeadlineItem[],
    emptyMessage: string,
    isOverdue = false
  ) => {
    if (loading) {
      return (
        <p className="p-4 text-center text-sm text-slate-400 dark:text-slate-500">
          Carregando editais...
        </p>
      );
    }

    if (items.length === 0) {
      return (
        <p className="p-4 text-center text-sm text-slate-400 dark:text-slate-500">
          {emptyMessage}
        </p>
      );
    }

    return (
      <div className="space-y-3">
        {items.map(({ bid, date }) => (
          <Link
            key={bid.id}
            href={`/editais/${bid.id}`}
            className={`group flex items-center justify-between gap-3 rounded-xl border p-3.5 transition ${
              isOverdue
                ? "border-red-100 dark:border-red-950 bg-red-50/60 dark:bg-red-950/30 hover:border-red-200 dark:hover:border-red-900"
                : "border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 hover:border-blue-200 dark:hover:border-blue-900 hover:bg-blue-50/50 dark:hover:bg-blue-950/30"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="wrap-break-word text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {bid.title || bid.objeto || "Edital sem título"}
              </p>

              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {bid.client_name || bid.orgao || "Cliente não informado"}
              </p>
            </div>

            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                isOverdue
                  ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
                  : "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
              }`}
            >
              {formatDate(date)}
            </span>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Nav />

      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
        <div className="mx-auto max-w-6xl space-y-8">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Visão Geral e Indicadores
              </h1>

              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Acompanhe oportunidades, prazos e resultados das suas licitações.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadBids}
                disabled={loading}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? "Carregando..." : "Atualizar"}
              </button>

              <Link
                href="/editais"
                className="self-start rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Ver Kanban de Editais
              </Link>
            </div>
          </header>

          {loadError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-4 text-sm text-red-700 dark:text-red-300"
            >
              {loadError}

              <button
                type="button"
                onClick={loadBids}
                className="ml-2 font-semibold underline"
              >
                Tentar novamente
              </button>
            </div>
          )}

          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Oportunidades Ativas"
              value={loading ? "..." : String(metrics.activeBids.length)}
              detail={`De ${bids.length} editais cadastrados`}
            />

            <MetricCard
              label="Valor em Disputa"
              value={
                loading ? "..." : formatBRL(metrics.totalInDispute)
              }
              valueClass="text-blue-600 dark:text-blue-400"
            />

            <MetricCard
              label="Licitações Ganhas"
              value={loading ? "..." : String(metrics.wonBids.length)}
              detail={`${metrics.completedBids} resultados classificados`}
              valueClass="text-emerald-600 dark:text-emerald-400"
            />

            <MetricCard
              label="Taxa de Sucesso"
              value={loading ? "..." : `${metrics.successRate}%`}
              detail="Sobre resultados classificados"
              valueClass="text-blue-600 dark:text-blue-400"
            />
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Próximos prazos
                </h2>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Oportunidades abertas ordenadas pela data limite.
                </p>
              </div>

              {renderDeadlineList(
                metrics.upcoming,
                "Nenhum prazo futuro encontrado."
              )}
            </div>

            <div className="space-y-4 rounded-2xl border border-red-100 dark:border-red-950 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-red-700 dark:text-red-400">
                  Prazos vencidos
                </h2>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Editais abertos cuja data limite já passou.
                </p>
              </div>

              {renderDeadlineList(
                metrics.overdue,
                "Nenhum prazo vencido encontrado.",
                true
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Últimos resultados
            </h2>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Resultados registrados no sistema.
            </p>

            {loading ? (
              <p className="pt-4 text-sm text-slate-400">
                Carregando...
              </p>
            ) : metrics.completedBids === 0 ? (
              <p className="pt-4 text-sm text-slate-400">
                Ainda não há resultados classificados como ganho ou perda.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {bids
                  .filter((bid) => {
                    const status = normalizeStatus(bid.status);

                    return (
                      WON_STATUSES.has(status) ||
                      LOST_STATUSES.has(status)
                    );
                  })
                  .slice(0, 5)
                  .map((bid) => {
                    const won = WON_STATUSES.has(
                      normalizeStatus(bid.status)
                    );

                    return (
                      <Link
                        key={bid.id}
                        href={`/editais/${bid.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-800 p-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <span className="min-w-0 flex-1 wrap-break-word text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {bid.title || bid.objeto || "Edital sem título"}
                        </span>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                            won
                              ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {won ? "Ganho" : "Encerrado / não ganho"}
                        </span>
                      </Link>
                    );
                  })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  valueClass = "text-slate-900 dark:text-white",
}: {
  label: string;
  value: string;
  detail?: string;
  valueClass?: string;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-colors">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className={`break-words text-2xl font-extrabold ${valueClass}`}>
        {value}
      </p>

      {detail && (
        <p className="text-xs text-slate-400">{detail}</p>
      )}
    </div>
  );
}