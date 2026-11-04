import { NextResponse } from "next/server";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import { cookies } from "next/headers";
import { getTenantId } from "@/lib/tenant";

type CatalogItem = {
  id: string;
  name: string;
  type: string | null;
  unit: string | null;
  unit_price: number | string | null;
  estimated_price: number | string | null;
  description: string | null;
};

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

type PeriodicidadeCusto =
  | "MENSAL"
  | "ANUAL"
  | "UNICO"
  | "DEPRECIACAO";

type DimensionItem = {
  id: string;
  catalog_item_id: string;
  item: string;
  nome: string;
  grupo: GrupoCusto;
  tipo: string;
  categoria: string;
  unidade: string;
  quantidade: number | null;
  preco_unitario_estimado: number | null;
  preco_unitario: number | null;
  subtotal: number | null;
  custo_mensal: number | null;
  periodicidade: PeriodicidadeCusto;
  depreciacao_meses: number | null;
  justificativa: string;
  origem: string;
  requer_validacao: boolean;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePositiveNumber(
  value: number | string | null
): number | null {
  if (value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : null;
}

function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

const GRUPOS: Record<string, string[]> = {
  limpeza: [
    "limpeza",
    "conservacao",
    "asseio",
    "servicos gerais",
    "higienizacao",
  ],
  vigilancia: [
    "vigilancia",
    "seguranca patrimonial",
    "vigilante",
    "monitoramento de seguranca",
    "cftv",
    "controle de acesso",
  ],
  tecnologia: [
    "software",
    "sistema informatizado",
    "licenca de software",
    "computador",
    "informatica",
    "tecnologia da informacao",
    "suporte tecnico de ti",
  ],
  atendimento: [
    "atendimento ao publico",
    "central de atendimento",
    "call center",
    "teleatendimento",
    "recepcionista",
    "recepcao",
  ],
  manutencao: [
    "manutencao predial",
    "reparo predial",
    "instalacao eletrica",
    "hidraulica",
    "manutencao de equipamentos",
  ],
  transporte: [
    "transporte de passageiros",
    "locacao de veiculos",
    "motorista",
    "frota",
    "transporte de cargas",
  ],
  mao_de_obra: [
    "posto de trabalho",
    "mao de obra",
    "profissional alocado",
    "servico terceirizado",
    "dedicacao exclusiva",
  ],
  material_limpeza: [
    "detergente",
    "desinfetante",
    "material de limpeza",
    "papel higienico",
    "papel toalha",
    "saco de lixo",
    "sabonete liquido",
  ],
  epi: [
    "equipamento de protecao individual",
    "epi",
    "luva de protecao",
    "oculos de protecao",
    "botina de seguranca",
    "capacete de seguranca",
  ],
  uniforme: [
    "uniforme profissional",
    "uniforme operacional",
    "fardamento",
    "vestuario profissional",
  ],
  exame: [
    "exame admissional",
    "exame demissional",
    "exame periodico",
    "exame ocupacional",
    "aso",
    "saude ocupacional",
  ],
  treinamento: [
    "treinamento",
    "capacitacao",
    "curso profissional",
    "formacao profissional",
  ],
  equipamento: [
    "equipamento",
    "maquina",
    "ferramenta",
    "computador",
    "impressora",
    "veiculo",
  ],
  beneficio: [
    "vale transporte",
    "vale alimentacao",
    "vale refeicao",
    "beneficio",
    "plano de saude",
    "auxilio",
  ],
};

function classifyItem(item: CatalogItem): string {
  const text = normalizeText(
    `${item.name} ${item.description ?? ""} ${item.type ?? ""}`
  );

  const matches = Object.entries(GRUPOS)
    .filter(([, terms]) =>
      terms.some((term) => text.includes(normalizeText(term)))
    )
    .map(([group]) => group);

  return matches.length === 1 ? matches[0] : "";
}

function classifyScope(title: string, description: string): string[] {
  const text = normalizeText(`${title} ${description}`);

  const grupos: Record<string, string[]> = {
    limpeza: [
      "limpeza",
      "conservacao",
      "asseio",
      "higienizacao",
      "servicos gerais",
    ],
    vigilancia: [
      "vigilancia",
      "seguranca patrimonial",
      "vigilante",
      "monitoramento de seguranca",
      "cftv",
      "controle de acesso",
    ],
    tecnologia: [
      "software",
      "sistema informatizado",
      "informatica",
      "tecnologia da informacao",
      "solucao digital",
      "computacao em nuvem",
    ],
    atendimento: [
      "atendimento ao publico",
      "central de atendimento",
      "call center",
      "teleatendimento",
      "recepcionista",
      "recepcao",
    ],
    manutencao: [
      "manutencao predial",
      "reparo predial",
      "instalacao eletrica",
      "manutencao de equipamentos",
    ],
    transporte: [
      "transporte de passageiros",
      "locacao de veiculos",
      "motorista",
      "frota",
      "transporte de cargas",
    ],
    mao_de_obra: [
      "mao de obra",
      "dedicacao exclusiva",
      "servicos terceirizados",
      "posto de trabalho",
      "profissionais alocados",
    ],
    material_limpeza: [
      "fornecimento de material de limpeza",
      "produtos de limpeza",
      "papel higienico",
      "papel toalha",
    ],
    epi: [
      "equipamento de protecao individual",
      "fornecimento de epi",
      "equipamentos de protecao",
    ],
    uniforme: [
      "fornecimento de uniformes",
      "fardamento",
      "uniformes profissionais",
    ],
    exame: [
      "exames ocupacionais",
      "exame admissional",
      "exame periodico",
      "saude ocupacional",
    ],
    treinamento: [
      "treinamento",
      "capacitacao profissional",
      "formacao profissional",
    ],
    equipamento: [
      "fornecimento de equipamentos",
      "locacao de equipamentos",
      "equipamentos operacionais",
    ],
    beneficio: [
      "beneficios trabalhistas",
      "vale alimentacao",
      "vale transporte",
    ],
  };

  return Object.entries(grupos)
    .filter(([, terms]) =>
      terms.some((term) => text.includes(normalizeText(term)))
    )
    .map(([group]) => group);
}

function mapGrupo(grupo: string): GrupoCusto {
  const mapa: Record<string, GrupoCusto> = {
    mao_de_obra: "MAO_DE_OBRA",
    epi: "EPI",
    exame: "EXAME",
    treinamento: "TREINAMENTO",
    uniforme: "UNIFORME",
    material_limpeza: "MATERIAL",
    equipamento: "EQUIPAMENTO",
    limpeza: "SERVICO",
    vigilancia: "SERVICO",
    tecnologia: "SERVICO",
    atendimento: "SERVICO",
    manutencao: "SERVICO",
    transporte: "SERVICO",
    beneficio: "BENEFICIO",
  };

  return mapa[grupo] ?? "OUTRO";
}

function getItemType(type: string | null): string {
  const normalized = normalizeText(type ?? "");

  if (normalized.includes("servico")) {
    return "Serviço";
  }

  if (normalized.includes("produto")) {
    return "Produto";
  }

  return type || "Não classificado";
}

async function createSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Cookies podem ser somente leitura neste contexto.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({
              name,
              value: "",
              ...options,
              maxAge: 0,
            });
          } catch {
            // Cookies podem ser somente leitura neste contexto.
          }
        },
      },
    }
  );
}

async function validarSessao() {
  const supabase = await createSupabase();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
      tenantId: null,
      response: NextResponse.json(
        {
          success: false,
          error: "Sessão inválida ou expirada.",
        },
        { status: 401 }
      ),
    };
  }

  const tenantId = await getTenantId(supabase);

  if (!tenantId) {
    return {
      supabase,
      tenantId: null,
      response: NextResponse.json(
        {
          success: false,
          error: "Sua conta não está associada a nenhuma empresa.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    supabase,
    tenantId,
    response: null,
  };
}

/* =========================================================
   GET: CARREGAR FUNÇÕES E ITENS DA PLANILHA
========================================================= */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const editalId = searchParams.get("editalId")?.trim();

    if (!editalId) {
      return NextResponse.json(
        {
          success: false,
          error: "ID do edital não fornecido.",
        },
        { status: 400 }
      );
    }

    const { supabase, tenantId, response } = await validarSessao();

    if (response) return response;

    const { data: edital, error: editalError } = await supabase
      .from("bids")
      .select("id")
      .eq("id", editalId)
      .eq("tenant_id", tenantId!)
      .maybeSingle();

    if (editalError) {
      console.error("Erro ao validar edital no GET:", editalError);

      return NextResponse.json(
        {
          success: false,
          error: "Não foi possível validar o edital.",
        },
        { status: 500 }
      );
    }

    if (!edital) {
      return NextResponse.json(
        {
          success: false,
          error: "Edital não encontrado ou sem acesso pela empresa atual.",
        },
        { status: 404 }
      );
    }

    const { data: roles, error: rolesError } = await supabase
      .from("job_roles")
      .select("id, nome, escala, insalubridade_pct, periculosidade_pct")
      .eq("tenant_id", tenantId!)
      .order("nome");

    if (rolesError) throw rolesError;

    const roleIds = (roles ?? []).map((role) => role.id);

    const { data: vinculos, error: vinculosError } = roleIds.length
      ? await supabase
          .from("job_role_items")
          .select(
            "id, role_id, quantidade_padrao, preco_override, depreciacao_override, catalog_items(*)"
          )
          .in("role_id", roleIds)
      : { data: [], error: null };

    if (vinculosError) throw vinculosError;

    const ordem: Record<string, number> = {
      EPI: 0,
      EXAME: 1,
      TREINAMENTO: 2,
    };

    const blocos = (roles ?? []).map((role) => {
      const linhas = (vinculos ?? [])
        .filter((vinculo) => vinculo.role_id === role.id)
        .map((vinculo) => {
          const catalogo = (
            vinculo.catalog_items ?? {}
          ) as unknown as Record<string, unknown>;

          const nome = String(
            catalogo.name ?? catalogo.nome ?? "Item sem nome"
          );

          const preco = Number(
            catalogo.unit_price ?? catalogo.valor_unit ?? 0
          );

          let tipo: "EPI" | "EXAME" | "TREINAMENTO" = "EPI";

          const tipoBruto = String(
            catalogo.tipo ?? ""
          ).toUpperCase();

          if (
            tipoBruto === "EXAME" ||
            tipoBruto === "TREINAMENTO" ||
            tipoBruto === "EPI"
          ) {
            tipo = tipoBruto;
          } else {
            const tipoNormalizado = normalizeText(
              String(catalogo.type ?? "")
            );

            if (tipoNormalizado.includes("exame")) {
              tipo = "EXAME";
            } else if (
              tipoNormalizado.includes("treinamento") ||
              tipoNormalizado.includes("curso")
            ) {
              tipo = "TREINAMENTO";
            }
          }

          const depreciacao = Number(
            vinculo.depreciacao_override ??
              catalogo.depreciacao_meses ??
              12
          );

          return {
            id: String(vinculo.id),
            item_id: catalogo.id ? String(catalogo.id) : null,
            tipo,
            name: nome,
            unidade: String(catalogo.unit ?? "UN"),
            quantidade_padrao: Number(
              vinculo.quantidade_padrao ?? 0
            ),
            valor_unit: Number.isFinite(preco) ? preco : 0,
            preco_override:
              vinculo.preco_override != null
                ? Number(vinculo.preco_override)
                : null,
            depreciacao_meses:
              Number.isFinite(depreciacao) && depreciacao > 0
                ? depreciacao
                : 12,
          };
        })
        .sort(
          (a, b) =>
            ordem[a.tipo] - ordem[b.tipo] ||
            a.name.localeCompare(b.name)
        );

      return {
        role_id: role.id,
        nome: role.nome,
        escala: role.escala,
        insalubridade_pct: Number(
          role.insalubridade_pct ?? 0
        ),
        periculosidade_pct: Number(
          role.periculosidade_pct ?? 0
        ),
        linhas,
      };
    });

    return NextResponse.json({
      success: true,
      blocos,
    });
  } catch (error) {
    console.error("Erro na rota GET de dimensionamento:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Ocorreu um erro ao carregar os blocos de dimensionamento.",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST: GERAR DIMENSIONAMENTO UNIVERSAL
========================================================= */

export async function POST(req: Request) {
  try {
    const { supabase, tenantId, response } = await validarSessao();

    if (response) return response;

    let body: {
      editalId?: unknown;
      force?: unknown;
      forcarRegeneracao?: unknown;
    };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Corpo da requisição inválido.",
        },
        { status: 400 }
      );
    }

    const editalId =
      typeof body.editalId === "string"
        ? body.editalId.trim()
        : "";

    const deveRegenerar =
      body.force === true ||
      body.forcarRegeneracao === true;

    if (!editalId) {
      return NextResponse.json(
        {
          success: false,
          error: "ID do edital não fornecido.",
        },
        { status: 400 }
      );
    }

    const { data: edital, error: editalError } = await supabase
      .from("bids")
      .select("id, title, description, estimated_value, tenant_id")
      .eq("id", editalId)
      .eq("tenant_id", tenantId!)
      .maybeSingle();

    if (editalError) {
      console.error("Erro ao consultar edital:", editalError);

      return NextResponse.json(
        {
          success: false,
          error: "Não foi possível consultar o edital.",
        },
        { status: 500 }
      );
    }

    if (!edital) {
      return NextResponse.json(
        {
          success: false,
          error: "Edital não encontrado ou sem acesso pela empresa atual.",
        },
        { status: 404 }
      );
    }

    if (!deveRegenerar) {
      const {
        data: existente,
        error: existenteError,
      } = await supabase
        .from("edital_dimensionamentos")
        .select(
          "edital_id, tenant_id, resumo_escopo, itens, valor_total_estimado"
        )
        .eq("edital_id", editalId)
        .eq("tenant_id", tenantId!)
        .maybeSingle();

      if (existenteError) {
        console.error(
          "Erro ao consultar dimensionamento existente:",
          existenteError
        );

        return NextResponse.json(
          {
            success: false,
            error: "Não foi possível consultar o dimensionamento salvo.",
          },
          { status: 500 }
        );
      }

      if (existente) {
        return NextResponse.json({
          success: true,
          dimensionamento: {
            versao: 1,
            estrategia: existente.resumo_escopo,
            resumo_escopo: existente.resumo_escopo,
            premissas: [],
            funcoes: [],
            itens: existente.itens,
            custos_indiretos: [],
            formacao_preco: {
              percentual_lucro: 0,
              percentual_impostos: 0,
              percentual_despesas_administrativas: 0,
              custo_total_mensal: Number(
                existente.valor_total_estimado ?? 0
              ),
              preco_final_mensal: Number(
                existente.valor_total_estimado ?? 0
              ),
            },
            valor_total_estimado:
              existente.valor_total_estimado === null
                ? null
                : Number(existente.valor_total_estimado),
          },
        });
      }
    }

    const {
      data: catalogItems,
      error: catalogError,
    } = await supabase
      .from("catalog_items")
      .select(
        "id, name, type, unit, unit_price, estimated_price, description"
      )
      .eq("tenant_id", tenantId!);

    if (catalogError) {
      console.error("Erro ao consultar catálogo:", catalogError);

      return NextResponse.json(
        {
          success: false,
          error: "Não foi possível consultar o catálogo da empresa.",
        },
        { status: 500 }
      );
    }

    const titulo = String(edital.title ?? "");
    const descricao = String(edital.description ?? "");

    if (!titulo.trim() && !descricao.trim()) {
      return NextResponse.json(
        {
          success: false,
          requires_manual_review: true,
          error:
            "O edital não possui título nem descrição suficientes para identificar seu objeto.",
        },
        { status: 422 }
      );
    }

    const gruposDoEscopo = classifyScope(titulo, descricao);

    const valorEstimado = parsePositiveNumber(
      edital.estimated_value
    );

    const itensCompativeis = (
      (catalogItems ?? []) as CatalogItem[]
    ).filter((item) => {
      const categoria = classifyItem(item);

      return (
        categoria !== "" &&
        gruposDoEscopo.includes(categoria)
      );
    });

    const itensSelecionados: DimensionItem[] =
      itensCompativeis.map((item) => {
        const preco = parsePositiveNumber(
          item.estimated_price ?? item.unit_price
        );

        const categoria = classifyItem(item);
        const grupo = mapGrupo(categoria);

        return {
          id: item.id,
          catalog_item_id: item.id,
          item: item.name,
          nome: item.name,
          grupo,
          tipo: getItemType(item.type),
          categoria,
          unidade: item.unit || "UN",

          // Quantidade não é presumida.
          quantidade: null,

          preco_unitario_estimado: preco,
          preco_unitario: preco,

          // Sem quantidade confirmada, não há subtotal.
          subtotal: null,
          custo_mensal: null,

          periodicidade: "MENSAL",
          depreciacao_meses: null,

          justificativa:
            "Item candidato associado por categoria textual. Confirme a compatibilidade técnica, a unidade e a quantidade com o termo de referência antes de aprovar.",

          origem: "catalogo",

          requer_validacao: true,
        };
      });

    const semItensCompativeis =
      itensSelecionados.length === 0;

    const alertas: string[] = [
      "Os itens encontrados são candidatos e precisam de validação técnica.",
      "As quantidades não foram inferidas: devem vir do termo de referência ou de uma premissa aprovada.",
      "Os custos mensais somente poderão ser calculados após a confirmação dos quantitativos e da periodicidade.",
    ];

    if (
      itensSelecionados.some(
        (item) => item.preco_unitario_estimado === null
      )
    ) {
      alertas.push(
        "Um ou mais itens não possuem preço válido cadastrado no catálogo."
      );
    }

    if (gruposDoEscopo.length === 0) {
      alertas.push(
        "Não foi possível classificar automaticamente o objeto do edital. A revisão manual é necessária."
      );
    }

    if (valorEstimado !== null) {
      alertas.push(
        `O edital possui valor estimado de R$ ${valorEstimado.toLocaleString(
          "pt-BR",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )}. A comparação com os custos ficará disponível após a validação dos itens.`
      );
    } else {
      alertas.push(
        "O edital não possui valor estimado válido cadastrado para comparação."
      );
    }

    if (semItensCompativeis) {
      alertas.push(
        "Nenhum item do catálogo foi identificado como compatível com o objeto do edital."
      );
    }

    const estrategia = semItensCompativeis
      ? "Não foi possível identificar itens do catálogo com compatibilidade suficiente com o objeto do edital. Revise o objeto e cadastre ou classifique os itens adequados antes de dimensionar."
      : `Foram encontrados ${itensSelecionados.length} itens candidatos para o edital "${titulo || editalId}". Os quantitativos, a compatibilidade técnica e os preços devem ser validados antes da proposta.`;

    const registro = {
      edital_id: editalId,
      tenant_id: tenantId!,
      resumo_escopo: estrategia,
      itens: itensSelecionados,
      valor_total_estimado: null,
    };

    const { error: saveError } = await supabase
      .from("edital_dimensionamentos")
      .upsert(registro, {
        onConflict: "edital_id",
      });

    if (saveError) {
      console.error(
        "Erro ao salvar dimensionamento gerado:",
        saveError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Não foi possível salvar o dimensionamento. Verifique a estrutura da tabela e suas restrições.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      requires_manual_review: true,
      sem_itens_compativeis: semItensCompativeis,
      alertas,
      dimensionamento: {
        versao: 1,
        estrategia,
        resumo_escopo: estrategia,
        premissas: [
          "As quantidades devem ser confirmadas no termo de referência.",
          "Os preços devem ser revisados antes da formação da proposta.",
          "Os itens candidatos não representam uma composição final de custos.",
        ],
        funcoes: [],
        itens: itensSelecionados,
        custos_indiretos: [],
        formacao_preco: {
          percentual_lucro: 0,
          percentual_impostos: 0,
          percentual_despesas_administrativas: 0,
          custo_total_mensal: 0,
          preco_final_mensal: 0,
        },
        valor_total_estimado: null,
      },
    });
  } catch (error) {
    console.error("Erro na rota de dimensionamento:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Ocorreu um erro interno ao gerar o dimensionamento.",
      },
      { status: 500 }
    );
  }
}