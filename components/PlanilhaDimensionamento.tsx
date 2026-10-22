"use client";

import { useState, useEffect, useCallback } from "react";

interface ItemDimensionado {
  catalog_item_id: string;
  nome: string;
  tipo: string;
  unidade: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  justificativa: string;
}

export default function PlanilhaDimensionamento({ editalId }: { editalId: string }) {
  const [loading, setLoading] = useState(false);
  const [itens, setItens] = useState<ItemDimensionado[]>([]);
  const [valorTotal, setValorTotal] = useState(0);
  const [resumo, setResumo] = useState("");

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valor);
  };

  const carregarDimensionamento = useCallback(async (forcar = false) => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat-edital/dimensionamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editalId, forcarRegeneracao: forcar }),
      });
      const data = await res.json();
      
      if (data.success && data.dimensionamento) {
        setResumo(data.dimensionamento.resumo_escopo || "");
        setItens(data.dimensionamento.itens || []);
        setValorTotal(data.dimensionamento.valor_total_estimado || 0);
      }
    } catch (err) {
      console.error("Erro ao carregar dimensionamento:", err);
    } finally {
      setLoading(false);
    }
  }, [editalId]);

  useEffect(() => {
    if (!editalId) return;
    
    let isMounted = true;
    async function init() {
      if (isMounted) {
        await carregarDimensionamento(false);
      }
    }
    void init();

    return () => {
      isMounted = false;
    };
  }, [editalId, carregarDimensionamento]);

  return (
    <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Planilha de Dimensionamento</h2>
          <p className="text-sm text-slate-500">A IA cruza as exigências do edital com os preços do seu catálogo.</p>
        </div>
        <button
          type="button"
          onClick={() => carregarDimensionamento(true)}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? "A processar..." : "Regerar Planilha com IA"}
        </button>
      </div>

      {resumo && (
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-900">
          <strong>Estratégia do Dimensionamento:</strong> {resumo}
        </div>
      )}

      {itens.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <th className="p-3">Item / Justificativa</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Unid.</th>
                <th className="p-3 text-right">Qtd.</th>
                <th className="p-3 text-right">Preço Unit.</th>
                <th className="p-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itens.map((item: ItemDimensionado, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="p-3 font-medium text-slate-900">
                    {item.nome}
                    <span className="block text-xs font-normal text-slate-400 mt-0.5">{item.justificativa}</span>
                  </td>
                  <td className="p-3 text-slate-600">{item.tipo}</td>
                  <td className="p-3 font-mono text-slate-600">{item.unidade}</td>
                  <td className="p-3 text-right font-semibold text-slate-900">{item.quantidade}</td>
                  <td className="p-3 text-right text-slate-600">{formatarMoeda(item.preco_unitario)}</td>
                  <td className="p-3 text-right font-bold text-slate-950">{formatarMoeda(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold text-slate-950">
                <td colSpan={5} className="p-3 text-right">Valor Total Estimado da Proposta:</td>
                <td className="p-3 text-right text-blue-700 text-base">{formatarMoeda(valorTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-slate-500 text-sm">
          {loading ? "A carregar dimensionamento..." : "Ainda não foi gerada nenhuma planilha para este edital."}
        </div>
      )}
    </div>
  );
}