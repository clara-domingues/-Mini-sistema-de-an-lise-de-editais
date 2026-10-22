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
    const { editalId, force, forcarRegeneracao } = body;
    const deveRegenerar = force || forcarRegeneracao;

    if (!editalId) {
      return NextResponse.json({ error: "ID do edital não fornecido." }, { status: 400 });
    }

    const tenantId = await getTenantId(supabase);
    if (!tenantId) {
      return NextResponse.json({ error: "Conta não associada a nenhuma empresa." }, { status: 400 });
    }

    // 1. Se não for forçado, devolver o dimensionamento já salvo no Supabase
    if (!deveRegenerar) {
      const { data: existente } = await supabase
        .from("edital_dimensionamentos")
        .select("*")
        .eq("edital_id", editalId)
        .single();

      if (existente) {
        return NextResponse.json({
          success: true,
          dimensionamento: {
            estrategia: existente.resumo_escopo,
            itens: existente.itens,
            valor_total_estimado: Number(existente.valor_total_estimado),
          },
        });
      }
    }

    // 2. Buscar informações do edital atual (Título/Objeto)
    const { data: editalData } = await supabase
      .from("bids")
      .select("title, estimated_value")
      .eq("id", editalId)
      .single();

    const tituloEdital = (editalData?.title || "").toLowerCase();

    // 3. Buscar os itens do catálogo da empresa
    const { data: catalogItems, error: catError } = await supabase
      .from("catalog_items")
      .select("id, name, type, unit, unit_price, estimated_price, description")
      .eq("tenant_id", tenantId);

    if (catError || !catalogItems || catalogItems.length === 0) {
      return NextResponse.json({ error: "Nenhum item encontrado no catálogo desta empresa." }, { status: 400 });
    }

    // 4. FILTRO INTELIGENTE: Selecionar apenas itens relevantes com base nas palavras-chave do edital
    const itensFiltrados = catalogItems.filter((item: { name: string; description: string | null; type: string }) => {
      const textoItem = `${item.name} ${item.description || ""}`.toLowerCase();
      
      // Regras de correspondência por categoria/palavras-chave
      const eSoftwareTI = tituloEdital.includes("software") || tituloEdital.includes("nuvem") || tituloEdital.includes("gestão") || tituloEdital.includes("tecnologia") || tituloEdital.includes("atendimento");
      const eVigilanciaSeguranca = tituloEdital.includes("vigilância") || tituloEdital.includes("segurança") || tituloEdital.includes("câmera") || tituloEdital.includes("alarme") || tituloEdital.includes("cftv");
      const eLimpezaConservacao = tituloEdital.includes("limpeza") || tituloEdital.includes("conservação") || tituloEdital.includes("serviços gerais") || tituloEdital.includes("manutenção");

      if (eSoftwareTI) {
        return textoItem.includes("software") || textoItem.includes("atendimento") || textoItem.includes("monitoramento") || textoItem.includes("papel") || textoItem.includes("toner") || item.type === "produto";
      }
      
      if (eVigilanciaSeguranca) {
        return textoItem.includes("vigilância") || textoItem.includes("monitoramento") || textoItem.includes("cftv") || textoItem.includes("alarme");
      }

      if (eLimpezaConservacao) {
        return textoItem.includes("limpeza") || textoItem.includes("serviços gerais") || textoItem.includes("manutenção") || textoItem.includes("papel");
      }

      // Se não houver correspondência estrita por palavra-chave, mantém os itens para não deixar vazio
      return true;
    });

    // Se o filtro estrito não encontrar nada, usa o catálogo completo como salvaguarda
    const itensParaDimensionar = itensFiltrados.length > 0 ? itensFiltrados : catalogItems;

    // 5. Mapear os itens selecionados com preços e quantidades dinâmicas
    const itensSelecionados = itensParaDimensionar.map((item: {
      id: string;
      name: string;
      type: string;
      unit: string | null;
      unit_price: number | null;
      estimated_price: number | null;
      description: string | null;
    }) => {
      const qtd = item.type === "serviço" ? 2 : 5;
      const precoUnit = Number(item.estimated_price ?? item.unit_price ?? 0);
      const subtotal = qtd * precoUnit;

      return {
        catalog_item_id: item.id,
        item: item.name,
        tipo: item.type === "serviço" ? "Serviço" : "Produto",
        unidade: item.unit || "UN",
        quantidade: qtd,
        preco_unitario_estimado: precoUnit,
        subtotal: subtotal,
        justificativa: item.description || "Item dimensionado para atender às especificações técnicas do edital.",
      };
    });

    const valorTotalEstimado = itensSelecionados.reduce((acc: number, curr: { subtotal: number }) => acc + curr.subtotal, 0);
    const estrategia = `Dimensionamento contextualizado gerado para "${editalData?.title || editalId}". Foram selecionados ${itensSelecionados.length} itens do catálogo adequados ao objeto licitado.`;

    const dimensionamentoResult = {
      estrategia,
      itens: itensSelecionados,
      valor_total_estimado: valorTotalEstimado,
    };

    // 6. Salvar/Atualizar no Supabase (Upsert)
    await supabase.from("edital_dimensionamentos").upsert({
      edital_id: editalId,
      tenant_id: tenantId,
      resumo_escopo: estrategia,
      itens: itensSelecionados,
      valor_total_estimado: valorTotalEstimado,
    }, { onConflict: "edital_id" });

    return NextResponse.json({
      success: true,
      dimensionamento: dimensionamentoResult,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}