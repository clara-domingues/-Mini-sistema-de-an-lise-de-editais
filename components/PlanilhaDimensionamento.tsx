
"use client";



import { useCallback, useEffect, useState } from "react";

import {

  brl,

  precoEfetivo,

  somaPorTipo,

  valorMensal,

  type TipoLinha,

} from "@/lib/dimensionamento";



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

  | "EXAMES"

  | "TREINAMENTOS"

  | "UNIFORMES"

  | "MATERIAIS"

  | "EQUIPAMENTOS"

  | "SERVICOS"

  | "BENEFICIOS"

  | "ENCARGOS"

  | "CUSTOS_INDIRETOS"

  | "OUTROS";



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

  blocos?: BlocoFuncao[];

  dimensionamento?: DimensionamentoUniversal;

}



const TH =

  "border border-black bg-neutral-200 px-2 py-1 text-center text-[12px] font-bold uppercase";



const TD = "border border-black px-2 py-1 text-[13px]";



const BAND =

  "border border-black bg-neutral-200 px-2 py-1 text-center text-[13px] font-bold uppercase";



const GRUPOS: { value: GrupoCusto; label: string }[] = [

  { value: "MAO_DE_OBRA", label: "Mão de obra" },

  { value: "EPI", label: "Equipamentos de proteção individual" },

  { value: "EXAMES", label: "Exames ocupacionais" },

  { value: "TREINAMENTOS", label: "Treinamentos" },

  { value: "UNIFORMES", label: "Uniformes" },

  { value: "MATERIAIS", label: "Materiais e insumos" },

  { value: "EQUIPAMENTOS", label: "Equipamentos" },

  { value: "SERVICOS", label: "Serviços" },

  { value: "BENEFICIOS", label: "Benefícios" },

  { value: "ENCARGOS", label: "Encargos" },

  { value: "CUSTOS_INDIRETOS", label: "Custos indiretos" },

  { value: "OUTROS", label: "Outros" },

];



const PERIODICIDADES: { value: Periodicidade; label: string }[] = [

  { value: "MENSAL", label: "Mensal" },

  { value: "ANUAL", label: "Anual" },

  { value: "UNICO", label: "Único" },

  { value: "POR_DEMANDA", label: "Por demanda" },

  { value: "DEPRECIACAO", label: "Depreciação" },

];



function numero(valor: unknown, fallback = 0): number {

  const n = Number(valor);

  return Number.isFinite(n) ? n : fallback;

}



function calcularCustoMensalUniversal(item: ItemUniversal): number {

  const quantidade = Math.max(

    0,

    numero(item.quantidade ?? item.quantidade_padrao),

  );



  const preco = Math.max(

    0,

    numero(item.preco_unitario_estimado ?? item.preco_unitario),

  );



  const subtotal = quantidade * preco;

  const periodicidade = item.periodicidade ?? "MENSAL";



  if (periodicidade === "ANUAL") return subtotal / 12;



  if (periodicidade === "DEPRECIACAO") {

    const meses = numero(item.depreciacao_meses);

    return meses > 0 ? subtotal / meses : 0;

  }



  if (periodicidade === "UNICO" || periodicidade === "POR_DEMANDA") {

    return 0;

  }



  return subtotal;

}



function normalizarItemUniversal(item: ItemUniversal): ItemUniversal {

  const quantidade = numero(

    item.quantidade ?? item.quantidade_padrao,

  );



  const preco = numero(

    item.preco_unitario_estimado ?? item.preco_unitario,

  );



  return {

    ...item,

    id:

      item.id ??

      `item-${Math.random().toString(36).slice(2, 10)}`,

    item: item.item ?? item.nome ?? "Item sem descrição",

    nome: item.nome ?? item.item ?? "Item sem descrição",

    grupo: item.grupo ?? item.tipo ?? "OUTROS",

    tipo: item.tipo ?? item.grupo ?? "OUTROS",

    categoria: item.categoria ?? "Geral",

    unidade: item.unidade ?? "UN",

    quantidade,

    quantidade_padrao: quantidade,

    preco_unitario_estimado: preco,

    preco_unitario: preco,

    periodicidade: item.periodicidade ?? "MENSAL",

    justificativa: item.justificativa ?? "",

    origem: item.origem ?? "manual",

    requer_validacao: item.requer_validacao === true,

  };

}



function NumInput({

  value,

  onChange,

  width = "w-20",

  step = "1",

}: {

  value: number;

  onChange: (n: number) => void;

  width?: string;

  step?: string;

}) {

  return (

    <input

      type="number"

      min="0"

      step={step}

      value={Number.isFinite(value) ? value : 0}

      onChange={(e) => {

        const n = e.target.value === "" ? 0 : Number(e.target.value);

        onChange(Number.isFinite(n) && n >= 0 ? n : 0);

      }}

      className={`${width} rounded bg-transparent px-1 text-right font-semibold text-red-600 outline-none focus:bg-yellow-100`}

    />

  );

}



export default function PlanilhaDimensionamento({

  editalId,

  logoUrl,

}: {

  editalId: string;

  logoUrl?: string | null;

}) {

  const [blocos, setBlocos] = useState<BlocoFuncao[]>([]);

  const [itensUniversais, setItensUniversais] = useState<ItemUniversal[]>([]);

  const [resumoEscopo, setResumoEscopo] = useState("");

  const [premissas, setPremissas] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);

  const [loadedEditalId, setLoadedEditalId] = useState<string | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [exportando, setExportando] = useState(false);

  const [erro, setErro] = useState("");

  const [sucesso, setSucesso] = useState("");



  const isLoading = loading || loadedEditalId !== editalId;



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



  function atualizarLinha(

    roleId: string,

    linhaId: string,

    patch: Partial<LinhaItem>,

  ) {

    setBlocos((prev) =>

      prev.map((bloco) =>

        bloco.role_id !== roleId

          ? bloco

          : {

              ...bloco,

              linhas: bloco.linhas.map((linha) =>

                linha.id === linhaId ? { ...linha, ...patch } : linha,

              ),

            },

      ),

    );

  }



  function atualizarItemUniversal(

    itemId: string,

    patch: Partial<ItemUniversal>,

  ) {

    setItensUniversais((prev) =>

      prev.map((item) =>

        item.id === itemId ? { ...item, ...patch } : item,

      ),

    );

  }



  function adicionarItemUniversal() {

    const novo = normalizarItemUniversal({

      id: `manual-${Date.now()}`,

      item: "Novo item",

      grupo: "OUTROS",

      unidade: "UN",

      quantidade: 1,

      preco_unitario_estimado: 0,

      periodicidade: "MENSAL",

      origem: "manual",

      requer_validacao: true,

    });



    setItensUniversais((prev) => [...prev, novo]);

  }



  function removerItemUniversal(itemId: string) {

    setItensUniversais((prev) =>

      prev.filter((item) => item.id !== itemId),

    );

  }



  async function salvar() {

    setSalvando(true);

    setErro("");

    setSucesso("");



    try {

      const itens = itensUniversais.map((item) => {

        const normalizado = normalizarItemUniversal(item);

        const quantidade = numero(

          normalizado.quantidade ?? normalizado.quantidade_padrao,

        );

        const preco = numero(

          normalizado.preco_unitario_estimado ??

            normalizado.preco_unitario,

        );



        return {

          ...normalizado,

          quantidade,

          quantidade_padrao: quantidade,

          preco_unitario_estimado: preco,

          preco_unitario: preco,

          subtotal: quantidade * preco,

          custo_mensal: calcularCustoMensalUniversal(normalizado),

        };

      });



      const valorTotalEstimado = itens.reduce(

        (total, item) => total + numero(item.subtotal),

        0,

      );



      const dimensionamento: DimensionamentoUniversal = {

        versao: 1,

        estrategia: "Dimensionamento universal",

        resumo_escopo: resumoEscopo,

        premissas,

        funcoes: blocos,

        itens,

        custos_indiretos: [],

        formacao_preco: {},

        valor_total_estimado: valorTotalEstimado,

      };



      const res = await fetch(

        "/api/chat-edital/dimensionamento/salvar",

        {

          method: "POST",

          headers: { "Content-Type": "application/json" },

          body: JSON.stringify({

            editalId,

            resumoEscopo,

            blocos,

            dimensionamento,

          }),

        },

      );



      const data = await res.json();



      if (!res.ok || !data.success) {

        throw new Error(data.error || "Não foi possível salvar.");

      }



      setItensUniversais(itens);

      setSucesso("Dimensionamento salvo com sucesso.");

    } catch (e) {

      setErro(

        e instanceof Error

          ? e.message

          : "Erro ao salvar as alterações.",

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
      const itens = itensUniversais.map((item) => {
        const normalizado = normalizarItemUniversal(item);
        const quantidade = numero(
          normalizado.quantidade ?? normalizado.quantidade_padrao,
        );
        const preco = numero(
          normalizado.preco_unitario_estimado ??
            normalizado.preco_unitario,
        );

        return {
          ...normalizado,
          quantidade,
          quantidade_padrao: quantidade,
          preco_unitario_estimado: preco,
          preco_unitario: preco,
          subtotal: quantidade * preco,
          custo_mensal: calcularCustoMensalUniversal(normalizado),
        };
      });

      const valorTotalEstimado = itens.reduce(
        (total, item) => total + numero(item.subtotal),
        0,
      );

      const dimensionamento: DimensionamentoUniversal = {
        versao: 1,
        estrategia: "Dimensionamento universal",
        resumo_escopo: resumoEscopo,
        premissas,
        funcoes: blocos,
        itens,
        custos_indiretos: [],
        formacao_preco: {},
        valor_total_estimado: valorTotalEstimado,
      };

      const res = await fetch(
        "/api/chat-edital/dimensionamento/exportar",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ editalId, dimensionamento }),
        },
      );

      if (!res.ok) {
        let mensagem = "Não foi possível exportar o Excel.";
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
      link.download = `dimensionamento-${editalId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSucesso("Planilha Excel gerada com sucesso.");
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

  const totalUniversalMensal = itensUniversais.reduce(

    (total, item) => total + calcularCustoMensalUniversal(item),

    0,

  );



  const totalUniversalEstimado = itensUniversais.reduce(

    (total, item) =>

      total +

      Math.max(0, numero(item.quantidade ?? item.quantidade_padrao)) *

        Math.max(

          0,

          numero(

            item.preco_unitario_estimado ?? item.preco_unitario,

          ),

        ),

    0,

  );



  const tabelaDireita = (

    titulo: string,

    linhas: LinhaItem[],

    total: number,

    bloco: BlocoFuncao,

  ) => (

    <table className="w-full border-collapse">

      <thead>

        <tr>

          <th colSpan={4} className={BAND}>

            {titulo} - {bloco.nome}

          </th>

        </tr>

        <tr>

          <th className={TH}>Descrição</th>

          <th className={TH}>Valor unit.</th>

          <th className={TH}>Depreciação</th>

          <th className={TH}>Valor mensal unitário</th>

        </tr>

      </thead>

      <tbody>

        {linhas.map((linha) => (

          <tr key={linha.id}>

            <td className={TD}>{linha.name}</td>

            <td className={`${TD} text-right`}>

              <NumInput

                step="0.01"

                value={precoEfetivo(linha)}

                onChange={(n) =>

                  atualizarLinha(bloco.role_id, linha.id, {

                    preco_override: n,

                  })

                }

              />

            </td>

            <td className={`${TD} text-center text-red-600`}>

              {linha.depreciacao_meses}

            </td>

            <td className={`${TD} text-right text-red-600`}>

              {brl(valorMensal(linha))}

            </td>

          </tr>

        ))}

        <tr>

          <td

            colSpan={3}

            className={`${TD} bg-neutral-200 text-right font-bold`}

          >

            TOTAL

          </td>

          <td

            className={`${TD} bg-neutral-200 text-right font-bold text-red-600`}

          >

            {brl(total)}

          </td>

        </tr>

      </tbody>

    </table>

  );



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

            onClick={() => void salvar()}

            disabled={salvando || isLoading}

            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"

          >

            {salvando ? "Salvando..." : "Salvar alterações"}

          </button>



          <button



            type="button"



            onClick={() => void exportarExcel()}



            disabled={exportando || isLoading || salvando}



            className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"



          >



            {exportando ? "Exportando..." : "Exportar para Excel"}



          </button>




          <button

            type="button"

            onClick={() => void carregar()}

            disabled={isLoading || salvando}

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

                Nenhum item universal carregado. Você pode adicionar um item

                manualmente ou aguardar a integração da leitura dos itens

                salvos.

              </div>

            ) : (

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">

                <table className="w-full min-w-[1050px] border-collapse text-sm">

                  <thead>

                    <tr className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">

                      <th className="p-3 text-left">Descrição</th>

                      <th className="p-3 text-left">Grupo</th>

                      <th className="p-3 text-left">Unidade</th>

                      <th className="p-3 text-right">Quantidade</th>

                      <th className="p-3 text-right">Preço unitário</th>

                      <th className="p-3 text-left">Periodicidade</th>

                      <th className="p-3 text-right">Subtotal</th>

                      <th className="p-3 text-right">Custo mensal</th>

                      <th className="p-3 text-center">Ação</th>

                    </tr>

                  </thead>

                  <tbody>

                    {itensUniversais.map((item) => {

                      const quantidade = numero(

                        item.quantidade ?? item.quantidade_padrao,

                      );

                      const preco = numero(

                        item.preco_unitario_estimado ??

                          item.preco_unitario,

                      );

                      const subtotal = quantidade * preco;



                      return (

                        <tr

                          key={item.id}

                          className="border-t border-slate-200 text-slate-800 dark:border-slate-700 dark:text-slate-200"

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

                              className="w-52 rounded border border-slate-300 bg-transparent p-2 dark:border-slate-600"

                            />

                            {item.requer_validacao && (

                              <span className="mt-1 block text-xs text-amber-600">

                                Requer validação

                              </span>

                            )}

                          </td>



                          <td className="p-2">

                            <select

                              value={String(item.grupo ?? "OUTROS")}

                              onChange={(e) =>

                                atualizarItemUniversal(item.id!, {

                                  grupo: e.target.value,

                                  tipo: e.target.value,

                                })

                              }

                              className="w-44 rounded border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900"

                            >

                              {GRUPOS.map((grupo) => (

                                <option

                                  key={grupo.value}

                                  value={grupo.value}

                                >

                                  {grupo.label}

                                </option>

                              ))}

                            </select>

                          </td>



                          <td className="p-2">

                            <input

                              value={item.unidade ?? "UN"}

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

                              value={String(

                                item.periodicidade ?? "MENSAL",

                              )}

                              onChange={(e) =>

                                atualizarItemUniversal(item.id!, {

                                  periodicidade: e.target.value,

                                })

                              }

                              className="w-36 rounded border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900"

                            >

                              {PERIODICIDADES.map((periodo) => (

                                <option

                                  key={periodo.value}

                                  value={periodo.value}

                                >

                                  {periodo.label}

                                </option>

                              ))}

                            </select>

                          </td>



                          <td className="p-2 text-right font-semibold">

                            {brl(subtotal)}

                          </td>



                          <td className="p-2 text-right font-semibold text-red-600">

                            {brl(calcularCustoMensalUniversal(item))}

                          </td>



                          <td className="p-2 text-center">

                            <button

                              type="button"

                              onClick={() =>

                                removerItemUniversal(item.id!)

                              }

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



            <div className="grid gap-3 sm:grid-cols-2">

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

            </div>

          </section>



          <section className="space-y-4">

            <div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white">

                Dimensionamento por função

              </h3>

              <p className="text-sm text-slate-500">

                Estrutura anterior mantida para EPIs, exames e treinamentos.

              </p>

            </div>



            {blocos.length === 0 ? (

              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">

                Nenhuma função cadastrada. Importe a planilha modelo para o

                catálogo.

              </div>

            ) : (

              <div className="space-y-10">

                {blocos.map((bloco) => {

                  const epis = bloco.linhas.filter(

                    (linha) => linha.tipo === "EPI",

                  );

                  const exames = bloco.linhas.filter(

                    (linha) => linha.tipo === "EXAME",

                  );

                  const treinamentos = bloco.linhas.filter(

                    (linha) => linha.tipo === "TREINAMENTO",

                  );



                  const totalEpi = somaPorTipo(bloco.linhas, "EPI");

                  const totalExames = somaPorTipo(

                    bloco.linhas,

                    "EXAME",

                  );

                  const totalTreinamentos = somaPorTipo(

                    bloco.linhas,

                    "TREINAMENTO",

                  );



                  return (

                    <div

                      key={bloco.role_id}

                      className="overflow-x-auto rounded bg-white p-3 text-black shadow-sm ring-1 ring-slate-300"

                    >

                      <div className="mb-2 flex items-center border border-black bg-neutral-200 px-3 py-2">

                        <div className="w-28 shrink-0">

                          {logoUrl ? (

                            // eslint-disable-next-line @next/next/no-img-element

                            <img

                              src={logoUrl}

                              alt="Logo"

                              className="h-10 object-contain"

                            />

                          ) : null}

                        </div>

                        <h4 className="flex-1 text-center text-lg font-extrabold uppercase tracking-wide">

                          {bloco.nome}

                        </h4>

                        <div className="w-28 shrink-0" />

                      </div>



                      <div className="grid min-w-[900px] grid-cols-1 gap-4 lg:grid-cols-2">

                        <div>

                          <table className="w-full border-collapse">

                            <thead>

                              <tr>

                                <th colSpan={5} className={BAND}>

                                  Equipamentos de proteção individual

                                </th>

                              </tr>

                              <tr>

                                <th className={TH}>Descrição</th>

                                <th className={TH}>Quant.</th>

                                <th className={TH}>Valor unit.</th>

                                <th className={TH}>Depreciação</th>

                                <th className={TH}>

                                  Valor mensal unitário

                                </th>

                              </tr>

                            </thead>

                            <tbody>

                              {epis.map((linha) => (

                                <tr key={linha.id}>

                                  <td className={TD}>{linha.name}</td>

                                  <td className={`${TD} text-center`}>

                                    <NumInput

                                      width="w-14"

                                      value={linha.quantidade_padrao}

                                      onChange={(n) =>

                                        atualizarLinha(

                                          bloco.role_id,

                                          linha.id,

                                          { quantidade_padrao: n },

                                        )

                                      }

                                    />

                                  </td>

                                  <td className={`${TD} text-right`}>

                                    <NumInput

                                      step="0.01"

                                      value={precoEfetivo(linha)}

                                      onChange={(n) =>

                                        atualizarLinha(

                                          bloco.role_id,

                                          linha.id,

                                          { preco_override: n },

                                        )

                                      }

                                    />

                                  </td>

                                  <td

                                    className={`${TD} text-center text-red-600`}

                                  >

                                    {linha.depreciacao_meses}

                                  </td>

                                  <td

                                    className={`${TD} text-right text-red-600`}

                                  >

                                    {brl(valorMensal(linha))}

                                  </td>

                                </tr>

                              ))}



                              <tr>

                                <td

                                  colSpan={4}

                                  className={`${TD} bg-neutral-200 text-right font-bold`}

                                >

                                  TOTAL

                                </td>

                                <td

                                  className={`${TD} bg-neutral-200 text-right font-bold text-red-600`}

                                >

                                  {brl(totalEpi)}

                                </td>

                              </tr>



                              <tr>

                                <td

                                  colSpan={2}

                                  className={`${TD} font-bold`}

                                >

                                  Recebe insalubridade?

                                </td>

                                <td

                                  className={`${TD} text-center font-bold text-red-600`}

                                >

                                  {bloco.insalubridade_pct > 0

                                    ? "SIM"

                                    : "Não"}

                                </td>

                                <td className={`${TD} font-bold`}>

                                  Percentual:

                                </td>

                                <td

                                  className={`${TD} text-center font-bold text-red-600`}

                                >

                                  {bloco.insalubridade_pct}%

                                </td>

                              </tr>



                              <tr>

                                <td

                                  colSpan={2}

                                  className={`${TD} font-bold`}

                                >

                                  Recebe periculosidade?

                                </td>

                                <td

                                  className={`${TD} text-center font-bold text-red-600`}

                                >

                                  {bloco.periculosidade_pct > 0

                                    ? "SIM"

                                    : "Não"}

                                </td>

                                <td className={`${TD} font-bold`}>

                                  Percentual:

                                </td>

                                <td

                                  className={`${TD} text-center font-bold text-red-600`}

                                >

                                  {bloco.periculosidade_pct}%

                                </td>

                              </tr>

                            </tbody>

                          </table>

                        </div>



                        <div className="space-y-4">

                          {tabelaDireita(

                            "Exames",

                            exames,

                            totalExames,

                            bloco,

                          )}

                          {tabelaDireita(

                            "Treinamentos específicos",

                            treinamentos,

                            totalTreinamentos,

                            bloco,

                          )}



                          <div className="flex justify-between border border-black bg-neutral-200 px-3 py-1.5 text-sm font-extrabold">

                            <span>

                              CUSTO MENSAL POR POSTO (EPIs + exames +

                              treinamentos)

                            </span>

                            <span className="text-red-600">

                              {brl(

                                totalEpi +

                                  totalExames +

                                  totalTreinamentos,

                              )}

                            </span>

                          </div>

                        </div>

                      </div>

                    </div>

                  );

                })}

              </div>

            )}

          </section>

        </>

      )}

    </section>

  );

}