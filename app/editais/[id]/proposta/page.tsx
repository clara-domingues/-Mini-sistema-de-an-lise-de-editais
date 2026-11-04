"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";

// Import da função de geração em Word (.docx)
import { gerarDocumentoProposta } from "./utils/exportDocx";
import { CommercialProposalInput } from "./types/proposal";

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

  // Estados de Custos (Padrão Seguro sem BDI visível na proposta final)
  const [valorBase, setValorBase] = useState<number>(0);
  const [valorGlobal, setValorGlobal] = useState<string>("0.00");

  // Campos de texto editáveis alinhados ao padrão Seguro
  const [condicoesPagamento, setCondicoesPagamento] = useState<string>(
    "Prazo de Pagamento: 180 dias (com possibilidade de antecipação via Operação Confirming)."
  );
  const [validadeProposta, setValidadeProposta] = useState<string>(
    "60 (sessenta) dias corridos a contar da data de sua apresentação."
  );

  // Histórico de Versões
  const [versoes, setVersoes] = useState<PropostaVersao[]>([]);
  const [versaoSelecionadaId, setVersaoSelecionadaId] = useState<string>("");
  const [salvandoVersao, setSalvandoVersao] = useState(false);
  const [gerandoDocx, setGerandoDocx] = useState(false);

  const rawId = params?.id;
  const editalId = Array.isArray(rawId) ? rawId[0] : rawId;

  const fetchVersoes = useCallback(
    async (id: string) => {
      const { data, error } = await supabase
        .from("proposta_versoes")
        .select("*")
        .eq("edital_id", id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setVersoes(data as PropostaVersao[]);
      }
    },
    [supabase]
  );

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

        const { data: profileData } = await supabase
          .from("company_profiles")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (profileData) {
          setCompany(profileData as CompanyProfile);
        }

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
        setValorGlobal(custoInicial.toFixed(2));

        await fetchVersoes(editalId);
      } catch (err) {
        console.error("Erro inesperado:", err);
      } finally {
        setLoading(false);
      }
    }

    void fetchBidData();
  }, [editalId, supabase, fetchVersoes]);

  const handleSalvarVersao = async () => {
    if (!editalId) return;

    const nomeVersao = prompt(
      "Dê um nome para esta versão da proposta:",
      `Versão ${versoes.length + 1}`
    );
    if (!nomeVersao) return;

    setSalvandoVersao(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from("proposta_versoes").insert({
        edital_id: editalId,
        tenant_id: user?.id,
        nome_versao: nomeVersao,
        valor_base: valorBase,
        margem_bdi: 0,
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
      setValorGlobal(Number(v.valor_global).toFixed(2));
      if (v.condicoes_pagamento) setCondicoesPagamento(v.condicoes_pagamento);
      if (v.validade_proposta) setValidadeProposta(v.validade_proposta);
    }
  };

  // Função para exportar a proposta formatada em Word (.docx)
  const handleBaixarDocx = async () => {
    if (!bid) return;

    setGerandoDocx(true);
    try {
      const valorNumerico = parseFloat(valorGlobal) || valorBase || 0;

      const proposalData: CommercialProposalInput = {
        cliente: clientName,
        objeto: bid.title,
        prazoMeses: 36,
        itens: [
          {
            id: "1",
            cargo: "Vigilante / Posto de Segurança",
            quantidade: 1,
            salarioBase: valorNumerico > 0 ? valorNumerico / 36 : 2500,
            periculosidadePercentual: 0.3,
            encargosSociaisPercentual: 0.82,
            tipoJornada: "12h Diurna",
          },
        ],
        custosInsumos: {
          alimentacaoUnitaria: 22.5,
          diasAlimentacaoMes: 15.25,
          planoSaudeUnitario: 350,
          caixaAssistenciaUnitaria: 50,
          valeTransporteUnitario: 200,
          seguroDeVidaUnitario: 30,
          treinamentoUnitario: 65,
          uniformesEPIsUnitario: 120,
          comunicacaoMovelUnitario: 80,
        },
        veiculos: [],
        bdi: {
          administracaoCentral: 0.0983,
          reajusteAnual: 0.07,
          despesasFinanceiras: 0.022,
          lucro: 0.0491,
        },
        tributos: {
          cofins: 0.03,
          pis: 0.0065,
          iss: 0.05,
          csll: 0.01,
          irpj: 0.01,
        },
      };

      await gerarDocumentoProposta(proposalData);
    } catch (err) {
      console.error("Erro ao gerar DOCX:", err);
      alert("Houve um erro ao gerar o arquivo em Word.");
    } finally {
      setGerandoDocx(false);
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
      <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950 transition-colors">
        <Nav />
        <main className="flex-1 p-8 font-medium text-slate-500 dark:text-slate-400">
          Carregando dados da proposta...
        </main>
      </div>
    );
  }

  if (!bid) {
    return (
      <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950 transition-colors">
        <Nav />
        <main className="flex-1 p-8">
          <p className="font-semibold text-red-600 dark:text-red-400">
            Edital não encontrado para gerar proposta.
          </p>
          <Link
            href="/editais"
            className="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Voltar para editais
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-100 dark:bg-slate-950 print:bg-white dark:print:bg-white transition-colors">
      <div className="print:hidden">
        <Nav />
      </div>

      <main className="mx-auto max-w-4xl flex-1 space-y-6 overflow-y-auto px-4 py-8 text-slate-900 dark:text-slate-100 sm:px-8 lg:px-12 print:m-0 print:max-w-none print:p-0">
        {/* Barra superior de ações e versões */}
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-colors print:hidden">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <Link
              href={`/editais/${bid.id}`}
              className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Voltar para os detalhes
            </Link>

            <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
              <button
                type="button"
                onClick={handleSalvarVersao}
                disabled={salvandoVersao}
                className="rounded-xl border border-blue-600 dark:border-blue-500 px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 transition hover:bg-blue-50 dark:hover:bg-blue-950/50 disabled:opacity-50"
              >
                {salvandoVersao ? "A guardar..." : "💾 Guardar Versão"}
              </button>

              <button
                type="button"
                onClick={handleBaixarDocx}
                disabled={gerandoDocx}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {gerandoDocx ? "Gerando Word..." : "📄 Exportar em Word (.docx)"}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Imprimir / PDF
              </button>
            </div>
          </div>

          <div className="flex flex-col items-start justify-between gap-4 border-t border-slate-100 dark:border-slate-800 pt-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <label
                htmlFor="versaoSelect"
                className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400"
              >
                Versão Salva:
              </label>
              <select
                id="versaoSelect"
                value={versaoSelecionadaId}
                onChange={(e) => handleSelecionarVersao(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Proposta Atual (Edição Livre) --</option>
                {versoes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nome_versao} - {formatBRL(v.valor_global)} (
                    {new Date(v.created_at).toLocaleDateString("pt-BR")})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Documento Oficial da Proposta - Estilo SEGURO */}
        <div className="space-y-8 rounded-2xl border border-slate-200 bg-white p-8 text-slate-900 shadow-sm [color-scheme:light] sm:p-12 print:border-none print:shadow-none">
          {/* Cabeçalho Oficial SEGURO */}
          <div className="flex items-center justify-between border-b-2 border-yellow-500 pb-6">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
                Proposta Comercial & Técnica
              </span>
              <h1 className="text-3xl font-black uppercase tracking-wide text-slate-950 mt-1">
                SEGURO
              </h1>
              <p className="text-xs font-semibold text-slate-600">
                Soluções Personalizadas de Segurança, Tecnologia e Terceirização
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block rounded-lg bg-yellow-400 px-3 py-1 text-xs font-bold text-slate-950">
                GPTW Certificada 2025
              </span>
              <p className="mt-1 text-[11px] text-slate-500">
                Ref: Processo 01/2026[cite: 9]
              </p>
            </div>
          </div>

          {/* Dados da Empresa Proponente e do Órgão Licitante */}
          <div className="grid grid-cols-1 gap-6 rounded-xl border border-slate-100 bg-slate-50 p-6 text-sm md:grid-cols-2 print:bg-slate-50">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">
                Empresa Proponente
              </p>
              <p className="mt-1 font-bold text-slate-900">
                {company?.razao_social || "SEGURO SEGURANÇA LTDA"}[cite: 24]
              </p>
              <p className="text-xs text-slate-600">
                CNPJ: {company?.cnpj || "17.036.171/0001-73"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">
                Órgão Licitante (Cliente)
              </p>
              <p className="mt-1 font-bold text-slate-900">{clientName}</p>
              <p className="text-xs text-slate-600">
                Data Limite:{" "}
                {bid.deadline
                  ? new Date(bid.deadline).toLocaleDateString("pt-BR")
                  : "N/A"}
              </p>
            </div>
            <div className="border-t border-slate-200 pt-2 md:col-span-2">
              <p className="text-xs font-bold uppercase text-slate-400">
                Objeto da Licitação
              </p>
              <input
                type="text"
                value={bid.title}
                onChange={(e) => setBid({ ...bid, title: e.target.value })}
                className="mt-1 w-full border-b border-dashed border-slate-300 bg-transparent font-semibold text-slate-900 focus:border-blue-600 focus:outline-none print:border-none"
              />
            </div>
          </div>

          <div className="space-y-4 text-sm leading-relaxed text-slate-700">
            <p className="font-bold text-slate-900">
              À Comissão Permanente de Licitação,
            </p>
            <p>
              Apresentamos nossa proposta comercial e técnica para a prestação
              dos serviços especializados descritos no edital em epígrafe,
              desenvolvida com base em rigorosos padrões de conformidade,
              tecnologia integrada e excelência operacional.
            </p>
            <p>
              O valor global estimado para a presente proposta, contemplando
              todos os encargos diretos, indiretos e tributos incidentes, é
              consolidado abaixo:
            </p>

            {/* Bloco de Destaque do Valor Global */}
            <div className="rounded-xl border border-yellow-200 bg-yellow-50/60 p-6 text-center print:bg-slate-50">
              <span className="block text-xs font-extrabold uppercase tracking-wider text-yellow-800">
                Valor Global Consolidado da Proposta
              </span>
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="text-2xl font-extrabold text-slate-950">R$</span>
                <input
                  type="number"
                  step="0.01"
                  value={valorGlobal}
                  onChange={(e) => setValorGlobal(e.target.value)}
                  className="w-64 rounded-lg border border-yellow-300 bg-white px-4 py-1 text-center text-2xl font-extrabold text-slate-950 shadow-inner focus:outline-none focus:ring-2 focus:ring-yellow-500 print:border-none print:bg-transparent"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6 border-t border-slate-200 pt-8 text-sm">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <p className="font-bold text-slate-900">
                  Condições de Pagamento:
                </p>
                <input
                  type="text"
                  value={condicoesPagamento}
                  onChange={(e) => setCondicoesPagamento(e.target.value)}
                  className="mt-1 w-full border-b border-dashed border-slate-300 bg-transparent text-slate-600 focus:border-blue-600 focus:outline-none print:border-none"
                />
              </div>
              <div>
                <p className="font-bold text-slate-900">
                  Validade da Proposta:
                </p>
                <input
                  type="text"
                  value={validadeProposta}
                  onChange={(e) => setValidadeProposta(e.target.value)}
                  className="mt-1 w-full border-b border-dashed border-slate-300 bg-transparent text-slate-600 focus:border-blue-600 focus:outline-none print:border-none"
                />
              </div>
            </div>

            {/* Rodapé e Assinatura */}
            <div className="space-y-2 pt-12 text-center border-t border-slate-100">
              <div className="mx-auto w-64 border-b border-slate-400 pb-1">
                <p className="text-sm font-bold text-slate-900">
                  {company?.nome_completo || "Flávia Dantas / Wagner Rocha"}[cite: 18, 62]
                </p>
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-700">
                {company?.cargo || "Coordenação Comercial / Gestão Operacional"}{" "}
                — CNPJ: {company?.cnpj || "17.036.171/0001-73"}[cite: 18, 24, 62]
              </p>
              <p className="text-[11px] font-medium text-yellow-700">
                Felicidade é viver SEGURO — www.seguro.srv.br | 0800 123 2423[cite: 9]
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}