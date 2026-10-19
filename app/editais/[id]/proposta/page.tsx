"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";

type Bid = {
  id: string;
  title: string;
  estimated_value: number;
  deadline: string;
};

export default function PropostaComercialPage() {
  const params = useParams();
  const supabase = createClient();
  const [bid, setBid] = useState<Bid | null>(null);
  const [clientName, setClientName] = useState("Prefeitura Municipal de Exemplo");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBidData() {
      if (!params?.id) return;
      try {
        const { data: bidData } = await supabase
          .from("bids")
          .select("*")
          .eq("id", params.id)
          .single();

        if (bidData) {
          setBid(bidData as Bid);
          if (bidData.client_id) {
            const { data: clientData } = await supabase
              .from("clients")
              .select("name")
              .eq("id", bidData.client_id)
              .single();
            if (clientData?.name) setClientName(clientData.name);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar proposta:", err);
      } finally {
        setLoading(false);
      }
    }
    void fetchBidData();
  }, [params?.id, supabase]);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-100">
        <Nav />
        <main className="flex-1 p-8 text-slate-500">A gerar proposta comercial...</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-100 print:bg-white">
      <Nav />
      <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-10 text-slate-900 max-w-4xl mx-auto space-y-6">
        <div className="print:hidden">
          <Link href={`/editais/${params?.id}`} className="text-sm font-semibold text-blue-600 hover:underline">
            ← Voltar ao edital
          </Link>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase">PREPARAÇÃO DA PROPOSTA</p>
              <h1 className="text-2xl font-bold text-slate-900">Proposta Comercial</h1>
              <p className="text-xs text-slate-500">Edital: {bid?.title || "Edital"}</p>
            </div>
            <button
              onClick={() => window.print()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow"
            >
              Imprimir / Salvar PDF
            </button>
          </div>
        </div>

        {/* Documento Proposta Comercial */}
        <div className="rounded-2xl bg-white p-8 sm:p-12 shadow-sm border border-slate-200 space-y-6 text-slate-800">
          <div className="text-center border-b border-slate-200 pb-6">
            <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">PROPOSTA COMERCIAL</h2>
          </div>

          <div className="text-sm space-y-1">
            <p><strong className="text-slate-900">Ao:</strong> {clientName}</p>
            <p><strong className="text-slate-900">Ref.:</strong> {bid?.title || "Pregão Eletrônico"}</p>
          </div>

          <div className="space-y-4 text-sm leading-relaxed">
            <div>
              <h3 className="font-bold text-slate-900 mb-1">1. Identificação do Proponente</h3>
              <p><strong>Razão Social:</strong> .</p>
              <p><strong>CNPJ:</strong> .</p>
              <p><strong>Representante legal:</strong> Ana Clara, estagiária</p>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 mb-1">2. Objeto</h3>
              <p>{bid?.title || "Prestação de serviços e fornecimento de solução especializada."}</p>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 mb-1">3. Preços</h3>
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-slate-50 text-slate-700 uppercase">
                    <tr>
                      <th className="p-2 border-b">Item</th>
                      <th className="p-2 border-b">Descrição</th>
                      <th className="p-2 border-b text-center">Un.</th>
                      <th className="p-2 border-b text-center">Qtd.</th>
                      <th className="p-2 border-b text-right">Valor unitário</th>
                      <th className="p-2 border-b text-right">Valor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2 border-b">1</td>
                      <td className="p-2 border-b">{bid?.title || "Serviço especializado"}</td>
                      <td className="p-2 border-b text-center">serviço</td>
                      <td className="p-2 border-b text-center">1</td>
                      <td className="p-2 border-b text-right">{formatBRL(bid?.estimated_value || 50000)}</td>
                      <td className="p-2 border-b text-right font-semibold">{formatBRL(bid?.estimated_value || 50000)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 font-bold text-slate-900">
                Valor global da proposta: {formatBRL(bid?.estimated_value || 50000)}
              </p>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 mb-1">4. Condições gerais</h3>
              <ul className="list-disc list-inside space-y-1 text-slate-700 text-xs">
                <li>Validade da proposta: 60 (sessenta) dias contados da data de abertura da sessão.</li>
                <li>Prazo de vigência: 12 meses.</li>
                <li>Declaramos que os preços acima incluem todos os custos, tributos, fretes e demais despesas necessárias ao cumprimento do objeto.</li>
                <li>Declaramos que conhecemos e concordamos com todas as condições do edital.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 mb-1">5. Dados bancários</h3>
              <p><strong>Banco:</strong> .</p>
              <p><strong>Agência:</strong> .</p>
              <p><strong>Conta:</strong> .</p>
            </div>

            <div className="pt-6 text-right text-xs text-slate-600 space-y-1">
              <p>Fortaleza - CE, {new Date().toLocaleDateString("pt-BR")}</p>
              <p className="font-bold text-slate-900">Ana Clara</p>
              <p>estagiária</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}