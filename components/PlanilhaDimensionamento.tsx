"use client";

import { useCallback, useEffect, useState } from "react";
import { brl, type TipoLinha } from "@/lib/dimensionamento";

/* =========================================================
   TIPOS
========================================================= */

interface LinhaItem {
  id: string;
  tipo: TipoLinha;
  name: string;
  quantidade_padrao: number;
  valor_unit: number;
  depreciacao_meses: number;
  preco_override?: number | null;
}

interface BlocoFuncao {
  role_id: string;
  nome: string;
  escala: string | null;
  insalubridade_pct: number;
  periculosidade_pct: number;
  linhas: LinhaItem[];
}

type GrupoCusto =
  | "MAO_DE_OBRA"
  | "EPI"
  | "EXAME"
  | "TREINAMENTO"
  | "UNIFORME"
  | "MATERIAL"
  | "EQUIPAMENTO"
  | "SERVICO"
  | "BENEFICIO"
  | "ENCARGO"
  | "CUSTO_INDIRETO"
  | "OUTRO";

type Periodicidade =
  | "MENSAL"
  | "ANUAL"
  | "UNICO"
  | "POR_DEMANDA"
  | "DEPRECIACAO";

interface ItemUniversal {
  id?: string;
  catalog_item_id?: string | null;
  item?: string;
  nome?: string;
  grupo?: GrupoCusto | string;
  tipo?: string;
  categoria?: string;
  unidade?: string;
  quantidade?: number | null;
  quantidade_padrao?: number | null;
  preco_unitario?: number | null;
  preco_unitario_estimado?: number | null;
  subtotal?: number | null;
  custo_mensal?: number | null;
  periodicidade?: Periodicidade | string;
  depreciacao_meses?: number | null;
  justificativa?: string;
  origem?: string;
  requer_validacao?: boolean;
  funcao?: string;
  role_id?: string | null;
  observacoes?: string;
  pagina_origem?: string | null;
  trecho_origem?: string | null;
  fornecido_por?: string | null;
}

interface DimensionamentoUniversal {
  versao?: number;
  estrategia?: string;
  resumo_escopo?: string;
  premissas?: string[];
  funcoes?: BlocoFuncao[];
  itens?: ItemUniversal[];
  custos_indiretos?: Record<string, unknown>[];
  formacao_preco?: Record<string, unknown>;
  valor_total_estimado?: number | null;
}

interface ApiResponse {
  success?: boolean;
  error?: string;
  modo?: string;
  alertas?: string[];
  lacunas?: string[];
  blocos?: BlocoFuncao[];
  dimensionamento?: DimensionamentoUniversal | null;
}

/* =========================================================
   CONSTANTES
========================================================= */

const GRUPOS: { value: GrupoCusto; label: string }[] = [
  { value: "MAO_DE_OBRA", label: "Mão de obra" },
  { value: "EPI", label: "Equipamentos de proteção individual" },
  { value: "EXAME", label: "Exames ocupacionais" },
  { value: "TREINAMENTO", label: "Treinamentos" },
  { value: "UNIFORME", label: "Uniformes" },
  { value: "MATERIAL", label: "Materiais e insumos" },
  { value: "EQUIPAMENTO", label: "Equipamentos" },
  { value: "SERVICO", label: "Serviços" },
  { value: "BENEFICIO", label: "Benefícios" },
  { value: "ENCARGO", label: "Encargos" },
  { value: "CUSTO_INDIRETO", label: "Custos indiretos" },
  { value: "OUTRO", label: "Outros" },
];

const GRUPO_LEGADO: Record<string, GrupoCusto> = {
  EXAMES: "EXAME",
  TREINAMENTOS: "TREINAMENTO",
  UNIFORMES: "UNIFORME",
  MATERIAIS: "MATERIAL",
  EQUIPAMENTOS: "EQUIPAMENTO",
  SERVICOS: "SERVICO",
  BENEFICIOS: "BENEFICIO",
  ENCARGOS: "ENCARGO",
  CUSTOS_INDIRETOS: "CUSTO_INDIRETO",
  OUTROS: "OUTRO",
};

const PERIODICIDADES: { value: Periodicidade; label: string }[] = [
  { value: "MENSAL", label: "Mensal" },
  { value: "ANUAL", label: "Anual" },
  { value: "UNICO", label: "Único" },
  { value: "POR_DEMANDA", label: "Por demanda" },
  { value: "DEPRECIACAO", label: "Depreciação" },
];

/* =========================================================
   FUNÇÕES AUXILIARES
========================================================= */

function numero(valor: unknown, fallback = 0): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : fallback;
}

function numeroOuNull(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizarGrupo(valor: unknown): GrupoCusto {
  const s = String(valor ?? "").toUpperCase();
  if (GRUPOS.some((g) => g.value === s)) return s as GrupoCusto;
  return GRUPO_LEGADO[s] ?? "OUTRO";
}

function normalizarPeriodicidade(valor: unknown): Periodicidade {
  const s = String(valor ?? "").toUpperCase();
  return PERIODICIDADES.some((p) => p.value === s)
    ? (s as Periodicidade)
    : "MENSAL";
}

function quantidadeItem(item: ItemUniversal): number | null {
  return numeroOuNull(item.quantidade ?? item.quantidade_padrao);
}

function precoItem(item: ItemUniversal): number | null {
  return numeroOuNull(item.preco_unitario_estimado ?? item.preco_unitario);
}

function subtotalItem(item: ItemUniversal): number | null {
  const q = quantidadeItem(item);
  const p = precoItem(item);
  return q !== null && p !== null ? q * p : null;
}

function custoMensalItem(item: ItemUniversal): number | null {
  const subtotal = subtotalItem(item);
  if (subtotal === null) return null;

  switch (normalizarPeriodicidade(item.periodicidade)) {
    case "MENSAL":
      return subtotal;
    case "ANUAL":
      return subtotal / 12;
    case "DEPRECIACAO": {
      const meses = numero(item.depreciacao_meses);
      return meses > 0 ? subtotal / meses : null;
    }
    default:
      return null;
  }
}

function normalizarItemUniversal(item: ItemUniversal): ItemUniversal {
  return {
    ...item,
    id: item.id ?? `item-${Math.random().toString(36).slice(2, 10)}`,
    item: item.item ?? item.nome ?? "Item sem descrição",
    nome: item.nome ?? item.item ?? "Item sem descrição",
    grupo: normalizarGrupo(item.grupo ?? item.tipo),
    tipo: item.tipo ?? "Não classificado",
    categoria: item.categoria ?? "Geral",
    unidade: item.unidade ?? "UN",
    quantidade: quantidadeItem(item),
    quantidade_padrao: quantidadeItem(item),
    preco_unitario_estimado: precoItem(item),
    preco_unitario: precoItem(item),
    periodicidade: normalizarPeriodicidade(item.periodicidade),
    depreciacao_meses: numeroOuNull(item.depreciacao_meses),
    justificativa: item.justificativa ?? "",
    origem: item.origem ?? "manual",
    requer_validacao: item.requer_validacao === true,
  };
}

function prepararItemParaSalvar(item: ItemUniversal): ItemUniversal {
  const n = normalizarItemUniversal(item);
  return {
    ...n,
    quantidade_padrao: n.quantidade,
    subtotal: subtotalItem(n),
    custo_mensal: custoMensalItem(n),
  };
}

function somarNaoNulos(valores: (number | null)[]): number {
  return valores.reduce<number>((t, v) => t + (v ?? 0), 0);
}

function NumInput({
  value,
  onChange,
  width = "w-20",
  step = "1",
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  width?: string;
  step?: string;
}) {
  return (
    <input
      type="number"
      min="0"
      step={step}
      value={value === null || !Number.isFinite(value) ? "" : value}
      placeholder="—"
      onChange={(e) => {
        const raw = e.target.value;

        if (raw === "") {
          onChange(null);
          return;
        }

        const n = Number(raw);
        onChange(Number.isFinite(n) && n >= 0 ? n : null);
      }}
      className={`${width} rounded bg-transparent px-1 text-right font-semibold text-red-600 outline-none placeholder:text-amber-500 focus:bg-yellow-100`}
    />
  );
}

/* =========================================================
   COMPONENTE
========================================================= */

export default function PlanilhaDimensionamento({
  editalId,
  documentContext,
  tituloEdital,
  valorEstimado,
}: {
  editalId: string;
  logoUrl?: string | null;
  documentContext?: string;
  tituloEdital?: string | null;
  valorEstimado?: number | null;
}) {
  const [blocos, setBlocos] = useState<BlocoFuncao[]>([]);
  const [itensUniversais, setItensUniversais] = useState<ItemUniversal[]>([]);
  const [resumoEscopo, setResumoEscopo] = useState("");
  const [premissas, setPremissas] = useState<string[]>([]);
  const [alertas, setAlertas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedEditalId, setLoadedEditalId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const isLoading = loading || loadedEditalId !== editalId;
  const ocupado = salvando || exportando || gerando;

  const buscarDados = useCallback(async () => {
    const res = await fetch(
      `/api/chat-edital/dimensionamento?editalId=${encodeURIComponent(editalId)}`,
      { cache: "no-store" },
    );

    const data = (await res.json()) as ApiResponse;

    if (!res.ok || !data.success) {
      throw new Error(
        data.error || "Não foi possível carregar o dimensionamento.",
      );
    }

    const dimensionamento = data.dimensionamento;

    return {
      blocos: Array.isArray(data.blocos) ? data.blocos : [],
      itens: Array.isArray(dimensionamento?.itens)
        ? dimensionamento.itens.map(normalizarItemUniversal)
        : [],
      resumo: dimensionamento?.resumo_escopo ?? "",
      premissas: Array.isArray(dimensionamento?.premissas)
        ? dimensionamento.premissas
        : [],
    };
  }, [editalId]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    setSucesso("");
    setAlertas([]);

    try {
      const dados = await buscarDados();
      setBlocos(dados.blocos);
      setItensUniversais(dados.itens);
      setResumoEscopo(dados.resumo);
      setPremissas(dados.premissas);
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Erro inesperado ao carregar a planilha.",
      );
      setBlocos([]);
      setItensUniversais([]);
    } finally {
      setLoadedEditalId(editalId);
      setLoading(false);
    }
  }, [buscarDados, editalId]);

  useEffect(() => {
    let ativo = true;

    async function executar() {
      setLoading(true);
      setErro("");
      setSucesso("");

      try {
        const dados = await buscarDados();

        if (ativo) {
          setBlocos(dados.blocos);
          setItensUniversais(dados.itens);
          setResumoEscopo(dados.resumo);
          setPremissas(dados.premissas);
        }
      } catch (e) {
        if (ativo) {
          setErro(
            e instanceof Error
              ? e.message
              : "Erro inesperado ao carregar a planilha.",
          );
          setBlocos([]);
          setItensUniversais([]);
        }
      } finally {
        if (ativo) {
          setLoadedEditalId(editalId);
          setLoading(false);
        }
      }
    }

    void executar();

    return () => {
      ativo = false;
    };
  }, [buscarDados, editalId]);

  function atualizarItemUniversal(
    itemId: string,
    patch: Partial<ItemUniversal>,
  ) {
    setItensUniversais((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    );
  }

  function adicionarItemUniversal() {
    const novo = normalizarItemUniversal({
      id: `manual-${Date.now()}`,
      item: "Novo item",
      grupo: "OUTRO",
      unidade: "UN",
      quantidade: 1,
      preco_unitario_estimado: null,
      periodicidade: "MENSAL",
      origem: "manual",
      requer_validacao: false,
    });

    setItensUniversais((prev) => [...prev, novo]);
  }

  function removerItemUniversal(itemId: string) {
    setItensUniversais((prev) => prev.filter((item) => item.id !== itemId));
  }

  function montarDimensionamento(
    itens: ItemUniversal[],
  ): DimensionamentoUniversal {
    return {
      versao: 1,
      estrategia: "Dimensionamento universal",
      resumo_escopo: resumoEscopo,
      premissas,
      funcoes: blocos,
      itens,
      custos_indiretos: [],
      formacao_preco: {},
      valor_total_estimado: somarNaoNulos(itens.map(subtotalItem)),
    };
  }

  async function gerarComIA() {
    if (
      itensUniversais.length > 0 &&
      !window.confirm(
        "Gerar novamente substituirá os itens atuais pelos identificados pela IA e consumirá 1 crédito de IA. Deseja continuar?",
      )
    ) {
      return;
    }

    setGerando(true);
    setErro("");
    setSucesso("");
    setAlertas([]);

    try {
      const res = await fetch("/api/chat-edital/dimensionamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editalId,
          force: true,
          documentContext: documentContext ?? "",
        }),
      });

      const data = (await res.json()) as ApiResponse;

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Não foi possível gerar com IA.");
      }

      const dim = data.dimensionamento;
      const itens = Array.isArray(dim?.itens)
        ? dim.itens.map(normalizarItemUniversal)
        : [];

      setItensUniversais(itens);
      setResumoEscopo(dim?.resumo_escopo ?? "");
      setPremissas(Array.isArray(dim?.premissas) ? dim.premissas : []);
      setAlertas(Array.isArray(data.alertas) ? data.alertas : []);

      if (data.modo === "ia") {
        window.dispatchEvent(new Event("ai_credit_used"));
      }

      setSucesso(
        `${itens.length} itens identificados e salvos. Revise os itens marcados como pendentes.`,
      );
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Erro inesperado ao gerar com IA.",
      );
    } finally {
      setGerando(false);
    }
  }

  async function salvar() {
    setSalvando(true);
    setErro("");
    setSucesso("");

    try {
      const itens = itensUniversais.map(prepararItemParaSalvar);

      const res = await fetch("/api/chat-edital/dimensionamento/salvar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editalId,
          resumoEscopo,
          blocos,
          dimensionamento: montarDimensionamento(itens),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Não foi possível salvar.");
      }

      setItensUniversais(itens);
      setSucesso("Dimensionamento salvo com sucesso.");
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Erro ao salvar as alterações.",
      );
    } finally {
      setSalvando(false);
    }
  }

  async function exportarExcel() {
    setExportando(true);
    setErro("");
    setSucesso("");

    try {
      const itens = itensUniversais.map(prepararItemParaSalvar);

      const res = await fetch(`/api/editais/${editalId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: tituloEdital ?? null,
          valorEstimado: valorEstimado ?? null,
          dimensionamento: montarDimensionamento(itens),
        }),
      });

      if (!res.ok) {
        let mensagem = `Não foi possível exportar o Excel (erro ${res.status}).`;
        try {
          const data = await res.json();
          mensagem = data.error || mensagem;
        } catch {}
        throw new Error(mensagem);
      }

      const arquivo = await res.blob();
      const url = window.URL.createObjectURL(arquivo);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dimensionamento_${editalId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSucesso("Planilha Excel estilizada gerada com sucesso.");
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Erro inesperado ao exportar a planilha.",
      );
    } finally {
      setExportando(false);
    }
  }

  const totalUniversalMensal = somarNaoNulos(
    itensUniversais.map(custoMensalItem),
  );

  const totalUniversalEstimado = somarNaoNulos(
    itensUniversais.map(subtotalItem),
  );

  const totalPendentes = itensUniversais.filter(
    (item) =>
      item.requer_validacao === true ||
      quantidadeItem(item) === null ||
      precoItem(item) === null,
  ).length;

  return (
    <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-950 dark:text-white">
            Planilha de Dimensionamento
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Edite quantidades e preços. Os custos mensais são recalculados
            automaticamente.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void gerarComIA()}
            disabled={ocupado || isLoading}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {gerando ? "Lendo o edital..." : "Gerar com IA"}
          </button>

          <button
            type="button"
            onClick={() => void salvar()}
            disabled={ocupado || isLoading}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>

          <button
            type="button"
            onClick={() => void exportarExcel()}
            disabled={ocupado || isLoading}
            className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {exportando ? "Exportando..." : "Exportar para Excel"}
          </button>

          <button
            type="button"
            onClick={() => void carregar()}
            disabled={isLoading || ocupado}
            className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {isLoading ? "Atualizando..." : "Recarregar"}
          </button>
        </div>
      </header>

      {erro && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
        >
          {erro}
        </div>
      )}

      {sucesso && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
        >
          {sucesso}
        </div>
      )}

      {alertas.length > 0 && (
        <div className="max-h-56 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <h4 className="mb-2 font-semibold">Alertas e pendências da leitura</h4>
          <ul className="list-inside list-disc space-y-1">
            {alertas.map((alerta, index) => (
              <li key={`${index}-${alerta}`}>{alerta}</li>
            ))}
          </ul>
        </div>
      )}

      {isLoading ? (
        <p className="p-8 text-center text-sm text-slate-500">
          Carregando dimensionamento...
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Dados gerais do dimensionamento
              </h3>
              <p className="text-sm text-slate-500">
                Informações gerais e premissas utilizadas na composição.
              </p>
            </div>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Resumo do escopo
              <textarea
                value={resumoEscopo}
                onChange={(e) => setResumoEscopo(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="Descreva o escopo do dimensionamento..."
              />
            </label>

            {premissas.length > 0 && (
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Premissas identificadas
                </h4>
                <ul className="list-inside list-disc space-y-1 text-sm text-slate-600 dark:text-slate-400">
                  {premissas.map((premissa, index) => (
                    <li key={`${index}-${premissa}`}>{premissa}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Itens do dimensionamento
                </h3>
                <p className="text-sm text-slate-500">
                  Cadastre e ajuste os custos por grupo, periodicidade e
                  quantidade.
                </p>
              </div>

              <button
                type="button"
                onClick={adicionarItemUniversal}
                className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                + Adicionar item
              </button>
            </div>

            {itensUniversais.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                Nenhum item no dimensionamento. Clique em &quot;Gerar com
                IA&quot; para a leitura do edital ou adicione um item
                manualmente.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-300 border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <th className="p-3 text-left">Descrição</th>
                      <th className="p-3 text-left">Grupo</th>
                      <th className="p-3 text-left">Unidade</th>
                      <th className="p-3 text-right">Quantidade</th>
                      <th className="p-3 text-right">Preço unitário</th>
                      <th className="p-3 text-left">Periodicidade</th>
                      <th className="p-3 text-right">Depr. (meses)</th>
                      <th className="p-3 text-right">Subtotal</th>
                      <th className="p-3 text-right">Custo mensal</th>
                      <th className="p-3 text-center">Ação</th>
                    </tr>
                  </thead>

                  <tbody>
                    {itensUniversais.map((item) => {
                      const quantidade = quantidadeItem(item);
                      const preco = precoItem(item);
                      const subtotal = subtotalItem(item);
                      const custoMensal = custoMensalItem(item);
                      const periodicidade = normalizarPeriodicidade(
                        item.periodicidade,
                      );

                      const motivos: string[] = [];
                      if (quantidade === null) motivos.push("quantidade");
                      if (preco === null) motivos.push("preço");

                      const pendente =
                        item.requer_validacao === true || motivos.length > 0;

                      return (
                        <tr
                          key={item.id}
                          className="border-t border-slate-200 align-top text-slate-800 dark:border-slate-700 dark:text-slate-200"
                        >
                          <td className="p-2">
                            <input
                              value={item.item ?? item.nome ?? ""}
                              onChange={(e) =>
                                atualizarItemUniversal(item.id!, {
                                  item: e.target.value,
                                  nome: e.target.value,
                                })
                              }
                              className="w-56 rounded border border-slate-300 bg-transparent p-2 dark:border-slate-600"
                            />

                            {pendente && (
                              <span className="mt-1 block text-xs text-amber-600">
                                {motivos.length > 0
                                  ? `Pendente: ${motivos.join(" e ")}`
                                  : "Requer validação"}
                                {item.requer_validacao === true && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      atualizarItemUniversal(item.id!, {
                                        requer_validacao: false,
                                      })
                                    }
                                    className="ml-2 underline hover:text-amber-800"
                                  >
                                    Marcar como validado
                                  </button>
                                )}
                              </span>
                            )}

                            {(item.pagina_origem || item.trecho_origem) && (
                              <span
                                className="mt-1 block max-w-56 text-xs text-slate-500"
                                title={item.trecho_origem ?? ""}
                              >
                                Edital
                                {item.pagina_origem
                                  ? `, p. ${item.pagina_origem}`
                                  : ""}
                                {item.trecho_origem
                                  ? `: “${item.trecho_origem.slice(0, 90)}${
                                      item.trecho_origem.length > 90 ? "…" : ""
                                    }”`
                                  : ""}
                              </span>
                            )}

                            {item.observacoes && (
                              <span className="mt-1 block text-xs text-slate-500">
                                {item.observacoes}
                              </span>
                            )}

                            {item.fornecido_por === "contratante" && (
                              <span className="mt-1 block text-xs font-semibold text-sky-600">
                                Fornecido pela contratante
                              </span>
                            )}
                          </td>

                          <td className="p-2">
                            <select
                              value={normalizarGrupo(item.grupo)}
                              onChange={(e) =>
                                atualizarItemUniversal(item.id!, {
                                  grupo: e.target.value,
                                })
                              }
                              className="w-44 rounded border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900"
                            >
                              {GRUPOS.map((grupo) => (
                                <option key={grupo.value} value={grupo.value}>
                                  {grupo.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="p-2">
                            <input
                              value={item.unidade ?? ""}
                              onChange={(e) =>
                                atualizarItemUniversal(item.id!, {
                                  unidade: e.target.value,
                                })
                              }
                              className="w-16 rounded border border-slate-300 bg-transparent p-2 dark:border-slate-600"
                            />
                          </td>

                          <td className="p-2 text-right">
                            <NumInput
                              value={quantidade}
                              onChange={(n) =>
                                atualizarItemUniversal(item.id!, {
                                  quantidade: n,
                                  quantidade_padrao: n,
                                })
                              }
                            />
                          </td>

                          <td className="p-2 text-right">
                            <NumInput
                              step="0.01"
                              value={preco}
                              onChange={(n) =>
                                atualizarItemUniversal(item.id!, {
                                  preco_unitario_estimado: n,
                                  preco_unitario: n,
                                })
                              }
                            />
                          </td>

                          <td className="p-2">
                            <select
                              value={periodicidade}
                              onChange={(e) =>
                                atualizarItemUniversal(item.id!, {
                                  periodicidade: e.target.value,
                                })
                              }
                              className="w-36 rounded border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900"
                            >
                              {PERIODICIDADES.map((periodo) => (
                                <option key={periodo.value} value={periodo.value}>
                                  {periodo.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="p-2 text-right">
                            {periodicidade === "DEPRECIACAO" ? (
                              <NumInput
                                width="w-16"
                                value={numeroOuNull(item.depreciacao_meses)}
                                onChange={(n) =>
                                  atualizarItemUniversal(item.id!, {
                                    depreciacao_meses: n,
                                  })
                                }
                              />
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="p-2 text-right font-semibold">
                            {subtotal === null ? "—" : brl(subtotal)}
                          </td>

                          <td className="p-2 text-right font-semibold text-red-600">
                            {custoMensal === null ? "—" : brl(custoMensal)}
                          </td>

                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removerItemUniversal(item.id!)}
                              className="rounded px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                              aria-label="Remover item"
                              title="Remover item"
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-sm text-slate-500">
                  Total estimado dos itens
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                  {brl(totalUniversalEstimado)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-sm text-slate-500">
                  Custo mensal calculado dos itens
                </p>
                <p className="mt-1 text-xl font-bold text-red-600">
                  {brl(totalUniversalMensal)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-sm text-slate-500">
                  Itens pendentes de validação
                </p>
                <p
                  className={`mt-1 text-xl font-bold ${
                    totalPendentes > 0 ? "text-amber-600" : "text-emerald-600"
                  }`}
                >
                  {totalPendentes}
                </p>
              </div>
            </div>

            {totalPendentes > 0 && (
              <p className="text-xs text-slate-500">
                Os totais somam apenas itens com quantidade e preço informados.
              </p>
            )}
          </section>
        </>
      )}
    </section>
  );
}