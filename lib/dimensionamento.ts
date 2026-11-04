/**
 * Motor universal de dimensionamento do BidMaster AI.
 *
 * Mantém compatibilidade com a planilha atual de:
 * - EPI
 * - EXAME
 * - TREINAMENTO
 *
 * E prepara a estrutura para:
 * - Mão de obra
 * - Materiais
 * - Uniformes
 * - Equipamentos
 * - Serviços
 * - Benefícios
 * - Encargos
 * - Custos indiretos
 * - Formação de preço
 */

export type TipoLinha = "EPI" | "EXAME" | "TREINAMENTO";

export type GrupoCusto =
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

export type PeriodicidadeCusto =
  | "MENSAL"
  | "ANUAL"
  | "UNICO"
  | "DEPRECIACAO";

export type OrigemItem =
  | "catalogo"
  | "edital"
  | "manual"
  | "calculado";

export interface LinhaCalc {
  tipo: TipoLinha;
  quantidade_padrao: number;
  valor_unit: number;
  preco_override?: number | null;
  depreciacao_meses: number;
}

/**
 * Estrutura universal de um item de dimensionamento.
 *
 * Compatível com os campos já utilizados no JSON
 * da tabela edital_dimensionamentos.
 */
export interface ItemDimensionamento {
  id?: string;
  catalog_item_id?: string | null;

  item: string;
  nome?: string;

  grupo: GrupoCusto;
  tipo: string;
  categoria?: string | null;

  unidade: string;
  quantidade: number | null;

  preco_unitario_estimado: number | null;
  preco_unitario?: number | null;

  subtotal: number | null;
  custo_mensal?: number | null;

  periodicidade: PeriodicidadeCusto;

  depreciacao_meses?: number | null;

  justificativa?: string;
  origem: OrigemItem | string;

  requer_validacao: boolean;

  observacoes?: string;
}

/**
 * Estrutura de função/posto operacional.
 */
export interface FuncaoDimensionamento {
  role_id: string;
  nome: string;
  escala?: string | null;

  quantidade_postos: number;

  salario_base?: number | null;
  insalubridade_pct: number;
  periculosidade_pct: number;

  linhas: LinhaItemUniversal[];
}

/**
 * Linha universal vinculada a uma função.
 */
export interface LinhaItemUniversal {
  id: string;
  catalog_item_id?: string | null;

  tipo: GrupoCusto;
  name: string;

  unidade?: string;
  quantidade_padrao: number;

  valor_unit: number;
  preco_override?: number | null;

  depreciacao_meses: number;

  periodicidade?: PeriodicidadeCusto;

  requer_validacao?: boolean;
}

/**
 * Estrutura geral do dimensionamento.
 */
export interface DimensionamentoUniversal {
  versao: 1;

  edital_id: string;

  resumo_escopo: string;

  premissas: string[];

  funcoes: FuncaoDimensionamento[];

  itens: ItemDimensionamento[];

  custos_indiretos: CustoIndireto[];

  formacao_preco: FormacaoPreco;

  alertas: string[];
}

/**
 * Custos indiretos e adicionais.
 */
export interface CustoIndireto {
  id: string;
  descricao: string;

  categoria: string;

  valor: number;

  periodicidade: PeriodicidadeCusto;

  observacao?: string;
}

/**
 * Parâmetros para formação de preço.
 */
export interface FormacaoPreco {
  percentual_lucro: number;
  percentual_impostos: number;
  percentual_despesas_administrativas: number;

  custo_total_mensal: number;
  preco_final_mensal: number;
}

/**
 * Resultado de cálculo de um item.
 */
export interface ResultadoItem {
  quantidade: number | null;
  precoUnitario: number | null;

  subtotal: number | null;

  custoMensal: number | null;

  requerValidacao: boolean;
}

/* =========================================================
   FUNÇÕES DE COMPATIBILIDADE COM A PLANILHA ATUAL
========================================================= */

/**
 * Retorna o preço efetivamente utilizado.
 *
 * Se houver preço sobrescrito manualmente,
 * utiliza o preço informado pelo usuário.
 */
export const precoEfetivo = (linha: LinhaCalc): number => {
  const preco =
    linha.preco_override !== null &&
    linha.preco_override !== undefined
      ? linha.preco_override
      : linha.valor_unit;

  return numeroValido(preco) ? preco : 0;
};

/**
 * Calcula o valor mensal de uma linha.
 *
 * Fórmula mantida da planilha atual:
 *
 * quantidade × preço unitário ÷ depreciação
 */
export const valorMensal = (linha: LinhaCalc): number => {
  const quantidade = numeroSeguro(linha.quantidade_padrao);
  const preco = precoEfetivo(linha);
  const depreciacao = numeroSeguro(linha.depreciacao_meses);

  if (depreciacao <= 0) {
    return 0;
  }

  return arredondarMoeda(
    (quantidade * preco) / depreciacao
  );
};

/**
 * Soma os valores mensais de um determinado tipo.
 */
export const somaPorTipo = <T extends LinhaCalc>(
  linhas: T[],
  tipo: TipoLinha
): number => {
  return arredondarMoeda(
    linhas
      .filter((linha) => linha.tipo === tipo)
      .reduce((total, linha) => total + valorMensal(linha), 0)
  );
};

/**
 * Formata valores em reais.
 */
export const brl = (valor: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numeroValido(valor) ? valor : 0);
};

/* =========================================================
   FUNÇÕES DO MOTOR UNIVERSAL
========================================================= */

/**
 * Verifica se um valor é numérico e finito.
 */
export function numeroValido(
  valor: unknown
): valor is number {
  return (
    typeof valor === "number" &&
    Number.isFinite(valor)
  );
}

/**
 * Converte valores inválidos em zero.
 */
export function numeroSeguro(valor: unknown): number {
  const numero =
    typeof valor === "number"
      ? valor
      : Number(valor);

  return Number.isFinite(numero) && numero >= 0
    ? numero
    : 0;
}

/**
 * Arredonda valores monetários para duas casas decimais.
 */
export function arredondarMoeda(valor: number): number {
  if (!Number.isFinite(valor)) {
    return 0;
  }

  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/**
 * Retorna o preço unitário efetivo de um item universal.
 */
export function obterPrecoUnitario(
  item: Pick<
    ItemDimensionamento,
    "preco_unitario_estimado" | "preco_unitario"
  >
): number | null {
  const valor =
    item.preco_unitario_estimado ??
    item.preco_unitario;

  if (valor === null || valor === undefined) {
    return null;
  }

  const numero = Number(valor);

  return Number.isFinite(numero) && numero >= 0
    ? numero
    : null;
}

/**
 * Calcula o custo mensal equivalente de acordo
 * com a periodicidade do item.
 *
 * MENSAL:
 * quantidade × preço
 *
 * ANUAL:
 * quantidade × preço ÷ 12
 *
 * UNICO:
 * quantidade × preço
 *
 * DEPRECIACAO:
 * quantidade × preço ÷ meses de depreciação
 */
export function calcularCustoMensal(
  quantidade: number,
  precoUnitario: number,
  periodicidade: PeriodicidadeCusto,
  depreciacaoMeses?: number | null
): number {
  const qtd = numeroSeguro(quantidade);
  const preco = numeroSeguro(precoUnitario);

  const subtotal = qtd * preco;

  switch (periodicidade) {
    case "MENSAL":
      return arredondarMoeda(subtotal);

    case "ANUAL":
      return arredondarMoeda(subtotal / 12);

    case "UNICO":
      return arredondarMoeda(subtotal);

    case "DEPRECIACAO": {
      const meses = numeroSeguro(depreciacaoMeses);

      if (meses <= 0) {
        return 0;
      }

      return arredondarMoeda(subtotal / meses);
    }

    default:
      return 0;
  }
}

/**
 * Calcula um item universal.
 *
 * Não inventa quantidade ou preço.
 * Quando faltam informações, mantém a validação pendente.
 */
export function calcularItemDimensionamento(
  item: Partial<ItemDimensionamento>
): ResultadoItem {
  const quantidade =
    item.quantidade === null ||
    item.quantidade === undefined
      ? null
      : numeroValido(item.quantidade) &&
          item.quantidade >= 0
        ? item.quantidade
        : null;

  const precoUnitario = obterPrecoUnitario({
    preco_unitario_estimado:
      item.preco_unitario_estimado ?? null,

    preco_unitario:
      item.preco_unitario ?? null,
  });

  const subtotal =
    quantidade !== null && precoUnitario !== null
      ? arredondarMoeda(quantidade * precoUnitario)
      : null;

  const periodicidade =
    item.periodicidade ?? "MENSAL";

  const custoMensal =
    quantidade !== null && precoUnitario !== null
      ? calcularCustoMensal(
          quantidade,
          precoUnitario,
          periodicidade,
          item.depreciacao_meses
        )
      : null;

  const nome = String(
    item.item ?? item.nome ?? ""
  ).trim();

  const unidade = String(
    item.unidade ?? ""
  ).trim();

  const requerValidacao =
    !nome ||
    !unidade ||
    quantidade === null ||
    precoUnitario === null ||
    item.requer_validacao === true;

  return {
    quantidade,
    precoUnitario,
    subtotal,
    custoMensal,
    requerValidacao,
  };
}

/**
 * Soma os custos mensais dos itens universais.
 *
 * Itens sem quantidade ou preço não entram no total.
 */
export function somarCustosMensais(
  itens: Partial<ItemDimensionamento>[]
): number {
  const total = itens.reduce((acumulado, item) => {
    const resultado = calcularItemDimensionamento(item);

    if (resultado.custoMensal === null) {
      return acumulado;
    }

    return acumulado + resultado.custoMensal;
  }, 0);

  return arredondarMoeda(total);
}

/**
 * Soma os subtotais dos itens universais.
 */
export function somarSubtotais(
  itens: Partial<ItemDimensionamento>[]
): number {
  const total = itens.reduce((acumulado, item) => {
    const resultado = calcularItemDimensionamento(item);

    if (resultado.subtotal === null) {
      return acumulado;
    }

    return acumulado + resultado.subtotal;
  }, 0);

  return arredondarMoeda(total);
}

/**
 * Identifica itens que precisam de validação.
 */
export function identificarPendencias(
  itens: Partial<ItemDimensionamento>[]
): Partial<ItemDimensionamento>[] {
  return itens.filter((item) => {
    return calcularItemDimensionamento(item).requerValidacao;
  });
}

/**
 * Calcula o custo mensal total de uma função/posto.
 */
export function calcularCustoFuncao(
  funcao: FuncaoDimensionamento
): number {
  const total = funcao.linhas.reduce((acumulado, linha) => {
    const preco =
      linha.preco_override ??
      linha.valor_unit;

    const periodicidade =
      linha.periodicidade ?? "DEPRECIACAO";

    const custo = calcularCustoMensal(
      linha.quantidade_padrao,
      preco,
      periodicidade,
      linha.depreciacao_meses
    );

    return acumulado + custo;
  }, 0);

  return arredondarMoeda(total);
}

/**
 * Calcula o custo mensal de todas as funções.
 */
export function calcularCustoTotalFuncoes(
  funcoes: FuncaoDimensionamento[]
): number {
  const total = funcoes.reduce((acumulado, funcao) => {
    const quantidadePostos = numeroSeguro(
      funcao.quantidade_postos
    );

    return (
      acumulado +
      calcularCustoFuncao(funcao) * quantidadePostos
    );
  }, 0);

  return arredondarMoeda(total);
}

/**
 * Calcula o custo total mensal do dimensionamento.
 */
export function calcularCustoTotalMensal(
  dimensionamento: Pick<
    DimensionamentoUniversal,
    "funcoes" | "itens" | "custos_indiretos"
  >
): number {
  const custoFuncoes = calcularCustoTotalFuncoes(
    dimensionamento.funcoes
  );

  const custoItens = somarCustosMensais(
    dimensionamento.itens
  );

  const custoIndireto = dimensionamento.custos_indiretos.reduce(
    (total, custo) => {
      switch (custo.periodicidade) {
        case "MENSAL":
          return total + numeroSeguro(custo.valor);

        case "ANUAL":
          return total + numeroSeguro(custo.valor) / 12;

        case "UNICO":
          return total + numeroSeguro(custo.valor);

        case "DEPRECIACAO":
          return total + numeroSeguro(custo.valor);

        default:
          return total;
      }
    },
    0
  );

  return arredondarMoeda(
    custoFuncoes + custoItens + custoIndireto
  );
}

/**
 * Calcula o preço final considerando percentuais
 * de despesas administrativas, impostos e lucro.
 *
 * Os percentuais são aplicados sobre o custo base.
 */
export function calcularFormacaoPreco(
  custoMensal: number,
  percentualDespesasAdministrativas: number,
  percentualImpostos: number,
  percentualLucro: number
): FormacaoPreco {
  const custo = numeroSeguro(custoMensal);

  const despesas = numeroSeguro(
    percentualDespesasAdministrativas
  );

  const impostos = numeroSeguro(percentualImpostos);

  const lucro = numeroSeguro(percentualLucro);

  const custoComDespesas =
    custo * (1 + despesas / 100);

  const custoComImpostos =
    custoComDespesas * (1 + impostos / 100);

  const precoFinal =
    custoComImpostos * (1 + lucro / 100);

  return {
    percentual_lucro: lucro,
    percentual_impostos: impostos,
    percentual_despesas_administrativas: despesas,

    custo_total_mensal: arredondarMoeda(custo),

    preco_final_mensal: arredondarMoeda(precoFinal),
  };
}

/**
 * Cria uma estrutura universal vazia.
 */
export function criarDimensionamentoVazio(
  editalId: string
): DimensionamentoUniversal {
  return {
    versao: 1,

    edital_id: editalId,

    resumo_escopo: "",

    premissas: [],

    funcoes: [],

    itens: [],

    custos_indiretos: [],

    formacao_preco: {
      percentual_lucro: 0,
      percentual_impostos: 0,
      percentual_despesas_administrativas: 0,

      custo_total_mensal: 0,
      preco_final_mensal: 0,
    },

    alertas: [],
  };
}