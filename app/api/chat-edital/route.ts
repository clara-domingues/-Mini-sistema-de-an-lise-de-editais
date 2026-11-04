import { NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getTenantId, deductAiCredit } from "@/lib/tenant";

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
            try {
              cookieStore.set({ name, value, ...options });
            } catch {}
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: "", ...options, maxAge: 0 });
            } catch {}
          },
        },
      }
    );

    // Valida o tenant e consome 1 crédito de IA
    const tenantId = await getTenantId(supabase);
    const temCredito = tenantId ? await deductAiCredit(supabase, tenantId) : false;

    if (!temCredito) {
      return NextResponse.json(
        { error: "Créditos de IA esgotados. Contacte o suporte ou recarregue a sua conta." },
        { status: 403 }
      );
    }

    const { question, editalTitle, documentContext } = await request.json();

    if (!question) {
      return NextResponse.json(
        { error: "Pergunta não fornecida." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "A chave OPENAI_API_KEY não foi encontrada no ficheiro .env.local." },
        { status: 500 }
      );
    }

    const model = new ChatOpenAI({
      modelName: "gpt-4o-mini",
      temperature: 0.2,
      openAIApiKey: apiKey,
    });

    const prompt = PromptTemplate.fromTemplate(`
Você é um assistente especialista em licitações públicas brasileiras do sistema BidMaster AI.
Sua tarefa é analisar o edital abaixo e responder à pergunta do usuário de forma clara, precisa e objetiva.

---
TÍTULO DO EDITAL: {editalTitle}
CONTEÚDO DO EDITAL / DOCUMENTO:
{documentContext}
---

PERGUNTA DO USUÁRIO: {question}

Responda em Português do Brasil de forma profissional. Se a informação não estiver presente no texto fornecido, informe educadamente que o documento do edital não menciona essa informação.
`);

    const chain = prompt.pipe(model).pipe(new StringOutputParser());

    const response = await chain.invoke({
      editalTitle: editalTitle || "Edital",
      documentContext: documentContext || "Nenhum texto extraído ainda do edital.",
      question,
    });

    return NextResponse.json({ answer: response });
  } catch (err: unknown) {
    console.error("Erro na API chat-edital:", err);
    const errorMsg = err instanceof Error ? err.message : "Erro desconhecido ao conectar à OpenAI.";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}