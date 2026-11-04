
import { NextResponse } from "next/server";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET() {
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

          set(
            name: string,
            value: string,
            options: CookieOptions
          ) {
            try {
              cookieStore.set({
                name,
                value,
                ...options,
              });
            } catch {}
          },

          remove(
            name: string,
            options: CookieOptions
          ) {
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
        {
          success: false,
          error: "Sessão inválida ou expirada.",
        },
        { status: 401 }
      );
    }

    const {
      data: notifications,
      error,
    } = await supabase
      .from("notifications")
      .select(
        "id, title, message, type, read, created_at"
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(30);

    if (error) {
      console.error(
        "Erro ao buscar notificações:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: "Não foi possível carregar as notificações.",
        },
        { status: 500 }
      );
    }

    const notificationsFormatted = (
      notifications ?? []
    ).map((notification) => ({
      ...notification,
      link_url: null,
    }));

    return NextResponse.json({
      success: true,
      notifications: notificationsFormatted,
    });

  } catch (error) {
    console.error(
      "Erro na API de notificações:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Erro interno ao carregar notificações.",
      },
      { status: 500 }
    );
  }
}
