"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";
import GoNoGo from "@/components/GoNoGo";

export const dynamic = "force-dynamic";

type Extracted = {
  objeto: string;
  orgao: string;
  modalidade: string;
  valor_estimado: number | null;
  datas: {
    abertura_propostas: string | null;
    impugnacao: string | null;
    sessao: string | null;
    vigencia: string | null;
  };
  habilitacao: {
    juridica: string[];
    fiscal: string[];
    tecnica: string[];
    economica: string[];
  };
  sancoes: string[];
  itens: {
    descricao: string;
    quantidade: number | null;
    unidade: string | null;
    valor_unitario_estimado: number | null;
  }[];
  riscos: string[];
};

type Bid = {
  id: string;
  title: string | null;
  status: "uploaded" | "processing" | "analyzed" | "error";
  extracted_data: Extracted | null;
  error_message: string | null;
  checklist: {
    categoria: string;
    texto: string;
    ok: boolean;
  }[] | null;
  decision: "go" | "no_go" | null;
};

type Feedback = {
  type: "success" | "error";
  message: string;
};

const brl = (value: number | null) => {
  if (value == null || Number.isNaN(value)) {
    return "Não informado";
  }

  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Não informado";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusLabel(status: Bid["status"]) {
  switch (status) {
    case "uploaded":
      return "Aguardando análise";

    case "processing":
      return "Analisando";

    case "analyzed":
      return "Analisado";

    case "error":
      return "Erro na análise";

    default:
      return status;
  }
}

function statusClasses(status: Bid["status"]) {
  switch (status) {
    case "uploaded":
      return "border-slate-200 bg-slate-50 text-slate-700";

    case "processing":
      return "border-amber-200 bg-amber-50 text-amber-800";

    case "analyzed":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";

    case "error":
      return "border-red-200 bg-red-50 text-red-800";

    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocorreu um erro inesperado. Tente novamente.";
}

export default function EditalDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const supabase = useMemo(() => createClient(), []);

  const [bid, setBid] = useState<Bid | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const carregar = useCallback(async () => {
    if (!id) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("bids")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw new Error(
          "Não foi possível carregar o edital. Verifique sua conexão e tente novamente."
        );
      }

      if (!data) {
        setNotFound(true);
        setBid(null);
        return null;
      }

      setNotFound(false);
      setBid(data as Bid);

      return data as Bid;
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        message: getErrorMessage(error),
      });

      return null;
    } finally {
      setLoading(false);
    }
  }, [id, supabase]);

  useEffect(() => {
    let mounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function iniciar() {
      if (!mounted) {
        return;
      }

      const currentBid = await carregar();

      if (!mounted) {
        return;
      }

      const precisaAcompanhar =
        currentBid?.status === "processing" ||
        currentBid?.status === "uploaded";

      if (!precisaAcompanhar) {
        return;
      }

      interval = setInterval(async () => {
        const updatedBid = await carregar();

        if (
          updatedBid &&
          updatedBid.status !== "processing" &&
          updatedBid.status !== "uploaded"
        ) {
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      }, 4000);
    }

    void iniciar();

    return () => {
      mounted = false;

      if (interval) {
        clearInterval(interval);
      }
    };
  }, [carregar]);

  async function reanalisar() {
    if (!id || retrying) {
      return;
    }

    setRetrying(true);
    setFeedback(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error(
          "Sua sessão não está válida. Entre novamente para continuar."
        );
      }

      setBid((previous) =>
        previous
          ? {
              ...previous,
              status: "processing",
              error_message: null,
            }
          : previous
      );

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/analyze-bid`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            bid_id: id,
          }),
        }
      );

      if (!response.ok) {
        let message =
          "Não foi possível iniciar uma nova análise.";

        try {
          const body = await response.json();

          if (body?.error) {
            message = body.error;
          }

          if (body?.message) {
            message = body.message;
          }
        } catch {
          // Mantém a mensagem padrão caso a resposta não seja JSON.
        }

        throw new Error(message);
      }

      setFeedback({
        type: "success",
        message:
          "Nova análise iniciada. Aguarde enquanto a inteligência artificial processa o edital.",
      });

      await carregar();
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        message: getErrorMessage(error),
      });

      await carregar();
    } finally {
      setRetrying(false);
    }
  }

  if (loading && !bid) {
    return (
      <>
        <Nav />

        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
          <Link
            href="/editais"
            className="inline-flex text-sm font-medium text-blue-600 transition hover:text-blue-800"
          >
            ← Voltar para editais
          </Link>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

            <h1 className="mt-4 text-lg font-semibold text-slate-900">
              Carregando edital...
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Estamos buscando as informações da análise.
            </p>
          </div>
        </main>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <Nav />

        <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
          <Link
            href="/editais"
            className="inline-flex text-sm font-medium text-blue-600 transition hover:text-blue-800"
          >
            ← Voltar para editais
          </Link>

          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-lg font-semibold text-red-900">
              Edital não encontrado
            </h1>

            <p className="mt-2 text-sm text-red-700">
              O edital solicitado não existe, foi removido ou você não tem
              permissão para acessá-lo.
            </p>

            <Link
              href="/editais"
              className="mt-5 inline-flex rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Ver meus editais
            </Link>
          </div>
        </main>
      </>
    );
  }

  if (!bid) {
    return null;
  }

  const d = bid.extracted_data;

  const totalRequisitos =
    (d?.habilitacao?.juridica?.length ?? 0) +
    (d?.habilitacao?.fiscal?.length ?? 0) +
    (d?.habilitacao?.tecnica?.length ?? 0) +
    (d?.habilitacao?.economica?.length ?? 0);

  return (
    <>
      <Nav />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-6">
          <Link
            href="/editais"
            className="inline-flex items-center text-sm font-medium text-blue-600 transition hover:text-blue-800"
          >
            ← Voltar para editais
          </Link>
        </div>

        <header className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(
                    bid.status
                  )}`}
                >
                  {statusLabel(bid.status)}
                </span>

                {d?.modalidade && (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                    {d.modalidade}
                  </span>
                )}
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {bid.title ?? "Edital sem título"}
              </h1>

              {d?.orgao && (
                <p className="mt-2 text-sm text-slate-500">
                  {d.orgao}
                </p>
              )}
            </div>

            {bid.status === "error" && (
              <button
                type="button"
                onClick={reanalisar}
                disabled={retrying}
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {retrying ? "Iniciando..." : "Tentar novamente"}
              </button>
            )}
          </div>
        </header>

        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className={`mb-6 rounded-xl border p-4 text-sm ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {feedback.message}
          </div>
        )}

        {bid.status === "uploaded" && (
          <section className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex gap-3">
              <div className="mt-0.5 text-blue-600">ℹ</div>

              <div>
                <h2 className="font-semibold text-blue-900">
                  Edital aguardando análise
                </h2>

                <p className="mt-1 text-sm leading-6 text-blue-800">
                  O documento foi recebido e está aguardando o processamento
                  pela inteligência artificial.
                </p>
              </div>
            </div>
          </section>
        )}

        {bid.status === "processing" && (
          <section className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-amber-300 border-t-amber-700" />

                <div>
                  <h2 className="font-semibold text-amber-900">
                    Analisando edital com inteligência artificial
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-amber-800">
                    Estamos extraindo informações, requisitos, datas,
                    itens e pontos de atenção. Esse processo pode levar
                    alguns minutos.
                  </p>
                </div>
              </div>
            </div>

            <div className="h-1 overflow-hidden bg-amber-100">
              <div className="h-full w-1/3 animate-pulse bg-amber-500" />
            </div>
          </section>
        )}

        {bid.status === "error" && (
          <section className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <h2 className="font-semibold text-red-900">
              Não foi possível concluir a análise
            </h2>

            <p className="mt-1 text-sm leading-6 text-red-800">
              A análise encontrou um problema. Você pode tentar novamente.
            </p>

            {bid.error_message && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-semibold text-red-700">
                  Ver detalhes técnicos
                </summary>

                <pre className="mt-2 overflow-x-auto rounded-lg bg-red-100 p-3 text-xs text-red-900">
                  {bid.error_message}
                </pre>
              </details>
            )}

            <button
              type="button"
              onClick={reanalisar}
              disabled={retrying}
              className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {retrying ? "Iniciando nova análise..." : "Tentar novamente"}
            </button>
          </section>
        )}

        {d && (
          <div className="space-y-6">
            {/* RESUMO */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Visão geral
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    Resumo do edital
                  </h2>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Objeto
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-800">
                    {d.objeto || "Não informado"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Órgão
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {d.orgao || "Não informado"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Modalidade
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {d.modalidade || "Não informado"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Valor estimado
                  </p>

                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {brl(d.valor_estimado)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Requisitos identificados
                  </p>

                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {totalRequisitos}
                  </p>
                </div>
              </div>
            </section>

            {/* DATAS */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 border-b border-slate-100 pb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Prazos
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Datas importantes
                </h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">
                    Abertura das propostas
                  </p>

                  <p className="mt-2 font-semibold text-slate-900">
                    {formatDate(d.datas?.abertura_propostas)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">
                    Impugnação
                  </p>

                  <p className="mt-2 font-semibold text-slate-900">
                    {formatDate(d.datas?.impugnacao)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">
                    Sessão
                  </p>

                  <p className="mt-2 font-semibold text-slate-900">
                    {formatDate(d.datas?.sessao)}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">
                    Vigência
                  </p>

                  <p className="mt-2 font-semibold text-slate-900">
                    {formatDate(d.datas?.vigencia)}
                  </p>
                </div>
              </div>
            </section>

            {/* HABILITAÇÃO */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 border-b border-slate-100 pb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Documentação
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Requisitos de habilitação
                </h2>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {(
                  [
                    [
                      "Jurídica",
                      d.habilitacao?.juridica,
                    ],
                    [
                      "Fiscal",
                      d.habilitacao?.fiscal,
                    ],
                    [
                      "Técnica",
                      d.habilitacao?.tecnica,
                    ],
                    [
                      "Econômica",
                      d.habilitacao?.economica,
                    ],
                  ] as const
                ).map(([label, list]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <h3 className="font-semibold text-slate-900">
                      Habilitação {label}
                    </h3>

                    {list?.length ? (
                      <ul className="mt-3 space-y-2">
                        {list.map((item, index) => (
                          <li
                            key={`${label}-${index}`}
                            className="flex gap-2 text-sm leading-6 text-slate-700"
                          >
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />

                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-slate-400">
                        Nenhum requisito informado.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* RISCOS */}
            <section
              className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${
                d.riscos?.length
                  ? "border-amber-200 bg-amber-50/50"
                  : "border-emerald-200 bg-emerald-50/50"
              }`}
            >
              <div className="mb-5 border-b border-slate-200/70 pb-4">
                <p
                  className={`text-xs font-semibold uppercase tracking-wider ${
                    d.riscos?.length
                      ? "text-amber-700"
                      : "text-emerald-700"
                  }`}
                >
                  Análise de atenção
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Pontos de atenção e riscos
                </h2>
              </div>

              {d.riscos?.length ? (
                <div className="space-y-3">
                  {d.riscos.map((risk, index) => (
                    <div
                      key={index}
                      className="flex gap-3 rounded-xl border border-amber-200 bg-white p-4"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
                        !
                      </span>

                      <p className="text-sm leading-6 text-slate-700">
                        {risk}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-white p-4">
                  <p className="text-sm font-medium text-emerald-800">
                    Nenhum ponto de atenção foi identificado na análise.
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Isso não significa que o edital esteja livre de riscos.
                    Recomenda-se conferir o documento original.
                  </p>
                </div>
              )}
            </section>

            {/* SANÇÕES */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 border-b border-slate-100 pb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Obrigações
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Sanções previstas
                </h2>
              </div>

              {d.sancoes?.length ? (
                <ul className="space-y-3">
                  {d.sancoes.map((sancao, index) => (
                    <li
                      key={index}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"
                    >
                      {sancao}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">
                  Nenhuma sanção foi informada na análise.
                </p>
              )}
            </section>

            {/* ITENS */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex flex-col gap-1 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Objeto da contratação
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    Itens identificados
                  </h2>
                </div>

                <span className="text-sm text-slate-500">
                  {d.itens?.length ?? 0}{" "}
                  {(d.itens?.length ?? 0) === 1
                    ? "item"
                    : "itens"}
                </span>
              </div>

              {d.itens?.length ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">
                          Descrição
                        </th>

                        <th className="px-4 py-3 font-semibold">
                          Quantidade
                        </th>

                        <th className="px-4 py-3 font-semibold">
                          Unidade
                        </th>

                        <th className="px-4 py-3 text-right font-semibold">
                          Valor unitário
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {d.itens.map((item, index) => (
                        <tr
                          key={index}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-4 py-4 font-medium text-slate-800">
                            {item.descricao || "Não informado"}
                          </td>

                          <td className="px-4 py-4 text-slate-600">
                            {item.quantidade ?? "—"}
                          </td>

                          <td className="px-4 py-4 text-slate-600">
                            {item.unidade ?? "—"}
                          </td>

                          <td className="px-4 py-4 text-right font-medium text-slate-800">
                            {brl(item.valor_unitario_estimado)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
                  <p className="text-sm text-slate-500">
                    Nenhum item foi extraído do edital.
                  </p>
                </div>
              )}
            </section>

            {/* GO / NO-GO */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 border-b border-slate-100 pb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Tomada de decisão
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Participar ou não participar
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Revise os requisitos antes de registrar sua decisão.
                </p>
              </div>

              <GoNoGo
                bidId={bid.id}
                habilitacao={d.habilitacao}
                initialChecklist={bid.checklist}
                initialDecision={bid.decision}
              />
            </section>
          </div>
        )}
      </main>
    </>
  );
}