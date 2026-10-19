"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "magic";

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
    <main className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-800/10 p-8 space-y-6">
        
        {/* Cabeçalho com o novo branding BidMaster AI */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center bg-blue-600 text-white font-bold p-3 rounded-2xl shadow-md mb-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0V5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">BidMaster AI</h1>
          <p className="text-sm font-medium text-slate-500">{titles[mode]}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              required
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none transition"
            />
          </div>

          {mode !== "magic" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Senha
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="•••••••• (mín. 6 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none transition"
              />
            </div>
          )}

          {msg && (
            <div
              className={`p-3.5 rounded-xl text-sm border ${
                msg.type === "ok"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }`}
            >
              {msg.text}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 text-sm transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? "Aguarde..." : titles[mode]}
          </button>
        </form>

        {/* Navegação entre modos */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 text-sm text-center">
          {mode !== "login" && (
            <button
              type="button"
              onClick={() => { setMsg(null); setMode("login"); }}
              className="text-blue-600 hover:text-blue-800 font-medium transition"
            >
              Já tenho conta
            </button>
          )}
          {mode !== "signup" && (
            <button
              type="button"
              onClick={() => { setMsg(null); setMode("signup"); }}
              className="text-blue-600 hover:text-blue-800 font-medium transition"
            >
              Criar conta
            </button>
          )}
          {mode !== "magic" && (
            <button
              type="button"
              onClick={() => { setMsg(null); setMode("magic"); }}
              className="text-slate-500 hover:text-slate-700 text-xs transition"
            >
              Entrar com Magic Link
            </button>
          )}
        </div>

      </div>
    </main>
  );
}