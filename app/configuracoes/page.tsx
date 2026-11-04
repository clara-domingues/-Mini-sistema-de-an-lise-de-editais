"use client";

import { useState } from "react";
import Nav from "@/components/Nav";
import NotificationPreferences from "@/components/NotificationPreferences";

const inputClass =
  "w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600";

const labelClass =
  "mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400";

const cardClass =
  "space-y-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors";

export default function PersonalSettingsPage() {
  const [name, setName] = useState("Ana Clara");
  const [email, setEmail] = useState("anaclara@exemplo.com");

  // Estados para alteração de senha
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saved, setSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    // Validação simples de senha se o usuário tentar alterar
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        setPasswordError("Informe a senha atual para alterar a senha.");
        return;
      }
      if (newPassword.length < 6) {
        setPasswordError("A nova senha deve ter pelo menos 6 caracteres.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError("A nova senha e a confirmação não coincidem.");
        return;
      }
    }

    setSaved(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Nav />
      <main className="flex-1 overflow-y-auto px-8 py-8 lg:px-12">
        <div className="mx-auto max-w-2xl space-y-8">
          <header>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Configurações Pessoais
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Gerencie suas informações de acesso, perfil de usuário e preferências.
            </p>
          </header>

          {saved && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 p-4 text-sm text-emerald-700 dark:text-emerald-300">
              Configurações salvas com sucesso!
            </div>
          )}

          {passwordError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 p-4 text-sm text-red-700 dark:text-red-300"
            >
              {passwordError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informações de Perfil */}
            <div className={cardClass}>
              <h2 className="border-b border-slate-100 dark:border-slate-800 pb-3 text-base font-bold text-slate-900 dark:text-white">
                Dados do Perfil
              </h2>

              <div>
                <label className={labelClass}>Nome de apresentação</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Endereço de e-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Alterar Senha */}
            <div className={cardClass}>
              <div>
                <h2 className="border-b border-slate-100 dark:border-slate-800 pb-1 text-base font-bold text-slate-900 dark:text-white">
                  Alterar Senha
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Preencha os campos abaixo apenas se desejar modificar sua senha de acesso.
                </p>
              </div>

              <div>
                <label className={labelClass}>Senha atual</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Nova senha</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Confirmar nova senha</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                Guardar alterações
              </button>
            </div>
          </form>

          {/* Seção de Notificações incorporada */}
          <NotificationPreferences />
        </div>
      </main>
    </div>
  );
}