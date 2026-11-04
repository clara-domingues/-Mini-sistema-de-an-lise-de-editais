
import { NextResponse } from "next/server";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import { cookies } from "next/headers";
import { getTenantId } from "@/lib/tenant";

type Registro = Record<string, unknown>;

type ItemDimensionamento = Registro & {
  id?: string;
  catalog_item_id?: string | null;
  item?: string;
  nome?: string;
  grupo?: string;
  tipo?: string;
  categoria?: string;
  unidade?: string;
  quantidade?: number | null;
  quantidade_padrao?: number | null;
  preco_unitario?: number | null;
  preco_unitario_estimado?: number | null;
  subtotal?: number | null;
  custo_mensal?: number | null;
  justificativa?: string;
  origem?: string;
  periodicidade?: string;
  depreciacao_meses?: number | null;
  requer_validacao?: boolean;
};

type BlocoDimensionamento = Registro & {
  id?: string;
  role_id?: string;
  funcao?: string;
  nome?: string;
  escala?: string;
  quantidade?: number;
  insalubridade_pct?: number;
  periculosidade_pct?: number;
  itens?: ItemDimensionamento[];
  linhas?: ItemDimensionamento[];
};

type PayloadDimensionamento = Registro & {
  versao?: number;
  estrategia?: string;
  resumo_escopo?: string;
  premissas?: string[];
  funcoes?: BlocoDimensionamento[];
  blocos?: BlocoDimensionamento[];
  itens?: ItemDimensionamento[];
  custos_indiretos?: Registro[];
  formacao_preco?: Registro;
  valor_total_estimado?: number | null;
};

function numeroSeguro(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  const numero =
    typeof valor === "number"
      ? valor
      : Number(String(valor).replace(",", "."));

  return Number.isFinite(numero) ? numero : null;
}

function textoSeguro(valor: unknown, fallback = ""): string {
  return typeof valor === "string" ? valor.trim() : fallback;
}

function normalizarItem(item: ItemDimensionamento): ItemDimensionamento {
  const quantidade =
    numeroSeguro(item.quantidade) ??
    numeroSeguro(item.quantidade_padrao);

  const preco =
    numeroSeguro(item.preco_unitario_estimado) ??
    numeroSeguro(item.preco_unitario);

  const subtotalInformado = numeroSeguro(item.subtotal);

  const subtotal =
    subtotalInformado ??
    (quantidade !== null && preco !== null
      ? quantidade * preco
      : null);

  return {
    ...item,
    catalog_item_id: item.catalog_item_id ?? null,
    item: textoSeguro(item.item, textoSeguro(item.nome, "Item sem descrição")),
    nome: textoSeguro(item.nome, textoSeguro(item.item, "Item sem descrição")),
    grupo: textoSeguro(item.grupo, textoSeguro(item.tipo, "OUTROS")),
    tipo: textoSeguro(item.tipo, textoSeguro(item.grupo, "OUTROS")),
    categoria: textoSeguro(item.categoria, "Geral"),
    unidade: textoSeguro(item.unidade, "UN"),
    quantidade,
    quantidade_padrao: quantidade,
    preco_unitario_estimado: preco,
    preco_unitario: preco,
    subtotal,
    justificativa: textoSeguro(item.justificativa),
    origem: textoSeguro(item.origem, "manual"),
    periodicidade: textoSeguro(item.periodicidade, "MENSAL"),
    depreciacao_meses: numeroSeguro(item.depreciacao_meses),
    requer_validacao: item.requer_validacao === true,
  };
}

function normalizarBloco(
  bloco: BlocoDimensionamento,
): BlocoDimensionamento {
  const itensOriginais = Array.isArray(bloco.itens)
    ? bloco.itens
    : Array.isArray(bloco.linhas)
      ? bloco.linhas
      : [];

  return {
    ...bloco,
    id: textoSeguro(bloco.id),
    role_id: textoSeguro(bloco.role_id),
    funcao: textoSeguro(
      bloco.funcao,
      textoSeguro(bloco.nome, "Função não informada"),
    ),
    nome: textoSeguro(
      bloco.nome,
      textoSeguro(bloco.funcao, "Função não informada"),
    ),
    escala: textoSeguro(bloco.escala),
    quantidade: numeroSeguro(bloco.quantidade) ?? 1,
    insalubridade_pct:
      numeroSeguro(bloco.insalubridade_pct) ?? 0,
    periculosidade_pct:
      numeroSeguro(bloco.periculosidade_pct) ?? 0,
    itens: itensOriginais.map(normalizarItem),
  };
}

function extrairItensDosBlocos(
  blocos: BlocoDimensionamento[],
): ItemDimensionamento[] {
  return blocos.flatMap((bloco) =>
    (bloco.itens ?? []).map((item) => ({
      ...item,
      funcao: bloco.funcao ?? bloco.nome ?? "Função não informada",
      role_id: bloco.role_id ?? null,
      quantidade_funcao: bloco.quantidade ?? 1,
    })),
  );
}

function calcularTotal(itens: ItemDimensionamento[]): number {
  return itens.reduce((total, item) => {
    const subtotal = numeroSeguro(item.subtotal);
    return total + (subtotal ?? 0);
  }, 0);
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: "", ...options });
          },
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sessão expirada. Faça login novamente." },
        { status: 401 },
      );
    }

    const tenantId = await getTenantId(supabase);

    if (!tenantId) {
      return NextResponse.json(
        { error: "Sua conta não está associada a uma empresa." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      editalId?: string;
      resumoEscopo?: string;
      resumo_escopo?: string;
      itens?: ItemDimensionamento[];
      blocos?: BlocoDimensionamento[];
      dimensionamento?: PayloadDimensionamento;
    };

    const editalId = textoSeguro(body.editalId);

    if (!editalId) {
      return NextResponse.json(
        { error: "O identificador do edital não foi informado." },
        { status: 400 },
      );
    }

    const { data: edital, error: editalError } = await supabase
      .from("bids")
      .select("id")
      .eq("id", editalId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (editalError) {
      console.error("Erro ao consultar edital:", editalError);

      return NextResponse.json(
        { error: "Não foi possível validar o edital." },
        { status: 500 },
      );
    }

    if (!edital) {
      return NextResponse.json(
        { error: "Edital não encontrado para esta empresa." },
        { status: 404 },
      );
    }

    const payload = body.dimensionamento ?? {};

    const blocosRecebidos = Array.isArray(body.blocos)
      ? body.blocos
      : Array.isArray(payload.blocos)
        ? payload.blocos
        : Array.isArray(payload.funcoes)
          ? payload.funcoes
          : [];

    const blocos = blocosRecebidos.map(normalizarBloco);

    const itensRecebidos = Array.isArray(body.itens)
      ? body.itens
      : Array.isArray(payload.itens)
        ? payload.itens
        : extrairItensDosBlocos(blocos);

    const itens = itensRecebidos.map(normalizarItem);

    if (itens.length > 500) {
      return NextResponse.json(
        { error: "O limite máximo é de 500 itens por dimensionamento." },
        { status: 400 },
      );
    }

    if (blocos.length > 200) {
      return NextResponse.json(
        { error: "O limite máximo é de 200 funções por dimensionamento." },
        { status: 400 },
      );
    }

    const resumoEscopo = textoSeguro(
      body.resumoEscopo,
      textoSeguro(
        body.resumo_escopo,
        textoSeguro(payload.resumo_escopo),
      ),
    );

    const valorTotalItens = calcularTotal(itens);

    const valorTotalBlocos = calcularTotal(
      extrairItensDosBlocos(blocos).map(normalizarItem),
    );

    const valorTotalInformado = numeroSeguro(
      payload.valor_total_estimado,
    );

    const valorTotalEstimado =
      itens.length > 0
        ? valorTotalItens
        : blocos.length > 0
          ? valorTotalBlocos
          : valorTotalInformado;

    const dimensionamentoSalvo: PayloadDimensionamento = {
      versao: numeroSeguro(payload.versao) ?? 1,
      estrategia: textoSeguro(
        payload.estrategia,
        "Dimensionamento universal",
      ),
      resumo_escopo: resumoEscopo,
      premissas: Array.isArray(payload.premissas)
        ? payload.premissas.filter(
            (premissa): premissa is string =>
              typeof premissa === "string",
          )
        : [],
      funcoes: blocos,
      itens,
      custos_indiretos: Array.isArray(payload.custos_indiretos)
        ? payload.custos_indiretos
        : [],
      formacao_preco:
        payload.formacao_preco &&
        typeof payload.formacao_preco === "object"
          ? payload.formacao_preco
          : {},
      valor_total_estimado: valorTotalEstimado,
    };

    const registro = {
      edital_id: editalId,
      tenant_id: tenantId,
      resumo_escopo: resumoEscopo,
      itens: dimensionamentoSalvo,
      valor_total_estimado: valorTotalEstimado,
    };

    const { data: existente, error: consultaError } = await supabase
      .from("edital_dimensionamentos")
      .select("id")
      .eq("edital_id", editalId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (consultaError) {
      console.error("Erro ao consultar dimensionamento:", consultaError);

      return NextResponse.json(
        { error: "Não foi possível consultar o dimensionamento existente." },
        { status: 500 },
      );
    }

    let resultado;

    if (existente?.id) {
      const { data, error } = await supabase
        .from("edital_dimensionamentos")
        .update(registro)
        .eq("id", existente.id)
        .eq("tenant_id", tenantId)
        .select()
        .single();

      if (error) {
        console.error("Erro ao atualizar dimensionamento:", error);

        return NextResponse.json(
          { error: "Não foi possível atualizar o dimensionamento." },
          { status: 500 },
        );
      }

      resultado = data;
    } else {
      const { data, error } = await supabase
        .from("edital_dimensionamentos")
        .insert(registro)
        .select()
        .single();

      if (error) {
        console.error("Erro ao inserir dimensionamento:", error);

        return NextResponse.json(
          { error: "Não foi possível salvar o dimensionamento." },
          { status: 500 },
        );
      }

      resultado = data;
    }

    return NextResponse.json({
      success: true,
      message: "Dimensionamento salvo com sucesso.",
      dimensionamento: resultado,
    });
  } catch (error) {
    console.error("Erro inesperado ao salvar dimensionamento:", error);

    return NextResponse.json(
      { error: "Ocorreu um erro inesperado ao salvar o dimensionamento." },
      { status: 500 },
    );
  }
}
