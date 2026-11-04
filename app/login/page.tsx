"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "magic";

const inputClass =
  "w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-blue-600";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const redirectTo = `${window.location.origin}/auth/callback`;

    if (mode === "magic") {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      setLoading(false);
      if (error) return setMsg({ type: "err", text: error.message });
      return setMsg({ type: "ok", text: "Link enviado! Verifique seu e-mail." });
    }

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      setLoading(false);
      if (error) return setMsg({ type: "err", text: error.message });
      if (data.session) {
        router.push("/perfil");
        router.refresh();
        return;
      }
      return setMsg({ type: "ok", text: "Conta criada! Confirme pelo e-mail enviado." });
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setMsg({ type: "err", text: "E-mail ou senha inválidos." });
    router.push("/perfil");
    router.refresh();
  }

  const titles: Record<Mode, string> = {
    login: "Entrar na plataforma",
    signup: "Criar nova conta",
    magic: "Entrar com Magic Link",
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800/10 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-xl">
        {/* Cabeçalho com o branding BidMaster AI */}
        <div className="space-y-2 text-center">
          <div className="mb-1 inline-flex items-center justify-center rounded-2xl bg-blue-600 p-3 font-bold text-white shadow-md">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0V5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            BidMaster AI
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{titles[mode]}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>E-mail</label>
            <input
              type="email"
              required
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          {mode !== "magic" && (
            <div>
              <label className={labelClass}>Senha</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="•••••••• (mín. 6 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          {msg && (
            <div
              className={`rounded-xl border p-3.5 text-sm ${
                msg.type === "ok"
                  ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                  : "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300"
              }`}
            >
              {msg.text}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Aguarde..." : titles[mode]}
          </button>
        </form>

        {/* Navegação entre modos */}
        <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-slate-800 pt-2 text-center text-sm">
          {mode !== "login" && (
            <button
              type="button"
              onClick={() => {
                setMsg(null);
                setMode("login");
              }}
              className="font-medium text-blue-600 dark:text-blue-400 transition hover:text-blue-800 dark:hover:text-blue-300"
            >
              Já tenho conta
            </button>
          )}
          {mode !== "signup" && (
            <button
              type="button"
              onClick={() => {
                setMsg(null);
                setMode("signup");
              }}
              className="font-medium text-blue-600 dark:text-blue-400 transition hover:text-blue-800 dark:hover:text-blue-300"
            >
              Criar conta
            </button>
          )}
          {mode !== "magic" && (
            <button
              type="button"
              onClick={() => {
                setMsg(null);
                setMode("magic");
              }}
              className="text-xs text-slate-500 dark:text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
            >
              Entrar com Magic Link
            </button>
          )}
        </div>
      </div>
    </main>
  );
}