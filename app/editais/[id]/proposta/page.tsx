"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";

type BidDetail = {
  id: string;
  title: string;
  status: string;
  estimated_value: number;
  deadline: string;
  client_id?: string;
};

type CompanyProfile = {
  razao_social?: string;
  cnpj?: string;
  nome_completo?: string;
  cpf?: string;
  cargo?: string;
};

type PropostaVersao = {
  id: string;
  nome_versao: string;
  valor_base: number;
  margem_bdi: number;
  valor_global: number;
  condicoes_pagamento: string;
  validade_proposta: string;
  created_at: string;
};

export default function PropostaPage() {
  const params = useParams();
  const supabase = createClient();

  const [bid, setBid] = useState<BidDetail | null>(null);
  const [clientName, setClientName] = useState<string>("Órgão não informado");
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Estados de Custos e Margem / BDI
  const [valorBase, setValorBase] = useState<number>(0);
  const [margemBdi, setMargemBdi] = useState<number>(10);
  const [valorGlobal, setValorGlobal] = useState<string>("0.00");

  // Campos de texto editáveis
  const [condicoesPagamento, setCondicoesPagamento] = useState<string>("Conforme estabelecido no edital.");
  const [validadeProposta, setValidadeProposta] = useState<string>("60 (sessenta) dias corridos a contar da data de abertura.");

  // Histórico de Versões
  const [versoes, setVersoes] = useState<PropostaVersao[]>([]);
  const [versaoSelecionadaId, setVersaoSelecionadaId] = useState<string>("");
  const [salvandoVersao, setSalvandoVersao] = useState(false);

  const rawId = params?.id;
  const editalId = Array.isArray(rawId) ? rawId[0] : rawId;

  const calcularGlobalStr = useCallback((base: number, margem: number) => {
    const acrescimo = base * (margem / 100);
    const total = base + acrescimo;
    return total.toFixed(2);
  }, []);

  const fetchVersoes = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from("proposta_versoes")
      .select("*")
      .eq("edital_id", id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setVersoes(data as PropostaVersao[]);
    }
  }, [supabase]);

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
          console.error("Erro ao carregar edital para proposta:", error);
          setLoading(false);
          return;
        }

        setBid(bidData as BidDetail);
        let custoInicial = Number(bidData.estimated_value) || 0;

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

        // Busca flexível dos dados da empresa
        const { data: profileData } = await supabase
          .from("company_profiles")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (profileData) {
          setCompany(profileData as CompanyProfile);
        }

        // Tenta buscar valor atualizado do dimensionamento
        try {
          const res = await fetch("/api/chat-edital/dimensionamento", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ editalId }),
          });
          const dimData = await res.json();
          if (dimData.success && dimData.dimensionamento?.valor_total_estimado) {
            custoInicial = Number(dimData.dimensionamento.valor_total_estimado);
          }
        } catch (dimErr) {
          console.error("Erro ao buscar dimensionamento:", dimErr);
        }

        setValorBase(custoInicial);
        setValorGlobal(calcularGlobalStr(custoInicial, 10));

        await fetchVersoes(editalId);

      } catch (err) {
        console.error("Erro inesperado:", err);
      } finally {
        setLoading(false);
      }
    }

    void fetchBidData();
  }, [editalId, supabase, calcularGlobalStr, fetchVersoes]);

  const handleMargemChange = (novaMargem: number) => {
    setMargemBdi(novaMargem);
    setValorGlobal(calcularGlobalStr(valorBase, novaMargem));
  };

  const handleSalvarVersao = async () => {
    if (!editalId) return;

    const nomeVersao = prompt("Dê um nome para esta versão da proposta:", `Versão ${versoes.length + 1} (${margemBdi}% BDI)`);
    if (!nomeVersao) return;

    setSalvandoVersao(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from("proposta_versoes").insert({
        edital_id: editalId,
        tenant_id: user?.id,
        nome_versao: nomeVersao,
        valor_base: valorBase,
        margem_bdi: margemBdi,
        valor_global: Number(valorGlobal),
        condicoes_pagamento: condicoesPagamento,
        validade_proposta: validadeProposta,
      });

      if (error) {
        alert(`Erro ao guardar a versão da proposta: ${error.message}`);
      } else {
        await fetchVersoes(editalId);
        alert("Versão guardada com sucesso!");
      }
    } catch (err) {
      console.error(err);
      alert("Ocorreu um erro inesperado ao guardar a versão.");
    } finally {
      setSalvandoVersao(false);
    }
  };

  const handleSelecionarVersao = (versaoId: string) => {
    setVersaoSelecionadaId(versaoId);
    const v = versoes.find((item) => item.id === versaoId);
    if (v) {
      setValorBase(Number(v.valor_base));
      setMargemBdi(Number(v.margem_bdi));
      setValorGlobal(Number(v.valor_global).toFixed(2));
      if (v.condicoes_pagamento) setCondicoesPagamento(v.condicoes_pagamento);
      if (v.validade_proposta) setValidadeProposta(v.validade_proposta);
    }
  };

  const formatBRL = (val: number | string) => {
    const num = typeof val === "string" ? parseFloat(val) : val;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(isNaN(num) ? 0 : num);
  };

  if (!editalId || loading) {
    return (
      <div className="flex min-h-screen bg-slate-100">
        <Nav />
        <main className="flex-1 p-8 text-slate-500 font-medium">Carregando dados da proposta...</main>
      </div>
    );
  }

  if (!bid) {
    return (
      <div className="flex min-h-screen bg-slate-100">
        <Nav />
        <main className="flex-1 p-8">
          <p className="text-red-600 font-semibold">Edital não encontrado para gerar proposta.</p>
          <Link href="/editais" className="mt-4 inline-block text-blue-600 hover:underline">
            ← Voltar para editais
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-100 print:bg-white">
      <div className="print:hidden">
        <Nav />
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 lg:px-12 text-slate-900 space-y-6 max-w-4xl mx-auto print:p-0 print:m-0 print:max-w-none">
        
        {/* Barra superior de ações, versões e BDI */}
        <div className="print:hidden flex flex-col gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <Link href={`/editais/${bid.id}`} className="text-sm font-semibold text-blue-600 hover:underline">
              ← Voltar para os detalhes
            </Link>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleSalvarVersao}
                disabled={salvandoVersao}
                className="rounded-xl border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition disabled:opacity-50"
              >
                {salvandoVersao ? "A guardar..." : "💾 Guardar Versão"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
              >
                Imprimir / PDF
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <label htmlFor="versaoSelect" className="text-xs font-bold text-slate-600 uppercase">Versão Salva:</label>
              <select
                id="versaoSelect"
                value={versaoSelecionadaId}
                onChange={(e) => handleSelecionarVersao(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Proposta Atual (Edição Livre) --</option>
                {versoes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome_versao} - {formatBRL(v.valor_global)} ({new Date(v.created_at).toLocaleDateString("pt-BR")})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="margemBdiInput" className="text-xs font-bold text-slate-600 uppercase">Margem / BDI (%):</label>
              <input
                id="margemBdiInput"
                type="number"
                step="0.01"
                value={margemBdi}
                onChange={(e) => handleMargemChange(Number(e.target.value))}
                className="w-20 px-3 py-1.5 text-sm font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Documento Oficial da Proposta */}
        <div className="rounded-2xl bg-white p-8 sm:p-12 shadow-sm border border-slate-200 print:border-none print:shadow-none space-y-8">
          
          <div className="border-b border-slate-200 pb-6 text-center space-y-2">
            <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-950">Proposta Comercial de Preços</h1>
            <p className="text-sm text-slate-600">Ref. ao Processo Licitatório / Edital</p>
          </div>

          {/* Cabeçalho com dados da Empresa Proponente e do Órgão Licitante */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm bg-slate-50 print:bg-slate-50 p-6 rounded-xl border border-slate-100">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Empresa Proponente</p>
              <p className="font-bold text-slate-900 mt-1">{company?.razao_social || "Razão Social não informada"}</p>
              <p className="text-xs text-slate-600">CNPJ: {company?.cnpj || "00.000.000/0000-00"}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Órgão Licitante (Cliente)</p>
              <p className="font-bold text-slate-900 mt-1">{clientName}</p>
              <p className="text-xs text-slate-600">Data Limite: {bid.deadline ? new Date(bid.deadline).toLocaleDateString("pt-BR") : "N/A"}</p>
            </div>
            <div className="md:col-span-2 pt-2 border-t border-slate-200">
              <p className="text-xs font-bold text-slate-400 uppercase">Objeto da Licitação</p>
              <input
                type="text"
                value={bid.title}
                onChange={(e) => setBid({ ...bid, title: e.target.value })}
                className="w-full mt-1 bg-transparent font-semibold text-slate-900 border-b border-dashed border-slate-300 focus:outline-none focus:border-blue-600 print:border-none"
              />
            </div>
          </div>

          <div className="text-sm text-slate-700 leading-relaxed space-y-4">
            <p>À Comissão Permanente de Licitação,</p>
            <p>
              Apresentamos nossa proposta de preços para o fornecimento dos produtos e/ou execução dos serviços descritos no edital em epígrafe, cotados de acordo com o dimensionamento técnico e as exigências estabelecidas.
            </p>
            <p>
              O valor global estimado para a presente proposta, incluindo todos os custos diretos e indiretos, encargos sociais e tributos incidentes, é de:
            </p>
            
            <div className="p-5 bg-blue-50 border border-blue-100 rounded-xl text-center print:bg-slate-50">
              <span className="text-xs text-blue-700 font-bold block uppercase tracking-wider">
                Valor Global da Proposta {margemBdi > 0 ? `(Com ${margemBdi}% de BDI/Margem)` : ""}
              </span>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="text-2xl font-extrabold text-blue-950">R$</span>
                <input
                  type="number"
                  step="0.01"
                  value={valorGlobal}
                  onChange={(e) => setValorGlobal(e.target.value)}
                  className="text-2xl font-extrabold text-blue-950 bg-white/80 px-4 py-1 rounded-lg text-center border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-inner print:border-none print:bg-transparent"
                />
              </div>
              <span className="text-xs text-slate-500 mt-2 block font-medium">
                Custo Base: {formatBRL(valorBase)} | Formatado Oficial: {formatBRL(valorGlobal)}
              </span>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-200 space-y-8 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="font-bold text-slate-900">Condições de Pagamento:</p>
                <input
                  type="text"
                  value={condicoesPagamento}
                  onChange={(e) => setCondicoesPagamento(e.target.value)}
                  className="w-full mt-1 text-slate-600 bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-blue-600 print:border-none"
                />
              </div>
              <div>
                <p className="font-bold text-slate-900">Validade da Proposta:</p>
                <input
                  type="text"
                  value={validadeProposta}
                  onChange={(e) => setValidadeProposta(e.target.value)}
                  className="w-full mt-1 text-slate-600 bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-blue-600 print:border-none"
                />
              </div>
            </div>

            {/* Rodapé com Assinatura do Responsável Legal */}
            <div className="pt-12 text-center space-y-1">
              <div className="w-64 mx-auto border-b border-slate-400 pb-1">
                <p className="font-bold text-sm text-slate-900">{company?.nome_completo || "Responsável Legal"}</p>
              </div>
              <p className="font-semibold text-xs text-slate-700 mt-1">{company?.cargo || "Diretor Comercial"} — CPF: {company?.cpf || "000.000.000-00"}</p>
              <p className="text-[11px] text-slate-400">Assinatura Digital / Carimbo da Empresa Proponente</p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}