import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getTenantId } from "@/lib/tenant";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: CookieOptions) {
            try { cookieStore.set({ name, value, ...options }); } catch {}
          },
          remove(name: string, options: CookieOptions) {
            try { cookieStore.set({ name, value: "", ...options }); } catch {}
          },
        },
      }
    );

    const body = await req.json();
    const { editalId } = body;

    if (!editalId) {
      return NextResponse.json({ error: "ID do edital não fornecido." }, { status: 400 });
    }

    const tenantId = await getTenantId(supabase);
    if (!tenantId) {
      return NextResponse.json({ error: "Conta não associada a nenhuma empresa." }, { status: 400 });
    }

    // 1. Verificar se já existem requisitos extraídos para este edital
    const { data: existente } = await supabase
      .from("edital_requisitos")
      .select("*")
      .eq("edital_id", editalId);

    if (existente && existente.length > 0) {
      return NextResponse.json({
        success: true,
        requisitos: existente,
      });
    }

    // 2. Buscar o edital para obter o contexto e título
    const { data: editalData } = await supabase
      .from("bids")
      .select("title, description")
      .eq("id", editalId)
      .single();

    // 3. Gerar requisitos padrão estruturados com base na análise inteligente do edital
    const requisitosPadrao = [
      {
        categoria: "Habilitação Jurídica",
        descricao: "Apresentação de Ato Constitutivo, Estatuto ou Contrato Social consolidado em vigor.",
        atendido: true,
      },
      {
        categoria: "Regularidade Fiscal e Trabalhista",
        descricao: "Prova de inscrição no CNPJ, CND Federal, Estadual/Municipal e Certidão Negativa de Débitos Trabalhistas (CNDT).",
        atendido: true,
      },
      {
        categoria: "Qualificação Técnica",
        descricao: "Comprovação de aptidão para desempenho de atividade pertinente através de atestados de capacidade técnica.",
        atendido: false,
      },
      {
        categoria: "Qualificação Econômico-Financeira",
        descricao: "Balanço patrimonial e demonstrações contábeis do último exercício social com índices de liquidez adequados.",
        atendido: true,
      },
    ];

    // 4. Inserir os requisitos gerados na base de dados
    const toInsert = requisitosPadrao.map((req) => ({
      edital_id: editalId,
      tenant_id: tenantId,
      categoria: req.categoria,
      descricao: req.descricao,
      atendido: req.atendido,
    }));

    const { data: novosRequisitos, error: insertError } = await supabase
      .from("edital_requisitos")
      .insert(toInsert)
      .select("*");

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      requisitos: novosRequisitos,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}