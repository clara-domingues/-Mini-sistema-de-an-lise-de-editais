"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export type CheckItem = { categoria: string; texto: string; ok: boolean };
type Hab = { juridica: string[]; fiscal: string[]; tecnica: string[]; economica: string[] };
type Decision = "go" | "no_go" | null;

const labels: Record<keyof Hab, string> = {
  juridica: "Habilitação jurídica",
  fiscal: "Regularidade fiscal e trabalhista",
  tecnica: "Qualificação técnica",
  economica: "Qualificação econômico-financeira",
};

function gerar(h: Hab): CheckItem[] {
  return (Object.keys(labels) as (keyof Hab)[]).flatMap((k) =>
    (h[k] ?? []).map((texto) => ({ categoria: labels[k], texto, ok: false }))
  );
}

export default function GoNoGo({
  bidId,
  habilitacao,
  initialChecklist,
  initialDecision,
}: {
  bidId: string;
  habilitacao: Hab;
  initialChecklist: CheckItem[] | null;
  initialDecision: Decision;
}) {
  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<CheckItem[]>(() =>
    initialChecklist && initialChecklist.length ? initialChecklist : gerar(habilitacao)
  );
  const [decision, setDecision] = useState<Decision>(initialDecision);
  const [err, setErr] = useState<string | null>(null);

  async function toggle(i: number) {
    const next = items.map((it, k) => (k === i ? { ...it, ok: !it.ok } : it));
    setItems(next);
    const { error } = await supabase.from("bids").update({ checklist: next }).eq("id", bidId);
    setErr(error ? error.message : null);
  }

  async function decidir(d: "go" | "no_go") {
    setDecision(d);
    const { error } = await supabase.from("bids").update({ decision: d }).eq("id", bidId);
    setErr(error ? error.message : null);
  }

  const pendentes = items.filter((i) => !i.ok).length;
  const categorias = Array.from(new Set(items.map((i) => i.categoria)));

  return (
    <section className="bg-white rounded-xl shadow p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-slate-800">Análise Go / No-Go</h2>
        <p className="text-sm text-slate-500">
          Marque o que a sua empresa já possui ou atende.
        </p>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-slate-500">
          Nenhuma exigência de habilitação foi extraída. Confira o edital manualmente.
        </p>
      )}

      {categorias.map((cat) => (
        <div key={cat} className="space-y-1">
          <p className="text-xs uppercase font-semibold text-slate-500">{cat}</p>
          {items.map(
            (it, i) =>
              it.categoria === cat && (
                <label key={i} className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={it.ok}
                    onChange={() => toggle(i)}
                    className="mt-1"
                  />
                  <span className={it.ok ? "line-through text-slate-400" : "text-slate-900"}>
                    {it.texto}
                  </span>
                </label>
              )
          )}
        </div>
      ))}

      {items.length > 0 && pendentes > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-sm">
          Atenção: {pendentes} exigência(s) ainda não atendida(s). Há risco de inabilitação.
        </div>
      )}

      {items.length > 0 && pendentes === 0 && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm">
          Todas as exigências de habilitação estão atendidas.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          onClick={() => decidir("go")}
          className={`rounded-lg px-5 py-2 font-medium border transition-colors ${
            decision === "go"
              ? "bg-green-600 text-white border-green-600"
              : "bg-white text-green-700 border-green-600 hover:bg-green-50"
          }`}
        >
          GO: participar
        </button>
        <button
          onClick={() => decidir("no_go")}
          className={`rounded-lg px-5 py-2 font-medium border transition-colors ${
            decision === "no_go"
              ? "bg-red-600 text-white border-red-600"
              : "bg-white text-red-700 border-red-600 hover:bg-red-50"
          }`}
        >
          NO-GO: não participar
        </button>

        {decision === "go" && (
          <Link
            href={`/editais/${bidId}/proposta`}
            className="ml-auto bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-2 font-medium transition-colors"
          >
            Montar proposta →
          </Link>
        )}
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </section>
  );
}