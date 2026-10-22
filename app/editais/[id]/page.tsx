"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";
import GoNoGo from "@/components/GoNoGo";

type BidDetail = {
  id: string;
  title: string;
  status: string;
  estimated_value: number;
  deadline: string;
  pdf_url?: string;
  client_id?: string;
};

type DimensionamentoItem = {
  item?: string;
  descricao?: string;
  nome?: string;
  tipo: string;
  unidade: string;
  quantidade: number;
  preco_unitario_estimado: number;
  subtotal: number;
  justificativa?: string;
};

type DimensionamentoData = {
  estrategia: string;
  itens: DimensionamentoItem[];
  valor_total_estimado: number;
};

export default function EditalDetailPage() {
  const params = useParams();
  const supabase = createClient();

  const [bid, setBid] = useState<BidDetail | null>(null);
  const [clientName, setClientName] = useState<string>("Cliente não informado");
  const [loading, setLoading] = useState(true);

  // Estados de Dimensionamento IA
  const [dimensionamento, setDimensionamento] = useState<DimensionamentoData | null>(null);
  const [loadingDim, setLoadingDim] = useState(false);

  const rawId = params?.id;
  const editalId = Array.isArray(rawId) ? rawId[0] : rawId;

  // Buscar ou gerar dimensionamento dinâmico por Edital
  const fetchDimensionamento = useCallback(async (id: string, forceRegenerate = false) => {
    setLoadingDim(true);
    try {
      const res = await fetch("/api/chat-edital/dimensionamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editalId: id, force: forceRegenerate }),
      });
      const data = await res.json();
      if (data.success && data.dimensionamento) {
        setDimensionamento(data.dimensionamento as DimensionamentoData);
      }
    } catch (err) {
      console.error("Erro ao carregar dimensionamento:", err);
    } finally {
      setLoadingDim(false);
    }
  }, []);

  useEffect(() => {
    async function fetchBidData() {
      if (!editalId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data: bidData, error } = await supabase
          .from("bids")
          .select("*")
          .eq("id", editalId)
          .single();

        if (error || !bidData) {
          console.error("Erro ao carregar edital:", error);
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

        await fetchDimensionamento(editalId);

      } catch (err) {
        console.error("Erro inesperado:", err);
      } finally {
        setLoading(false);
      }
    }

    void fetchBidData();
  }, [editalId, supabase, fetchDimensionamento]);

  // CORREÇÃO DO ERRO 1: Exportar Planilha em CSV (Tratamento seguro de strings para evitar null/undefined)
  const handleExportCSV = () => {
    if (!dimensionamento || !dimensionamento.itens || dimensionamento.itens.length === 0) {
      alert("Nenhuma planilha disponível para exportar.");
      return;
    }

    const headers = ["Item / Justificativa", "Tipo", "Unidade", "Quantidade", "Preco Unitario (R$)", "Subtotal (R$)"];
    const rows = dimensionamento.itens.map((i) => {
      const nomeItem = (i.item || i.descricao || i.nome || "Item sem nome").replace(/"/g, '""');
      const tipo = (i.tipo || "-").replace(/"/g, '""');
      const unidade = (i.unidade || "UN").replace(/"/g, '""');
      const qtd = i.quantidade || 0;
      const precoUnit = (i.preco_unitario_estimado || 0).toFixed(2);
      const subtotal = (i.subtotal || 0).toFixed(2);

      return [`"${nomeItem}"`, `"${tipo}"`, `"${unidade}"`, qtd, precoUnit, subtotal];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Dimensionamento_${bid?.title || "Edital"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
            ← Voltar para a lista
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-100 font-sans text-slate-900">
      <Nav />

      <main className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-6 max-w-6xl mx-auto">
        
        {/* Voltar / Header */}
        <div className="flex items-center justify-between">
          <Link href="/editais" className="text-sm font-semibold text-blue-600 hover:underline">
            ← Voltar para editais
          </Link>
          <span className="text-xs font-bold uppercase tracking-wider bg-slate-200 text-slate-700 px-3 py-1 rounded-lg">
            Status: {bid.status.replace("_", " ").toUpperCase()}
          </span>
        </div>

        {/* Informações Principais do Edital */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{clientName}</span>
          <h1 className="text-2xl font-extrabold text-slate-950">{bid.title}</h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-sm">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Valor Estimado</p>
              <p className="text-lg font-bold text-slate-900 mt-1">{formatBRL(bid.estimated_value)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Data Limite / Prazo</p>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {bid.deadline ? new Date(bid.deadline).toLocaleDateString("pt-BR") : "Data a definir"}
              </p>
            </div>
          </div>
        </div>

        {/* Planilha de Dimensionamento */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Planilha de Dimensionamento</h2>
              <p className="text-xs text-slate-500">A IA cruza as exigências do edital com os preços do seu catálogo.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition"
              >
                📥 Exportar Excel / CSV
              </button>
              <button
                type="button"
                onClick={() => editalId && void fetchDimensionamento(editalId, true)}
                disabled={loadingDim}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loadingDim ? "Calculando..." : "Regerar Planilha com IA"}
              </button>
            </div>
          </div>

          {dimensionamento ? (
            <div className="space-y-4">
              {dimensionamento.estrategia && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900">
                  <strong>Estratégia do Dimensionamento:</strong> {dimensionamento.estrategia}
                </div>
              )}

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-800">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-500">
                    <tr>
                      <th className="p-3">Item / Justificativa</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Unid.</th>
                      <th className="p-3">Qtd.</th>
                      <th className="p-3">Preço Unit.</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dimensionamento.itens.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="p-3 font-semibold text-slate-900">
                          {item.item || item.descricao || item.nome || "Item"}
                          {item.justificativa && (
                            <span className="block text-[11px] font-normal text-slate-500 mt-0.5">
                              {item.justificativa}
                            </span>
                          )}
                        </td>
                        <td className="p-3">{item.tipo || "-"}</td>
                        <td className="p-3">{item.unidade || "UN"}</td>
                        <td className="p-3">{item.quantidade || 0}</td>
                        <td className="p-3">{formatBRL(item.preco_unitario_estimado || 0)}</td>
                        <td className="p-3 text-right font-bold text-slate-900">{formatBRL(item.subtotal || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-right p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase mr-2">Valor Total Estimado da Proposta:</span>
                <span className="text-xl font-extrabold text-blue-700">{formatBRL(dimensionamento.valor_total_estimado || 0)}</span>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              Nenhum dimensionamento gerado ainda. Clique no botão acima para calcular com IA.
            </div>
          )}
        </div>

        {/* CORREÇÃO DO ERRO 2: Eliminação da duplicação do GoNoGo e dos botões adicionais */}
        {editalId && (
          <GoNoGo
            bidId={editalId}
            habilitacao={{
              juridica: [],
              fiscal: [],
              tecnica: [],
              economica: [],
            }}
            initialChecklist={[]}
            initialDecision={null}
          />
        )}

      </main>
    </div>
  );
}