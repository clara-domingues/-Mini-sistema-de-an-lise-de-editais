"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export type CheckItem = {
  categoria: string;
  texto: string;
  ok: boolean;
};

type Hab = {
  juridica: string[];
  fiscal: string[];
  tecnica: string[];
  economica: string[];
};

type Decision = "go" | "no_go" | null;

type Props = {
  bidId: string;
  habilitacao: Hab;
  initialChecklist: CheckItem[] | null;
  initialDecision: Decision;
};

const labels: Record<keyof Hab, string> = {
  juridica: "Habilitação jurídica",
  fiscal: "Regularidade fiscal e trabalhista",
  tecnica: "Qualificação técnica",
  economica: "Qualificação econômico-financeira",
};

function gerar(h: Hab): CheckItem[] {
  return (Object.keys(labels) as (keyof Hab)[]).flatMap((k) =>
    (h[k] ?? []).map((texto) => ({
      categoria: labels[k],
      texto,
      ok: false,
    }))
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Não foi possível salvar a alteração.";
}

export default function GoNoGo({
  bidId,
  habilitacao,
  initialChecklist,
  initialDecision,
}: Props) {
  const [supabase] = useState(() => createClient());

  const [items, setItems] = useState<CheckItem[]>(() =>
    initialChecklist && initialChecklist.length
      ? initialChecklist
      : gerar(habilitacao)
  );

  const [decision, setDecision] = useState<Decision>(initialDecision);

  const [err, setErr] = useState<string | null>(null);

  const [savingItem, setSavingItem] = useState<number | null>(null);

  const [savingDecision, setSavingDecision] = useState<Decision>(null);

  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const total = items.length;

  const atendidos = useMemo(
    () => items.filter((item) => item.ok).length,
    [items]
  );

  const pendentes = total - atendidos;

  const percentual = useMemo(() => {
    if (total === 0) {
      return 0;
    }

    return Math.round((atendidos / total) * 100);
  }, [atendidos, total]);

  const categorias = useMemo(
    () =>
      Array.from(
        new Set(items.map((item) => item.categoria))
      ),
    [items]
  );

  const resumoCategorias = useMemo(() => {
    return categorias.map((categoria) => {
      const categoriaItems = items.filter(
        (item) => item.categoria === categoria
      );

      const atendidosCategoria = categoriaItems.filter(
        (item) => item.ok
      ).length;

      return {
        categoria,
        total: categoriaItems.length,
        atendidos: atendidosCategoria,
        pendentes: categoriaItems.length - atendidosCategoria,
      };
    });
  }, [categorias, items]);

  async function toggle(index: number) {
    if (savingItem !== null || savingDecision !== null) {
      return;
    }

    const previousItems = items;

    const next = items.map((item, itemIndex) =>
      itemIndex === index
        ? {
            ...item,
            ok: !item.ok,
          }
        : item
    );

    setItems(next);
    setSavingItem(index);
    setErr(null);
    setSavedMessage(null);

    const { error } = await supabase
      .from("bids")
      .update({
        checklist: next,
      })
      .eq("id", bidId);

    if (error) {
      setItems(previousItems);
      setErr(
        `Não foi possível salvar esta alteração: ${getErrorMessage(
          error
        )}`
      );
    } else {
      setSavedMessage("Checklist atualizado.");
    }

    setSavingItem(null);
  }

  async function decidir(nextDecision: "go" | "no_go") {
    if (savingItem !== null || savingDecision !== null) {
      return;
    }

    const previousDecision = decision;

    setDecision(nextDecision);
    setSavingDecision(nextDecision);
    setErr(null);
    setSavedMessage(null);

    const { error } = await supabase
      .from("bids")
      .update({
        decision: nextDecision,
      })
      .eq("id", bidId);

    if (error) {
      setDecision(previousDecision);

      setErr(
        `Não foi possível salvar sua decisão: ${getErrorMessage(
          error
        )}`
      );
    } else {
      setSavedMessage(
        nextDecision === "go"
          ? "Decisão GO salva com sucesso."
          : "Decisão NO-GO salva com sucesso."
      );
    }

    setSavingDecision(null);
  }

  return (
    <section className="space-y-5">
      {/* CABEÇALHO */}
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Decisão de participação
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Análise Go / No-Go
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Marque as exigências que sua empresa já possui ou
              atende. Use esse checklist como apoio à decisão e
              confirme os documentos no edital original.
            </p>
          </div>

          {total > 0 && (
            <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Aderência
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {percentual}%
              </p>
            </div>
          )}
        </div>
      </div>

      {/* RESUMO */}
      {total > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total
            </p>

            <p className="mt-1 text-2xl font-bold text-slate-900">
              {total}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              exigência(s)
            </p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Atendidas
            </p>

            <p className="mt-1 text-2xl font-bold text-emerald-800">
              {atendidos}
            </p>

            <p className="mt-1 text-xs text-emerald-700">
              requisito(s) confirmado(s)
            </p>
          </div>

          <div
            className={`rounded-xl border p-4 ${
              pendentes > 0
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <p
              className={`text-xs font-semibold uppercase tracking-wider ${
                pendentes > 0
                  ? "text-amber-700"
                  : "text-emerald-700"
              }`}
            >
              Pendentes
            </p>

            <p
              className={`mt-1 text-2xl font-bold ${
                pendentes > 0
                  ? "text-amber-800"
                  : "text-emerald-800"
              }`}
            >
              {pendentes}
            </p>

            <p
              className={`mt-1 text-xs ${
                pendentes > 0
                  ? "text-amber-700"
                  : "text-emerald-700"
              }`}
            >
              requisito(s) a verificar
            </p>
          </div>
        </div>
      )}

      {/* BARRA DE PROGRESSO */}
      {total > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-700">
              Progresso da conferência
            </span>

            <span className="text-sm font-bold text-slate-900">
              {atendidos}/{total}
            </span>
          </div>

          <div
            className="h-3 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={percentual}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Percentual de requisitos atendidos"
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percentual === 100
                  ? "bg-emerald-500"
                  : percentual >= 70
                    ? "bg-blue-500"
                    : "bg-amber-500"
              }`}
              style={{
                width: `${percentual}%`,
              }}
            />
          </div>

          <p className="mt-2 text-xs text-slate-500">
            {percentual === 100
              ? "Todas as exigências marcadas como atendidas."
              : `${pendentes} exigência(s) ainda precisam ser verificadas.`}
          </p>
        </div>
      )}

      {/* RESUMO POR CATEGORIA */}
      {resumoCategorias.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Resumo por categoria
          </h3>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {resumoCategorias.map((categoria) => (
              <div
                key={categoria.categoria}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {categoria.categoria}
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500">
                    {categoria.atendidos} de {categoria.total} atendidos
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    categoria.pendentes === 0
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {categoria.pendentes === 0
                    ? "OK"
                    : `${categoria.pendentes} pend.`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEM REQUISITOS */}
      {items.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">
              !
            </span>

            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                Nenhuma exigência de habilitação foi extraída
              </h3>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                A análise automática não encontrou requisitos
                estruturados de habilitação. Confira o edital
                manualmente antes de decidir pela participação.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CHECKLIST */}
      {categorias.map((categoria) => {
        const categoryItems = items
          .map((item, index) => ({
            item,
            index,
          }))
          .filter(({ item }) => item.categoria === categoria);

        const categoryCompleted = categoryItems.filter(
          ({ item }) => item.ok
        ).length;

        return (
          <div
            key={categoria}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {categoria}
                </h3>

                <p className="mt-0.5 text-xs text-slate-500">
                  {categoryCompleted} de {categoryItems.length} atendidos
                </p>
              </div>

              <span
                className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                  categoryCompleted === categoryItems.length
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {categoryCompleted === categoryItems.length
                  ? "Conferido"
                  : "Pendente"}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {categoryItems.map(({ item, index }) => {
                const isSaving = savingItem === index;

                return (
                  <label
                    key={`${categoria}-${index}`}
                    className={`flex cursor-pointer items-start gap-3 px-4 py-4 transition ${
                      isSaving
                        ? "bg-blue-50/50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={item.ok}
                      onChange={() => void toggle(index)}
                      disabled={
                        savingItem !== null ||
                        savingDecision !== null
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />

                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-sm leading-6 ${
                          item.ok
                            ? "text-slate-400 line-through"
                            : "text-slate-800"
                        }`}
                      >
                        {item.texto}
                      </span>

                      {isSaving && (
                        <span className="mt-1 block text-xs font-medium text-blue-600">
                          Salvando...
                        </span>
                      )}
                    </span>

                    {item.ok && (
                      <span
                        className="shrink-0 text-sm font-bold text-emerald-600"
                        aria-label="Requisito atendido"
                      >
                        ✓
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ALERTA DE PENDÊNCIAS */}
      {items.length > 0 && pendentes > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">
              !
            </span>

            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                Existem requisitos pendentes
              </h3>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                {pendentes} exigência(s) ainda não foram marcadas
                como atendidas. Isso pode representar risco de
                inabilitação e deve ser verificado antes da decisão
                final.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TUDO ATENDIDO */}
      {items.length > 0 && pendentes === 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
              ✓
            </span>

            <div>
              <h3 className="text-sm font-semibold text-emerald-900">
                Todas as exigências foram marcadas como atendidas
              </h3>

              <p className="mt-1 text-sm leading-6 text-emerald-800">
                A checklist está completa. Ainda assim, confirme os
                documentos e condições diretamente no edital antes de
                finalizar sua decisão.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DECISÃO */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Decisão final
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Registre aqui a decisão da empresa após revisar os
            requisitos.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void decidir("go")}
            disabled={
              savingItem !== null || savingDecision !== null
            }
            aria-pressed={decision === "go"}
            className={`min-h-12 rounded-xl border px-4 py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
              decision === "go"
                ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                : "border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            {savingDecision === "go"
              ? "Salvando..."
              : "✓ GO — Participar"}
          </button>

          <button
            type="button"
            onClick={() => void decidir("no_go")}
            disabled={
              savingItem !== null || savingDecision !== null
            }
            aria-pressed={decision === "no_go"}
            className={`min-h-12 rounded-xl border px-4 py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
              decision === "no_go"
                ? "border-red-600 bg-red-600 text-white shadow-sm"
                : "border-red-300 bg-white text-red-700 hover:bg-red-50"
            }`}
          >
            {savingDecision === "no_go"
              ? "Salvando..."
              : "✕ NO-GO — Não participar"}
          </button>
        </div>

        {decision === "go" && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-900">
                  Participação registrada como GO
                </p>

                <p className="mt-1 text-xs leading-5 text-blue-800">
                  Você pode seguir para a preparação da proposta.
                </p>
              </div>

              <Link
                href={`/editais/${bidId}/proposta`}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Montar proposta →
              </Link>
            </div>
          </div>
        )}

        {decision === "no_go" && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-900">
              Participação registrada como NO-GO
            </p>

            <p className="mt-1 text-xs leading-5 text-red-800">
              A decisão foi salva para este edital. Você poderá
              alterá-la posteriormente caso necessário.
            </p>
          </div>
        )}
      </div>

      {/* FEEDBACK */}
      {savedMessage && !err && (
        <p
          role="status"
          aria-live="polite"
          className="text-sm font-medium text-emerald-600"
        >
          ✓ {savedMessage}
        </p>
      )}

      {err && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <strong>Não foi possível salvar:</strong> {err}
        </div>
      )}
    </section>
  );
}