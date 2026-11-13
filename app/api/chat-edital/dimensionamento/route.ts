import { NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import { cookies } from "next/headers";
import { getTenantId, deductAiCredit } from "@/lib/tenant";

/* =========================================================
   TIPOS
========================================================= */

type CatalogItem = {
  id: string;
  name: string;
  nome?: string | null;
  type: string | null;
  item_type?: string | null;
  unit: string | null;
  unidade?: string | null;
  unit_price: number | string | null;
  valor_unit?: number | string | null;
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

type PeriodicidadeCusto = "MENSAL" | "ANUAL" | "UNICO" | "DEPRECIACAO";

type DimensionItem = {
  id: string;
  catalog_item_id: string | null;
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
  observacoes?: string;
  pagina_origem?: string | null;
  trecho_origem?: string | null;
  fornecido_por?: string | null;
};

type ExtracaoIA = {
  objeto?: unknown;
  funcoes?: unknown;
  itens?: unknown;
  lacunas?: unknown;
};

const GRUPOS_VALIDOS: GrupoCusto[] = [
  "MAO_DE_OBRA",
  "EPI",
  "EXAME",
  "TREINAMENTO",
  "UNIFORME",
  "MATERIAL",
  "EQUIPAMENTO",
  "SERVICO",
  "BENEFICIO",
  "ENCARGO",
  "CUSTO_INDIRETO",
  "OUTRO",
];

const PERIODICIDADES_VALIDAS: PeriodicidadeCusto[] = [
  "MENSAL",
  "ANUAL",
  "UNICO",
  "DEPRECIACAO",
];

const LIMITE_TEXTO_EDITAL = 80000;
const LIMITE_CATALOGO_PROMPT = 300;

/* =========================================================
   UTILITÁRIOS
========================================================= */

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePositiveNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function arredondar(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function textoOuNull(valor: unknown, max = 300): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  return limpo ? limpo.slice(0, max) : null;
}

function numeroOuNull(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function calcularCustoMensal(
  quantidade: number | null,
  preco: number | null,
  periodicidade: PeriodicidadeCusto
): number | null {
  if (quantidade === null || preco === null) return null;

  const subtotal = quantidade * preco;

  if (periodicidade === "MENSAL") return arredondar(subtotal);
  if (periodicidade === "ANUAL") return arredondar(subtotal / 12);

  return null;
}

/* =========================================================
   CLASSIFICAÇÃO POR PALAVRAS (FALLBACK SEM IA)
========================================================= */

const GRUPOS: Record<string, string[]> = {
  limpeza: ["limpeza", "conservacao", "asseio", "servicos gerais", "higienizacao"],
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
    "luva amarela latex",
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
  const nomeItem = item.name || item.nome || "";
  const descItem = item.description || "";
  const tipoItem = item.type || item.item_type || "";

  const text = normalizeText(`${nomeItem} ${descItem} ${tipoItem}`);

  const matches = Object.entries(GRUPOS)
    .filter(([, terms]) =>
      terms.some((term) => text.includes(normalizeText(term)))
    )
    .map(([group]) => group);

  return matches.length === 1 ? matches[0] : "";
}

function classifyScope(title: string, description: string): string[] {
  const text = normalizeText(`${title} ${description}`);

  return Object.entries(GRUPOS)
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

function getItemType(type: string | null, itemType?: string | null): string {
  const normalized = normalizeText(type || itemType || "");

  if (normalized.includes("servico")) return "Serviço";
  if (normalized.includes("produto")) return "Produto";

  return type || itemType || "Não classificado";
}

/* =========================================================
   SUPABASE E SESSÃO
========================================================= */

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
            cookieStore.set({ name, value: "", ...options, maxAge: 0 });
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
        { success: false, error: "Sessão inválida ou expirada." },
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

  return { supabase, tenantId, response: null };
}

/* =========================================================
   EXTRAÇÃO ESTRUTURADA POR IA
========================================================= */

function montarPrompt(
  titulo: string,
  texto: string,
  catalogo: CatalogItem[]
): string {
  const listaCatalogo = catalogo
    .slice(0, LIMITE_CATALOGO_PROMPT)
    .map((c) => `${c.id} | ${c.name || c.nome || "Item"} | ${c.unit || c.unidade || "UN"}`)
    .join("\n");

  return `Você é um analista de licitações brasileiras especializado em dimensionamento de custos.
Leia o edital abaixo e devolva APENAS um objeto JSON, sem texto adicional.

REGRAS OBRIGATÓRIAS:
1. Nunca invente quantidades, preços, periodicidades ou jornadas. Se o edital não informar, use null.
2. "quantidade" só pode ser preenchida quando o edital trouxer o número de forma expressa; nesse caso "quantidade_explicita" = true. Caso contrário quantidade = null e quantidade_explicita = false.
3. "trecho" deve ser cópia literal e curta (máximo 200 caracteres) do edital que sustenta a informação. "pagina" só se o texto indicar a página; senão null.
4. Liste apenas itens que a CONTRATADA deva fornecer ou custear. Se o edital disser que a contratante fornece, use fornecido_por = "contratante". Se não estiver claro, "nao_informado".
5. "catalog_item_id" só pode ser um id da lista de catálogo abaixo, quando o item for claramente o mesmo. Caso contrário null. Nunca invente ids.
6. "grupo" deve ser um de: ${GRUPOS_VALIDOS.join(", ")}.
7. "periodicidade" deve ser MENSAL, ANUAL, UNICO ou DEPRECIACAO, ou null se o edital não informar.
8. Em "lacunas", liste em frases curtas o que o edital deixou sem informar e que a equipe precisará validar.

FORMATO:
{
  "objeto": "resumo do objeto em até 400 caracteres",
  "funcoes": [
    { "nome": "", "quantidade_postos": null, "escala": null, "pagina": null, "trecho": null }
  ],
  "itens": [
    {
      "descricao": "",
      "grupo": "EPI",
      "quantidade": null,
      "quantidade_explicita": false,
      "unidade": null,
      "periodicidade": null,
      "fornecido_por": "nao_informado",
      "catalog_item_id": null,
      "pagina": null,
      "trecho": null
    }
  ],
  "lacunas": []
}

CATÁLOGO DA EMPRESA (id | nome | unidade):
${listaCatalogo || "(catálogo vazio)"}

TÍTULO DO EDITAL: ${titulo}

TEXTO DO EDITAL:
${texto}`;
}

async function extrairComIA(
  apiKey: string,
  titulo: string,
  texto: string,
  catalogo: CatalogItem[]
): Promise<ExtracaoIA> {
  const model = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
    openAIApiKey: apiKey,
    modelKwargs: { response_format: { type: "json_object" } },
  });

  const resposta = await model.invoke(
    montarPrompt(titulo, texto, catalogo)
  );

  const conteudo =
    typeof resposta.content === "string"
      ? resposta.content
      : JSON.stringify(resposta.content);

  const limpo = conteudo
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const parsed = JSON.parse(limpo);

  if (parsed === null || typeof parsed !== "object") {
    throw new Error("Resposta da IA fora do formato esperado.");
  }

  return parsed as ExtracaoIA;
}

function converterExtracao(
  extracao: ExtracaoIA,
  catalogo: CatalogItem[]
): { itens: DimensionItem[]; lacunas: string[]; objeto: string } {
  const mapaCatalogo = new Map(catalogo.map((c) => [c.id, c]));
  const itens: DimensionItem[] = [];

  const funcoes = Array.isArray(extracao.funcoes) ? extracao.funcoes : [];

  for (const bruto of funcoes) {
    if (bruto === null || typeof bruto !== "object") continue;

    const f = bruto as Record<string, unknown>;
    const nome = textoOuNull(f.nome, 150);

    if (!nome) continue;

    const postos = numeroOuNull(f.quantidade_postos);
    const escala = textoOuNull(f.escala, 40);

    itens.push({
      id: crypto.randomUUID(),
      catalog_item_id: null,
      item: nome,
      nome,
      grupo: "MAO_DE_OBRA",
      tipo: "Posto de trabalho",
      categoria: "mao_de_obra",
      unidade: "posto",
      quantidade: postos,
      preco_unitario_estimado: null,
      preco_unitario: null,
      subtotal: null,
      custo_mensal: null,
      periodicidade: "MENSAL",
      depreciacao_meses: null,
      justificativa:
        "Função identificada pela IA no edital. Salário, encargos e adicionais devem ser informados na validação.",
      origem: "edital",
      requer_validacao: true,
      observacoes: escala ? `Escala/jornada: ${escala}` : "",
      pagina_origem: textoOuNull(f.pagina, 40),
      trecho_origem: textoOuNull(f.trecho, 300),
      fornecido_por: "contratada",
    });
  }

  const lista = Array.isArray(extracao.itens) ? extracao.itens : [];

  for (const bruto of lista) {
    if (bruto === null || typeof bruto !== "object") continue;

    const i = bruto as Record<string, unknown>;
    const descricao = textoOuNull(i.descricao, 200);

    if (!descricao) continue;

    const grupo = GRUPOS_VALIDOS.includes(i.grupo as GrupoCusto)
      ? (i.grupo as GrupoCusto)
      : "OUTRO";

    const periodicidadeInformada = PERIODICIDADES_VALIDAS.includes(
      i.periodicidade as PeriodicidadeCusto
    )
      ? (i.periodicidade as PeriodicidadeCusto)
      : null;

    const periodicidade = periodicidadeInformada ?? "MENSAL";

    const catalogId =
      typeof i.catalog_item_id === "string" ? i.catalog_item_id : null;
    const doCatalogo = catalogId ? mapaCatalogo.get(catalogId) : undefined;

    const quantidade =
      i.quantidade_explicita === true ? numeroOuNull(i.quantidade) : null;

    const preco = doCatalogo
      ? parsePositiveNumber(
          doCatalogo.estimated_price ??
          doCatalogo.unit_price ??
          doCatalogo.valor_unit ??
          null
        )
      : null;

    const unidade =
      textoOuNull(i.unidade, 20) ??
      doCatalogo?.unit ??
      doCatalogo?.unidade ??
      "";

    const subtotal =
      quantidade !== null && preco !== null
        ? arredondar(quantidade * preco)
        : null;

    const fornecidoPor = textoOuNull(i.fornecido_por, 20) ?? "nao_informado";
    const nomeCatalogo = doCatalogo ? (doCatalogo.name || doCatalogo.nome) : null;

    itens.push({
      id: crypto.randomUUID(),
      catalog_item_id: doCatalogo ? doCatalogo.id : null,
      item: nomeCatalogo ?? descricao,
      nome: nomeCatalogo ?? descricao,
      grupo,
      tipo: doCatalogo ? getItemType(doCatalogo.type, doCatalogo.item_type) : "Não classificado",
      categoria: grupo.toLowerCase(),
      unidade,
      quantidade,
      preco_unitario_estimado: preco,
      preco_unitario: preco,
      subtotal,
      custo_mensal: calcularCustoMensal(quantidade, preco, periodicidade),
      periodicidade,
      depreciacao_meses: null,
      justificativa: doCatalogo
        ? "Exigência identificada no edital e associada a um item do catálogo. Confirme a equivalência técnica."
        : "Exigência identificada no edital sem correspondente confirmado no catálogo. Informe o preço.",
      origem: doCatalogo ? "edital+catalogo" : "edital",
      requer_validacao:
        quantidade === null ||
        preco === null ||
        !unidade ||
        periodicidadeInformada === null ||
        fornecidoPor === "nao_informado",
      pagina_origem: textoOuNull(i.pagina, 40),
      trecho_origem: textoOuNull(i.trecho, 300),
      fornecido_por: fornecidoPor,
    });
  }

  const lacunas = Array.isArray(extracao.lacunas)
    ? extracao.lacunas
        .map((l) => textoOuNull(l, 300))
        .filter((l): l is string => l !== null)
        .slice(0, 30)
    : [];

  return {
    itens,
    lacunas,
    objeto: textoOuNull(extracao.objeto, 400) ?? "",
  };
}

/* =========================================================
   GET: CARREGAR FUNÇÕES E ITENS DO CATÁLOGO
========================================================= */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const editalId = searchParams.get("editalId")?.trim();

    if (!editalId) {
      return NextResponse.json(
        { success: false, error: "ID do edital não fornecido." },
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
        { success: false, error: "Não foi possível validar o edital." },
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

    const ordem: Record<string, number> = { EPI: 0, EXAME: 1, TREINAMENTO: 2 };

    const blocos = (roles ?? []).map((role) => {
      const linhas = (vinculos ?? [])
        .filter((vinculo) => vinculo.role_id === role.id)
        .map((vinculo) => {
          const catalogo = (
            vinculo.catalog_items ?? {}
          ) as unknown as Record<string, unknown>;

          const nome = String(catalogo.name ?? catalogo.nome ?? "Item sem nome");

          const preco = Number(catalogo.unit_price ?? catalogo.valor_unit ?? 0);

          let tipo: "EPI" | "EXAME" | "TREINAMENTO" = "EPI";

          const tipoBruto = String(catalogo.tipo ?? catalogo.item_type ?? "").toUpperCase();

          if (
            tipoBruto === "EXAME" ||
            tipoBruto === "TREINAMENTO" ||
            tipoBruto === "EPI"
          ) {
            tipo = tipoBruto;
          } else {
            const tipoNormalizado = normalizeText(String(catalogo.type ?? catalogo.item_type ?? ""));

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
            vinculo.depreciacao_override ?? catalogo.depreciacao_meses ?? 12
          );

          return {
            id: String(vinculo.id),
            item_id: catalogo.id ? String(catalogo.id) : null,
            tipo,
            name: nome,
            unidade: String(catalogo.unit ?? catalogo.unidade ?? "UN"),
            quantidade_padrao: Number(vinculo.quantidade_padrao ?? 0),
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
            ordem[a.tipo] - ordem[b.tipo] || a.name.localeCompare(b.name)
        );

      return {
        role_id: role.id,
        nome: role.nome,
        escala: role.escala,
        insalubridade_pct: Number(role.insalubridade_pct ?? 0),
        periculosidade_pct: Number(role.periculosidade_pct ?? 0),
        linhas,
      };
    });

    return NextResponse.json({ success: true, blocos });
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
   POST: GERAR DIMENSIONAMENTO (IA + CATÁLOGO)
========================================================= */

export async function POST(req: Request) {
  try {
    const { supabase, tenantId, response } = await validarSessao();

    if (response) return response;

    let body: {
      editalId?: unknown;
      force?: unknown;
      forcarRegeneracao?: unknown;
      documentContext?: unknown;
    };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Corpo da requisição inválido." },
        { status: 400 }
      );
    }

    const editalId =
      typeof body.editalId === "string" ? body.editalId.trim() : "";

    const deveRegenerar =
      body.force === true || body.forcarRegeneracao === true;

    if (!editalId) {
      return NextResponse.json(
        { success: false, error: "ID do edital não fornecido." },
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
        { success: false, error: "Não foi possível consultar o edital." },
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

    // Retorna o que já está salvo caso não force regeneração
    if (!deveRegenerar) {
      const { data: existente, error: existenteError } = await supabase
        .from("edital_dimensionamentos")
        .select("edital_id, tenant_id, resumo_escopo, itens, valor_total_estimado")
        .eq("edital_id", editalId)
        .eq("tenant_id", tenantId!)
        .maybeSingle();

      if (existenteError) {
        console.error("Erro ao consultar dimensionamento existente:", existenteError);

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
              custo_total_mensal: Number(existente.valor_total_estimado ?? 0),
              preco_final_mensal: Number(existente.valor_total_estimado ?? 0),
            },
            valor_total_estimado:
              existente.valor_total_estimado === null
                ? null
                : Number(existente.valor_total_estimado),
          },
        });
      }
    }

    const { data: catalogItems, error: catalogError } = await supabase
      .from("catalog_items")
      .select("id, name, nome, type, item_type, unit, unidade, unit_price, valor_unit, estimated_price, description")
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

    const catalogo = (catalogItems ?? []) as CatalogItem[];

    const titulo = String(edital.title ?? "");
    const descricao = String(edital.description ?? "");

    const textoCliente =
      typeof body.documentContext === "string"
        ? body.documentContext.trim()
        : "";

    const textoEdital = (textoCliente || `${titulo}\n\n${descricao}`)
      .trim()
      .slice(0, LIMITE_TEXTO_EDITAL);

    if (!textoEdital) {
      return NextResponse.json(
        {
          success: false,
          requires_manual_review: true,
          error:
            "O edital não possui texto suficiente para identificar seu objeto.",
        },
        { status: 422 }
      );
    }

    const valorEstimado = parsePositiveNumber(edital.estimated_value);

    const alertas: string[] = [
      "Os itens identificados precisam de validação técnica.",
      "Quantidades e periodicidades só foram preenchidas quando constavam expressamente no edital.",
    ];

    let itensSelecionados: DimensionItem[] = [];
    let lacunas: string[] = [];
    let objetoIA = "";
    let modo: "ia" | "catalogo" = "catalogo";

    const apiKey = process.env.OPENAI_API_KEY;

    /* ---------- CAMINHO 1: EXTRAÇÃO COM IA ---------- */
    if (apiKey) {
      const temCredito = await deductAiCredit(supabase, tenantId!);

      if (!temCredito) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Créditos de IA esgotados. Contacte o suporte ou recarregue a sua conta.",
          },
          { status: 403 }
        );
      }

      try {
        const extracao = await extrairComIA(apiKey, titulo, textoEdital, catalogo);
        const convertido = converterExtracao(extracao, catalogo);

        itensSelecionados = convertido.itens;
        lacunas = convertido.lacunas;
        objetoIA = convertido.objeto;
        modo = "ia";
      } catch (iaError) {
        console.error("Erro na extração estruturada com IA:", iaError);
        alertas.push(
          "A leitura por IA falhou nesta tentativa. Foi usado o cruzamento simples por palavras com o catálogo."
        );
      }
    } else {
      alertas.push(
        "OPENAI_API_KEY não configurada. Foi usado o cruzamento simples por palavras com o catálogo."
      );
    }

    /* ---------- CAMINHO 2: FALLBACK POR PALAVRAS ---------- */
    if (modo === "catalogo") {
      const gruposDoEscopo = classifyScope(titulo, descricao);

      itensSelecionados = catalogo
        .filter((item) => {
          const categoria = classifyItem(item);
          return categoria !== "" && (gruposDoEscopo.length === 0 || gruposDoEscopo.includes(categoria));
        })
        .map((item) => {
          const preco = parsePositiveNumber(
            item.estimated_price ?? item.unit_price ?? item.valor_unit ?? null
          );
          const categoria = classifyItem(item) || "outro";
          const nomeItem = item.name || item.nome || "Item sem nome";
          const unidadeItem = item.unit || item.unidade || "UN";

          return {
            id: item.id,
            catalog_item_id: item.id,
            item: nomeItem,
            nome: nomeItem,
            grupo: mapGrupo(categoria),
            tipo: getItemType(item.type, item.item_type),
            categoria,
            unidade: unidadeItem,
            quantidade: null,
            preco_unitario_estimado: preco,
            preco_unitario: preco,
            subtotal: null,
            custo_mensal: null,
            periodicidade: "MENSAL" as PeriodicidadeCusto,
            depreciacao_meses: null,
            justificativa:
              "Item candidato associado por categoria textual. Confirme a compatibilidade técnica, a unidade e a quantidade antes de aprovar.",
            origem: "catalogo",
            requer_validacao: true,
          };
        });

      if (itensSelecionados.length === 0 && catalogo.length > 0) {
        itensSelecionados = catalogo.map((item) => {
          const preco = parsePositiveNumber(
            item.estimated_price ?? item.unit_price ?? item.valor_unit ?? null
          );
          const nomeItem = item.name || item.nome || "Item sem nome";
          const unidadeItem = item.unit || item.unidade || "UN";

          return {
            id: item.id,
            catalog_item_id: item.id,
            item: nomeItem,
            nome: nomeItem,
            grupo: "OUTRO" as GrupoCusto,
            tipo: getItemType(item.type, item.item_type),
            categoria: "outro",
            unidade: unidadeItem,
            quantidade: null,
            preco_unitario_estimado: preco,
            preco_unitario: preco,
            subtotal: null,
            custo_mensal: null,
            periodicidade: "MENSAL" as PeriodicidadeCusto,
            depreciacao_meses: null,
            justificativa: "Item do catálogo carregado por correspondência geral. Valide as quantidades e preços.",
            origem: "catalogo",
            requer_validacao: true,
          };
        });
      }

      if (gruposDoEscopo.length === 0 && catalogo.length === 0) {
        alertas.push(
          "Não foi possível classificar automaticamente o objeto do edital e o catálogo está vazio."
        );
      }
    }

    const semItens = itensSelecionados.length === 0;

    if (semItens) {
      alertas.push("Nenhum item foi identificado para este edital.");
    }

    if (itensSelecionados.some((i) => i.preco_unitario_estimado === null)) {
      alertas.push(
        "Um ou mais itens estão sem preço: não há correspondente no catálogo ou o preço não está cadastrado."
      );
    }

    if (valorEstimado !== null) {
      alertas.push(
        `O edital possui valor estimado de R$ ${valorEstimado.toLocaleString(
          "pt-BR",
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )}. A comparação com os custos ficará disponível após a validação.`
      );
    }

    for (const lacuna of lacunas) {
      alertas.push(`Lacuna no edital: ${lacuna}`);
    }

    const estrategia = semItens
      ? "Não foi possível identificar itens para dimensionar. Revise o texto do edital e o catálogo."
      : modo === "ia"
        ? `${objetoIA ? `${objetoIA} ` : ""}A IA identificou ${itensSelecionados.length} itens e funções no edital. Valide quantidades, preços e periodicidades antes da proposta.`
        : `Foram encontrados ${itensSelecionados.length} itens candidatos para o edital "${titulo || editalId}". Valide quantidades, preços e compatibilidade técnica.`;

    const custosMensais = itensSelecionados
      .map((i) => i.custo_mensal)
      .filter((v): v is number => v !== null);

    const totalMensal = arredondar(
      custosMensais.reduce((acc, v) => acc + v, 0)
    );

    const registro = {
      edital_id: editalId,
      tenant_id: tenantId!,
      resumo_escopo: estrategia,
      itens: itensSelecionados,
      valor_total_estimado: custosMensais.length > 0 ? totalMensal : null,
    };

    const { error: saveError } = await supabase
      .from("edital_dimensionamentos")
      .upsert(registro, { onConflict: "edital_id" });

    if (saveError) {
      console.error("Erro ao salvar dimensionamento gerado:", saveError);

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
      modo,
      requires_manual_review: true,
      sem_itens_compativeis: semItens,
      alertas,
      lacunas,
      dimensionamento: {
        versao: 1,
        estrategia,
        resumo_escopo: estrategia,
        premissas: [
          "Quantidades e periodicidades não informadas no edital permanecem pendentes.",
          "Preços vêm do catálogo da empresa e devem ser revisados antes da proposta.",
          "Itens identificados não representam uma composição final de custos.",
        ],
        funcoes: [],
        itens: itensSelecionados,
        custos_indiretos: [],
        formacao_preco: {
          percentual_lucro: 0,
          percentual_impostos: 0,
          percentual_despesas_administrativas: 0,
          custo_total_mensal: totalMensal,
          preco_final_mensal: totalMensal,
        },
        valor_total_estimado: custosMensais.length > 0 ? totalMensal : null,
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