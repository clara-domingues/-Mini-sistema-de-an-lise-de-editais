"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";

type BidDetail = {
  id: string;
  title: string;
  status: string;
  estimated_value: number;
  deadline: string;
  pdf_url?: string;
  client_id?: string;
};

type Requirement = {
  id: string;
  label: string;
  category: "JURIDICA" | "FISCAL" | "TECNICA" | "FINANCEIRA";
  checked: boolean;
};

const DEFAULT_REQUIREMENTS: Requirement[] = [
  { id: "1", label: "Contrato social atualizado", category: "JURIDICA", checked: true },
  { id: "2", label: "Documento do representante legal", category: "JURIDICA", checked: false },
  { id: "3", label: "Certidão negativa federal", category: "FISCAL", checked: true },
  { id: "4", label: "CRF do FGTS", category: "FISCAL", checked: false },
  { id: "5", label: "Certidão negativa trabalhista", category: "FISCAL", checked: false },
  { id: "6", label: "Atestado de capacidade técnica em projetos ágeis", category: "TECNICA", checked: true },
  { id: "7", label: "Balanço patrimonial do último exercício", category: "FINANCEIRA", checked: false },
];

export default function EditalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [bid, setBid] = useState<BidDetail | null>(null);
  const [clientName, setClientName] = useState<string>("Órgão não informado");
  const [loading, setLoading] = useState(true);

  const [requirements, setRequirements] = useState<Requirement[]>(DEFAULT_REQUIREMENTS);
  const [decision, setDecision] = useState<"GO" | "NO-GO" | null>(null);

  useEffect(() => {
    async function fetchBid() {
      if (!params?.id) return;
      setLoading(true);

      try {
        const { data: bidData, error: bidError } = await supabase
          .from("bids")
          .select("*")
          .eq("id", params.id)
          .single();

        if (bidError || !bidData) {
          console.error("Erro ao carregar edital:", bidError);
          setLoading(false);
          return;
        }

        setBid(bidData as BidDetail);

        if (bidData.client_id) {
          const { data: clientData } = await supabase
            .from("clients")
            .select("name")
            .eq("id", bidData.client_id)
            .single();

          if (clientData?.name) {
            setClientName(clientData.name);
          }
        }
      } catch (err) {
        console.error("Erro inesperado:", err);
      } finally {
        setLoading(false);
      }
    }

    void fetchBid();
  }, [params?.id, supabase]);

  const toggleRequirement = (id: string) => {
    setRequirements((prev) =>
      prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r))
    );
  };

  const uncheckedCount = requirements.filter((r) => !r.checked).length;

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-100">
        <Nav />
        <main className="flex-1 p-8 text-slate-500 font-medium">Carregando detalhes do edital...</main>
      </div>
    );
  }

  if (!bid) {
    return (
      <div className="flex min-h-screen bg-slate-100">
        <Nav />
        <main className="flex-1 p-8">
          <p className="text-red-600 font-semibold">Edital não encontrado.</p>
          <Link href="/editais" className="mt-4 inline-block text-blue-600 hover:underline">
            ← Voltar para editais
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-100">
      <Nav />
      <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 lg:px-12 text-slate-900 space-y-6 max-w-5xl mx-auto">
        <div>
          <Link href="/editais" className="text-sm font-semibold text-blue-600 hover:underline">
            ← Voltar para editais
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 uppercase">
              {bid.status}
            </span>
            <span className="text-sm font-medium text-slate-600">{clientName}</span>
          </div>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold text-slate-950">{bid.title}</h1>
        </div>

        {/* Informações Principais */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-3">
            Informações Principais
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-xs text-slate-500 font-medium">Valor Estimado</p>
              <p className="text-lg font-bold text-slate-900 mt-1">{formatBRL(bid.estimated_value)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Data Limite / Prazo</p>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {bid.deadline ? new Date(bid.deadline).toLocaleDateString("pt-BR") : "Sem prazo"}
              </p>
            </div>
          </div>
        </div>

        {/* Pontos de Atenção (Riscos) */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">
            Pontos de atenção (riscos)
          </h3>
          <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
            <li>Prazo de entrega rigoroso</li>
          </ul>
        </div>

        {/* Tabela de Itens */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
          <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100">
            Itens
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
                  <th className="py-2">Descrição</th>
                  <th className="py-2 text-center">Qtd</th>
                  <th className="py-2 text-center">Un</th>
                  <th className="py-2 text-right">Vl. unit. est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3 font-medium text-slate-900">{bid.title}</td>
                  <td className="py-3 text-center">1</td>
                  <td className="py-3 text-center">serviço</td>
                  <td className="py-3 text-right font-semibold">{formatBRL(bid.estimated_value || 50000)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Análise Go / No-Go */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Análise Go / No-Go</h3>
            <p className="text-xs text-slate-500 mt-0.5">Marque o que a sua empresa já possui ou atende.</p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">HABILITAÇÃO JURÍDICA</h4>
            <div className="space-y-2">
              {requirements.filter(r => r.category === "JURIDICA").map(req => (
                <label key={req.id} className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={req.checked}
                    onChange={() => toggleRequirement(req.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={req.checked ? "text-slate-400 line-through" : "text-slate-800 font-medium"}>
                    {req.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">REGULARIDADE FISCAL E TRABALHISTA</h4>
            <div className="space-y-2">
              {requirements.filter(r => r.category === "FISCAL").map(req => (
                <label key={req.id} className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={req.checked}
                    onChange={() => toggleRequirement(req.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={req.checked ? "text-slate-400 line-through" : "text-slate-800 font-medium"}>
                    {req.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">QUALIFICAÇÃO TÉCNICA</h4>
            <div className="space-y-2">
              {requirements.filter(r => r.category === "TECNICA").map(req => (
                <label key={req.id} className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={req.checked}
                    onChange={() => toggleRequirement(req.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={req.checked ? "text-slate-400 line-through" : "text-slate-800 font-medium"}>
                    {req.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">QUALIFICAÇÃO ECONÔMICO-FINANCEIRA</h4>
            <div className="space-y-2">
              {requirements.filter(r => r.category === "FINANCEIRA").map(req => (
                <label key={req.id} className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={req.checked}
                    onChange={() => toggleRequirement(req.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={req.checked ? "text-slate-400 line-through" : "text-slate-800 font-medium"}>
                    {req.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {uncheckedCount > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs font-semibold text-amber-900">
              Atenção: {uncheckedCount} exigência(s) ainda não atendida(s). Há risco de inabilitação.
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDecision("GO")}
                className={`rounded-xl px-5 py-2.5 text-sm font-bold transition shadow-sm ${
                  decision === "GO"
                    ? "bg-green-600 text-white ring-2 ring-green-400"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                {decision === "GO" ? "✓ GO Selecionado" : "GO: participar"}
              </button>
              <button
                type="button"
                onClick={() => setDecision("NO-GO")}
                className={`rounded-xl border px-5 py-2.5 text-sm font-bold transition ${
                  decision === "NO-GO"
                    ? "bg-red-600 text-white border-red-600 shadow-sm"
                    : "border-red-500 text-red-600 hover:bg-red-50"
                }`}
              >
                {decision === "NO-GO" ? "✕ NO-GO Selecionado" : "NO-GO: não participar"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => router.push(`/editais/${bid.id}/proposta`)}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              Montar proposta →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}