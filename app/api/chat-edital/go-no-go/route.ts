
import { NextResponse } from "next/server";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import { cookies } from "next/headers";
import { getTenantId } from "@/lib/tenant";

export async function POST(req: Request) {
  try {
    // 1. Configurar o Supabase com a sessão do usuário.
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(
            name: string,
            value: string,
            options: CookieOptions
          ) {
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
              // A atualização de cookies pode não estar disponível.
            }
          },
        },
      }
    );

    // 2. Validar a autenticação.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Sessão inválida ou expirada.",
        },
        { status: 401 }
      );
    }

    // 3. Identificar a empresa da sessão autenticada.
    const tenantId = await getTenantId(supabase);

    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: "Sua conta não está associada a nenhuma empresa.",
        },
        { status: 403 }
      );
    }

    // 4. Validar o corpo da requisição.
    let body: { editalId?: unknown };

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

    if (!editalId) {
      return NextResponse.json(
        {
          success: false,
          error: "ID do edital não fornecido.",
        },
        { status: 400 }
      );
    }

    // 5. Confirmar que o edital pertence à empresa atual.
    const {
      data: edital,
      error: editalError,
    } = await supabase
      .from("bids")
      .select("id, title, description, tenant_id")
      .eq("id", editalId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (editalError) {
      console.error(
        "Erro ao consultar edital:",
        editalError.message
      );

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
          error:
            "Edital não encontrado ou sem acesso pela empresa atual.",
        },
        { status: 404 }
      );
    }

    // 6. Buscar somente os requisitos deste edital e empresa.
    const {
      data: requisitosExistentes,
      error: requisitosError,
    } = await supabase
      .from("edital_requisitos")
      .select("*")
      .eq("edital_id", editalId)
      .eq("tenant_id", tenantId);

    if (requisitosError) {
      console.error(
        "Erro ao consultar requisitos:",
        requisitosError.message
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Não foi possível consultar os requisitos do edital.",
        },
        { status: 500 }
      );
    }

    // 7. Não confundir requisitos cadastrados com requisitos validados.
    if (
      requisitosExistentes &&
      requisitosExistentes.length > 0
    ) {
      return NextResponse.json({
        success: true,
        origem: "requisitos_existentes",
        analise_documental_executada: false,
        decisao_go_no_go_disponivel: false,
        mensagem:
          "Existem requisitos registrados, mas eles precisam ser conferidos contra o edital original e seus anexos antes da decisão.",
        requisitos: requisitosExistentes,
      });
    }

    // 8. Sem requisitos documentais, não gerar decisão automática.
    const possuiTitulo =
      typeof edital.title === "string" &&
      edital.title.trim().length > 0;

    return NextResponse.json(
      {
        success: false,
        analise_documental_executada: false,
        decisao_go_no_go_disponivel: false,
        requires_document_analysis: true,
        editalId: edital.id,
        mensagem: possuiTitulo
          ? "O edital foi localizado, mas ainda não existem requisitos extraídos e registrados. Execute a análise do documento original e de seus anexos antes de avaliar o Go/No-Go."
          : "O edital não possui título preenchido nem requisitos extraídos. Complete os dados e execute a análise documental antes de avaliar o Go/No-Go.",
        error:
          "Não é seguro gerar uma decisão Go/No-Go sem requisitos documentais verificados.",
      },
      { status: 422 }
    );
  } catch (error: unknown) {
    console.error("Erro na rota Go/No-Go:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          "Ocorreu um erro interno ao processar a análise.",
      },
      { status: 500 }
    );
  }
}
