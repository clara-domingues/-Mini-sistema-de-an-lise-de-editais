"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";
import GoNoGo from "@/components/GoNoGo";

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
  checklist: { categoria: string; texto: string; ok: boolean }[] | null;
  decision: "go" | "no_go" | null;
};

const brl = (v: number | null) =>
  v == null
    ? "—"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function EditalDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [supabase] = useState(() => createClient());
  const [bid, setBid] = useState<Bid | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!id) return;
    let mounted = true;

    async function carregar() {
      const { data } = await supabase
        .from("bids")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!mounted) return;

      if (!data) setNotFound(true);
      else setBid(data as Bid);
    }

    carregar();

    const interval = setInterval(() => {
      if (bid?.status === "processing" || bid?.status === "uploaded") {
        carregar();
      }
    }, 4000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [id, bid?.status, supabase]);

  async function reanalisar() {
    if (!id) return;
    setRetrying(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/analyze-bid`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ bid_id: id }),
        }
      );

      const { data } = await supabase
        .from("bids")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (data) setBid(data as Bid);
    } finally {
      setRetrying(false);
    }
  }

  if (notFound) {
    return (
      <>
        <Nav />
        <main className="max-w-3xl mx-auto p-4">
          <p className="text-red-600">Edital não encontrado.</p>
        </main>
      </>
    );
  }

  if (!bid) {
    return (
      <>
        <Nav />
        <main className="max-w-3xl mx-auto p-4">
          <p className="text-slate-500">Carregando...</p>
        </main>
      </>
    );
  }

  const d = bid.extracted_data;

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        <Link href="/editais" className="text-sm text-blue-600">
          ← Voltar
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">
          {bid.title ?? "Sem título"}
        </h1>

        {bid.status === "processing" && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl p-4 text-sm">
            Analisando edital com IA... Isso pode levar de 30s a 2 minutos.
          </div>
        )}

        {bid.status === "error" && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm space-y-2">
            <p className="font-semibold">Falha na análise.</p>
            <p className="text-xs font-mono">{bid.error_message}</p>
            <button
              onClick={reanalisar}
              disabled={retrying}
              className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium"
            >
              {retrying ? "Enviando..." : "Tentar novamente"}
            </button>
          </div>
        )}

        {d && (
          <>
            <section className="bg-white rounded-xl shadow p-5 space-y-3">
              <h2 className="font-semibold text-slate-800 border-b pb-2">
                Resumo
              </h2>
              <p className="text-sm text-slate-700">
                <strong className="text-slate-900">Objeto:</strong> {d.objeto}
              </p>
              <p className="text-sm text-slate-700">
                <strong className="text-slate-900">Órgão:</strong> {d.orgao}
              </p>
              <p className="text-sm text-slate-700">
                <strong className="text-slate-900">Modalidade:</strong>{" "}
                {d.modalidade}
              </p>
              <p className="text-sm text-slate-700">
                <strong className="text-slate-900">Valor estimado:</strong>{" "}
                {brl(d.valor_estimado)}
              </p>
            </section>

            <section className="bg-white rounded-xl shadow p-5 space-y-2">
              <h2 className="font-semibold text-slate-800 border-b pb-2">
                Datas
              </h2>
              <div className="grid grid-cols-2 gap-2 text-sm text-slate-700">
                <p>
                  <strong>Abertura das propostas:</strong>{" "}
                  {d.datas?.abertura_propostas ?? "—"}
                </p>
                <p>
                  <strong>Impugnação:</strong> {d.datas?.impugnacao ?? "—"}
                </p>
                <p>
                  <strong>Sessão:</strong> {d.datas?.sessao ?? "—"}
                </p>
                <p>
                  <strong>Vigência:</strong> {d.datas?.vigencia ?? "—"}
                </p>
              </div>
            </section>

            <section className="bg-white rounded-xl shadow p-5 space-y-3">
              <h2 className="font-semibold text-slate-800 border-b pb-2">
                Habilitação
              </h2>
              {(
                [
                  ["JURIDICA", d.habilitacao?.juridica],
                  ["FISCAL", d.habilitacao?.fiscal],
                  ["TECNICA", d.habilitacao?.tecnica],
                  ["ECONOMICA", d.habilitacao?.economica],
                ] as const
              ).map(([label, list]) => (
                <div key={label}>
                  <p className="text-xs uppercase font-semibold text-slate-500">
                    {label}
                  </p>
                  {list?.length ? (
                    <ul className="list-disc list-inside text-sm text-slate-700">
                      {list.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400">Não informado</p>
                  )}
                </div>
              ))}
            </section>

            <section className="bg-white rounded-xl shadow p-5 space-y-2">
              <h2 className="font-semibold text-slate-800 border-b pb-2">
                Sanções
              </h2>
              {d.sancoes?.length ? (
                <ul className="list-disc list-inside text-sm text-slate-700">
                  {d.sancoes.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">Não informado</p>
              )}
            </section>

            <section className="bg-white rounded-xl shadow p-5 space-y-2">
              <h2 className="font-semibold text-slate-800 border-b pb-2">
                Pontos de atenção (riscos)
              </h2>
              {d.riscos?.length ? (
                <ul className="list-disc list-inside text-sm text-slate-700">
                  {d.riscos.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">Não informado</p>
              )}
            </section>

            <section className="bg-white rounded-xl shadow p-5 space-y-2">
              <h2 className="font-semibold text-slate-800 border-b pb-2">
                Itens
              </h2>
              {d.itens?.length ? (
                <div className="divide-y text-sm">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 font-semibold text-slate-600 pb-2">
                    <span>Descrição</span>
                    <span>Qtd</span>
                    <span>Un</span>
                    <span>Vl. unit. est.</span>
                  </div>
                  {d.itens.map((it, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_auto_auto_auto] gap-4 py-2 text-slate-700"
                    >
                      <span>{it.descricao}</span>
                      <span>{it.quantidade ?? "—"}</span>
                      <span>{it.unidade ?? "—"}</span>
                      <span>{brl(it.valor_unitario_estimado)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Nenhum item extraído</p>
              )}
            </section>

            <GoNoGo
              bidId={bid.id}
              habilitacao={d.habilitacao}
              initialChecklist={bid.checklist}
              initialDecision={bid.decision}
            />
          </>
        )}
      </main>
    </>
  );
}