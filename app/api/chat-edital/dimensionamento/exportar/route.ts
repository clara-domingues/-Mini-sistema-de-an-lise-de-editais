import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import { cookies } from "next/headers";
import { getTenantId } from "@/lib/tenant";

export const runtime = "nodejs";

type Item = {
  id?: string;
  item?: string;
  nome?: string;
  grupo?: string;
  tipo?: string;
  unidade?: string;
  quantidade?: number;
  quantidade_padrao?: number;
  preco_unitario?: number;
  preco_unitario_estimado?: number;
  subtotal?: number;
  custo_mensal?: number;
  periodicidade?: string;
  depreciacao_meses?: number;
  justificativa?: string;
  origem?: string;
  requer_validacao?: boolean;
  funcao?: string;
};

type Bloco = {
  role_id?: string;
  nome?: string;
  escala?: string | null;
  insalubridade_pct?: number;
  periculosidade_pct?: number;
  linhas?: Array<{
    name?: string;
    tipo?: string;
    quantidade_padrao?: number;
    valor_unit?: number;
    depreciacao_meses?: number;
    preco_override?: number | null;
  }>;
};

type Dimensionamento = {
  resumo_escopo?: string;
  premissas?: string[];
  itens?: Item[];
  funcoes?: Bloco[];
  valor_total_estimado?: number;
};

export async function POST(req: Request) {
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
            try {
              cookieStore.set({ name, value, ...options });
            } catch {}
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({
                name,
                value: "",
                ...options,
                maxAge: 0,
              });
            } catch {}
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Sessão inválida ou expirada." },
        { status: 401 }
      );
    }

    const tenantId = await getTenantId(supabase);

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Empresa não identificada." },
        { status: 403 }
      );
    }

    const body = await req.json();

    const editalId =
      typeof body.editalId === "string" ? body.editalId.trim() : "";

    const dimensionamento = body.dimensionamento as
      | Dimensionamento
      | undefined;

    if (!editalId || !dimensionamento) {
      return NextResponse.json(
        {
          success: false,
          error: "Informe o edital e os dados do dimensionamento.",
        },
        { status: 400 }
      );
    }

    const { data: edital, error: editalError } = await supabase
      .from("bids")
      .select("id, title")
      .eq("id", editalId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (editalError || !edital) {
      return NextResponse.json(
        { success: false, error: "Edital não encontrado ou sem permissão." },
        { status: 404 }
      );
    }

    const itens = Array.isArray(dimensionamento.itens)
      ? dimensionamento.itens
      : [];

    const linhasItens = itens.map((item) => {
      const quantidade = Number(
        item.quantidade ?? item.quantidade_padrao ?? 0
      );

      const preco = Number(
        item.preco_unitario_estimado ?? item.preco_unitario ?? 0
      );

      return {
        Grupo: item.grupo ?? item.tipo ?? "OUTROS",
        Item: item.item ?? item.nome ?? "Sem descrição",
        Função: item.funcao ?? "",
        Unidade: item.unidade ?? "UN",
        Quantidade: quantidade,
        "Preço unitário": preco,
        Subtotal: Number(item.subtotal ?? quantidade * preco),
        "Custo mensal": Number(item.custo_mensal ?? 0),
        Periodicidade: item.periodicidade ?? "MENSAL",
        "Depreciação (meses)": Number(item.depreciacao_meses ?? 0),
        Origem: item.origem ?? "",
        "Requer validação": item.requer_validacao ? "SIM" : "NÃO",
        Justificativa: item.justificativa ?? "",
      };
    });

    const linhasFuncoes = (
      Array.isArray(dimensionamento.funcoes)
        ? dimensionamento.funcoes
        : []
    ).map((funcao) => ({
      Função: funcao.nome ?? "",
      Escala: funcao.escala ?? "",
      "Insalubridade (%)": Number(funcao.insalubridade_pct ?? 0),
      "Periculosidade (%)": Number(funcao.periculosidade_pct ?? 0),
      "Quantidade de itens": Array.isArray(funcao.linhas)
        ? funcao.linhas.length
        : 0,
    }));

    const dadosGerais = [
      { Campo: "Edital", Informação: edital.title ?? "" },
      {
        Campo: "Resumo do escopo",
        Informação: dimensionamento.resumo_escopo ?? "",
      },
      {
        Campo: "Valor total estimado",
        Informação: Number(dimensionamento.valor_total_estimado ?? 0),
      },
      { Campo: "Total de itens", Informação: itens.length },
      {
        Campo: "Itens pendentes de validação",
        Informação: itens.filter((item) => item.requer_validacao).length,
      },
    ];

    const workbook = XLSX.utils.book_new();

    const sheetDados = XLSX.utils.json_to_sheet(dadosGerais);
    const sheetItens = XLSX.utils.json_to_sheet(linhasItens);
    const sheetFuncoes = XLSX.utils.json_to_sheet(linhasFuncoes);

    const sheetPremissas = XLSX.utils.aoa_to_sheet([
      ["PREMISSAS DO DIMENSIONAMENTO"],
      ...(
        Array.isArray(dimensionamento.premissas)
          ? dimensionamento.premissas
          : []
      ).map((premissa) => [premissa]),
    ]);

    XLSX.utils.book_append_sheet(workbook, sheetDados, "Dados Gerais");
    XLSX.utils.book_append_sheet(workbook, sheetItens, "Itens");
    XLSX.utils.book_append_sheet(workbook, sheetFuncoes, "Funções");
    XLSX.utils.book_append_sheet(workbook, sheetPremissas, "Premissas");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    });

    const arquivo = new Uint8Array(excelBuffer);

    const nomeArquivo = `dimensionamento-${editalId}.xlsx`;

    return new Response(arquivo, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Erro ao exportar dimensionamento:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Não foi possível gerar a planilha Excel.",
      },
      { status: 500 }
    );
  }
}