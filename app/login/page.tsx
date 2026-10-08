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
    login: "Entrar",
    signup: "Criar conta",
    magic: "Entrar com Magic Link",
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">EditalAI</h1>
          <p className="text-sm text-slate-500">{titles[mode]}</p>
        </div>

        <input
          type="email"
          required
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        />

        {mode !== "magic" && (
          <input
            type="password"
            required
            minLength={6}
            placeholder="Senha (mín. 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          />
        )}

        {msg && (
          <p className={`text-sm ${msg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
            {msg.text}
          </p>
        )}

        <button
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 font-medium disabled:opacity-50"
        >
          {loading ? "Aguarde..." : titles[mode]}
        </button>

        <div className="flex flex-col gap-1 text-sm text-blue-600 text-center">
          {mode !== "login" && (
            <button type="button" onClick={() => setMode("login")}>
              Já tenho conta
            </button>
          )}
          {mode !== "signup" && (
            <button type="button" onClick={() => setMode("signup")}>
              Criar conta
            </button>
          )}
          {mode !== "magic" && (
            <button type="button" onClick={() => setMode("magic")}>
              Entrar com Magic Link
            </button>
          )}
        </div>
      </form>
    </main>
  );
}