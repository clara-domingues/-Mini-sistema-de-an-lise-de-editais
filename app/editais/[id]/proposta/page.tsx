"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";
import { baixarDocx } from "@/lib/exportDocx";

export const dynamic = "force-dynamic";

type Item = {
  descricao: string;
  quantidade: number | null;
  unidade: string | null;
  valor_unitario_estimado: number | null;
};

type Extracted = {
  objeto: string;
  orgao: string;
  modalidade: string;
  datas: {
    vigencia: string | null;
  };
  itens: Item[];
};

type Bid = {
  id: string;
  title: string | null;
  extracted_data: Extracted | null;
};

type Profile = {
  razao_social: string | null;
  cnpj: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  responsavel_nome: string | null;
  responsavel_cpf: string | null;
  responsavel_cargo: string | null;
};

type Message = {
  type: "ok" | "err";
  text: string;
};

const brl = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const limpa = (value: string) =>
  value.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Não foi possível concluir a operação.";
}

export default function PropostaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [supabase] = useState(() => createClient());

  const [bid, setBid] = useState<Bid | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [prices, setPrices] = useState<Record<string, string>>({});
  const [content, setContent] = useState("");

  const [loaded, setLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [msg, setMsg] = useState<Message | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    let cancelled = false;

    async function carregar() {
      setLoaded(false);
      setLoadingError(null);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error("Usuário não autenticado.");
        }

        const [bidResult, profileResult, proposalResult] =
          await Promise.all([
            supabase
              .from("bids")
              .select("id,title,extracted_data")
              .eq("id", id)
              .maybeSingle(),

            supabase
              .from("profiles")
              .select("*")
              .eq("id", user.id)
              .maybeSingle(),

            supabase
              .from("proposals")
              .select("*")
              .eq("bid_id", id)
              .maybeSingle(),
          ]);

        if (cancelled) {
          return;
        }

        if (bidResult.error) {
          throw bidResult.error;
        }

        if (profileResult.error) {
          throw profileResult.error;
        }

        if (proposalResult.error) {
          throw proposalResult.error;
        }

        setBid(bidResult.data as Bid | null);
        setProfile(profileResult.data as Profile | null);

        if (proposalResult.data) {
          setContent(proposalResult.data.content_markdown ?? "");

          setPrices(
            (proposalResult.data.prices as Record<string, string>) ?? {}
          );
        }
      } catch (error) {
        if (!cancelled) {
          setLoadingError(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    void carregar();

    return () => {
      cancelled = true;
    };
  }, [id, supabase]);

  const extracted = bid?.extracted_data;

  const itens = extracted?.itens ?? [];

  const total = useMemo(() => {
    return itens.reduce((sum, item, index) => {
      const unitPrice = Number(prices[index]) || 0;
      const quantity = item.quantidade ?? 1;

      return sum + unitPrice * quantity;
    }, 0);
  }, [itens, prices]);

  const itensPreenchidos = useMemo(() => {
    return itens.filter((_, index) => {
      return Number(prices[index]) > 0;
    }).length;
  }, [itens, prices]);

  const itensPendentes = itens.length - itensPreenchidos;

  const percentualPreenchido = useMemo(() => {
    if (itens.length === 0) {
      return 0;
    }

    return Math.round((itensPreenchidos / itens.length) * 100);
  }, [itens.length, itensPreenchidos]);

  const podeGerar = itens.length === 0 || itensPendentes === 0;

  function atualizarPreco(index: number, value: string) {
    setPrices((previous) => ({
      ...previous,
      [index]: value,
    }));

    setMsg(null);
  }

  function gerar() {
    if (!extracted) {
      return;
    }

    if (!podeGerar) {
      setMsg({
        type: "err",
        text: `Preencha o valor unitário de ${itensPendentes} item(ns) antes de gerar a proposta.`,
      });

      return;
    }

    if (
      content &&
      !window.confirm(
        "Isso vai substituir o texto atual da proposta. Deseja continuar?"
      )
    ) {
      return;
    }

    setGenerating(true);
    setMsg(null);

    const p = profile;

    const hoje = new Date().toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const linhas = itens.map((item, index) => {
      const unitPrice = Number(prices[index]) || 0;
      const quantity = item.quantidade ?? 1;

      return `| ${index + 1} | ${limpa(
        item.descricao
      )} | ${item.unidade ?? "un"} | ${quantity} | ${brl(
        unitPrice
      )} | ${brl(unitPrice * quantity)} |`;
    });

    const markdown = `# PROPOSTA COMERCIAL

**Ao:** ${extracted.orgao ?? "Órgão Licitante"}  
**Ref.:** ${extracted.modalidade ?? "Processo Licitatório"}

## 1. Identificação do proponente

**Razão Social:** ${p?.razao_social ?? "Não informado"}  
**CNPJ:** ${p?.cnpj ?? "Não informado"}  
**Representante legal:** ${
      p?.responsavel_nome ?? "Não informado"
    }, ${p?.responsavel_cargo ?? "Representante Legal"}, CPF ${
      p?.responsavel_cpf ?? "Não informado"
    }

## 2. Objeto

${extracted.objeto ?? "Objeto conforme edital."}

## 3. Preços

| Item | Descrição | Un. | Qtd. | Valor unitário | Valor total |
|---|---|---|---:|---:|---:|
${linhas.join("\n")}

**Valor global da proposta: ${brl(total)}**

## 4. Condições gerais

- Validade da proposta: 60 (sessenta) dias contados da data de abertura da sessão.
- Prazo de vigência: ${
      extracted.datas?.vigencia ?? "conforme edital"
    }.
- Declaramos que os preços acima incluem todos os custos, tributos, fretes e demais despesas necessárias ao cumprimento do objeto.
- Declaramos que conhecemos e concordamos com todas as condições do edital.

## 5. Dados bancários

**Banco:** ${p?.banco ?? "Não informado"}  
**Agência:** ${p?.agencia ?? "Não informado"}  
**Conta:** ${p?.conta ?? "Não informado"}

Data: ${hoje}

**${p?.responsavel_nome ?? "Representante Legal"}**  
${p?.responsavel_cargo ?? ""}  
${p?.razao_social ?? ""}`;

    setContent(markdown);
    setGenerating(false);

    setMsg({
      type: "ok",
      text: "Texto da proposta gerado. Revise antes de salvar ou exportar.",
    });
  }

  async function salvar() {
    if (!content) {
      setMsg({
        type: "err",
        text: "Gere ou preencha o texto da proposta antes de salvar.",
      });

      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const { error } = await supabase.from("proposals").upsert(
        {
          bid_id: id,
          prices,
          content_markdown: content,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "bid_id",
        }
      );

      if (error) {
        throw error;
      }

      setMsg({
        type: "ok",
        text: "Proposta salva com sucesso.",
      });
    } catch (error) {
      setMsg({
        type: "err",
        text: `Não foi possível salvar a proposta: ${getErrorMessage(
          error
        )}`,
      });
    } finally {
      setSaving(false);
    }
  }

  function imprimir() {
    if (!content) {
      return;
    }

    window.print();
  }

  function exportarDocx() {
    if (!content) {
      return;
    }

    baixarDocx(content, `proposta-${id.slice(0, 8)}`);
  }

  return (
    <>
      <div className="print:hidden">
        <Nav />
      </div>

      <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <Link
            href={`/editais/${id}`}
            className="inline-flex w-fit items-center text-sm font-medium text-blue-600 transition hover:text-blue-700"
          >
            ← Voltar ao edital
          </Link>

          {content && (
            <span className="text-xs text-slate-500">
              Proposta preparada para revisão
            </span>
          )}
        </div>

        <header className="print:hidden">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
            Preparação da proposta
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Proposta comercial
          </h1>

          {bid?.title && (
            <p className="mt-2 text-sm text-slate-500">
              Edital:{" "}
              <span className="font-medium text-slate-700">
                {bid.title}
              </span>
            </p>
          )}
        </header>

        {!loaded && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 print:hidden">
            Carregando dados da proposta...
          </div>
        )}

        {loaded && loadingError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 print:hidden"
          >
            <strong>Não foi possível carregar a proposta.</strong>
            <p className="mt-1">{loadingError}</p>
          </div>
        )}

        {loaded && !loadingError && !extracted && (
          <div
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 print:hidden"
          >
            <strong>Edital não analisado ou não encontrado.</strong>

            <p className="mt-1 leading-6">
              Não foram encontrados dados estruturados suficientes para
              montar a proposta.
            </p>
          </div>
        )}

        {loaded && !loadingError && extracted && (
          <>
            {/* RESUMO DO EDITAL */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Dados do edital
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    {extracted.orgao || "Órgão não informado"}
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {extracted.objeto || "Objeto conforme edital."}
                  </p>
                </div>

                <div className="grid shrink-0 gap-2 sm:grid-cols-2 lg:w-80">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">
                      Modalidade
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {extracted.modalidade || "Não informada"}
                    </p>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">
                      Itens
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {itens.length}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* PERFIL */}
            {!profile?.razao_social && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 print:hidden">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-amber-900">
                      Perfil da empresa incompleto
                    </p>

                    <p className="mt-1 leading-6">
                      Preencha os dados da empresa para que eles sejam
                      inseridos automaticamente na proposta.
                    </p>
                  </div>

                  <Link
                    href="/perfil"
                    className="inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
                  >
                    Preencher perfil
                  </Link>
                </div>
              </div>
            )}

            {/* PREÇOS */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Etapa 1
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    Informe seus preços
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Informe o valor unitário que sua empresa pretende
                    ofertar para cada item.
                  </p>
                </div>

                {itens.length > 0 && (
                  <div className="shrink-0 rounded-lg bg-slate-50 px-4 py-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Preenchimento
                    </p>

                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {itensPreenchidos}/{itens.length}
                    </p>
                  </div>
                )}
              </div>

              {itens.length === 0 && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Nenhum item foi extraído do edital. Confira os dados
                  manualmente antes de elaborar a proposta.
                </div>
              )}

              {itens.length > 0 && (
                <>
                  <div className="mt-5 space-y-3">
                    {itens.map((item, index) => {
                      const valor = Number(prices[index]) || 0;
                      const quantidade = item.quantidade ?? 1;
                      const totalItem = valor * quantidade;

                      return (
                        <div
                          key={index}
                          className="rounded-xl border border-slate-200 p-4 transition hover:border-slate-300"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex items-start gap-3">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                                  {index + 1}
                                </span>

                                <div>
                                  <p className="font-medium leading-6 text-slate-900">
                                    {item.descricao}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    Quantidade: {quantidade}{" "}
                                    {item.unidade ?? "un"}

                                    {item.valor_unitario_estimado !=
                                      null && (
                                      <>
                                        {" · "}
                                        Estimado:{" "}
                                        {brl(
                                          item.valor_unitario_estimado
                                        )}
                                      </>
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1 sm:flex-row sm:items-end">
                              <div>
                                <label
                                  htmlFor={`preco-${index}`}
                                  className="mb-1 block text-xs font-semibold text-slate-600"
                                >
                                  Valor unitário
                                </label>

                                <div className="relative">
                                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                                    R$
                                  </span>

                                  <input
                                    id={`preco-${index}`}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0,00"
                                    value={prices[index] ?? ""}
                                    onChange={(event) =>
                                      atualizarPreco(
                                        index,
                                        event.target.value
                                      )
                                    }
                                    className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-right text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-40"
                                  />
                                </div>
                              </div>

                              <div className="rounded-lg bg-slate-50 px-3 py-2 sm:min-w-32">
                                <p className="text-xs text-slate-500">
                                  Total do item
                                </p>

                                <p className="mt-0.5 text-sm font-bold text-slate-900">
                                  {brl(totalItem)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 rounded-xl bg-slate-900 p-4 text-white">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                          Valor global
                        </p>

                        <p className="mt-1 text-2xl font-bold">
                          {brl(total)}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-xs text-slate-300">
                          {percentualPreenchido}% dos itens preenchidos
                        </p>

                        {itensPendentes > 0 && (
                          <p className="mt-1 text-xs font-medium text-amber-300">
                            {itensPendentes} item(ns) pendente(s)
                          </p>
                        )}

                        {itensPendentes === 0 && (
                          <p className="mt-1 text-xs font-medium text-emerald-300">
                            Todos os itens preenchidos
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-slate-500">
                  Os valores informados serão utilizados na tabela da
                  proposta comercial.
                </p>

                <button
                  type="button"
                  onClick={gerar}
                  disabled={generating || !podeGerar}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generating
                    ? "Gerando..."
                    : itensPendentes > 0
                      ? "Preencha os itens para gerar"
                      : "Gerar texto da proposta"}
                </button>
              </div>
            </section>

            {/* EDITOR */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Etapa 2
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Revise o texto da proposta
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  O texto abaixo pode ser editado antes de salvar ou
                  exportar o documento.
                </p>
              </div>

              <textarea
                value={content}
                onChange={(event) => {
                  setContent(event.target.value);
                  setMsg(null);
                }}
                rows={18}
                placeholder="Clique em “Gerar texto da proposta” para começar."
                className="mt-4 w-full resize-y rounded-xl border border-slate-300 bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void salvar()}
                  disabled={saving || !content}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar proposta"}
                </button>

                <button
                  type="button"
                  onClick={imprimir}
                  disabled={!content}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Baixar PDF
                </button>

                <button
                  type="button"
                  onClick={exportarDocx}
                  disabled={!content}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Baixar DOCX
                </button>
              </div>

              {msg && (
                <div
                  role={msg.type === "err" ? "alert" : "status"}
                  className={`mt-4 rounded-lg border p-3 text-sm ${
                    msg.type === "ok"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {msg.type === "ok" ? "✓ " : "⚠ "}
                  {msg.text}
                </div>
              )}
            </section>

            {/* PRÉVIA */}
            {content && (
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 print:border-0 print:p-0 print:shadow-none">
                <div className="mb-6 border-b border-slate-200 pb-4 print:hidden">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Etapa 3
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    Prévia da proposta
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Confira a aparência do documento antes de exportar.
                  </p>
                </div>

                <div className="proposta">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                  </ReactMarkdown>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}