"use client";

import { useState } from "react";
import Nav from "@/components/Nav";
import NotificationPreferences from "@/components/NotificationPreferences";

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
    <div className="flex h-screen bg-slate-50">
      <Nav />
      <main className="flex-1 overflow-y-auto px-8 py-8 lg:px-12">
        <div className="max-w-2xl mx-auto space-y-8">
          <header>
            <h1 className="text-2xl font-bold text-slate-900">Configurações Pessoais</h1>
            <p className="text-sm text-slate-500">
              Gerencie suas informações de acesso, perfil de usuário e preferências.
            </p>
          </header>

          {saved && (
            <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-200">
              Configurações salvas com sucesso!
            </div>
          )}

          {passwordError && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">
              {passwordError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Informações de Perfil */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                Dados do Perfil
              </h2>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Nome de apresentação
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Endereço de e-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Alterar Senha */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
              <div>
                <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-1">
                  Alterar Senha
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Preencha os campos abaixo apenas se desejar modificar sua senha de acesso.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Senha atual
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Nova senha
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Confirmar nova senha
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl text-sm transition-colors shadow-sm"
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