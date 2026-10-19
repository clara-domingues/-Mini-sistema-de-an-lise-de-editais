"use client";

import { useState } from "react";

type NotificationPrefs = {
  emailAlerts: boolean;
  emailAiAnalysis: boolean;
  emailOpportunities: boolean;
  emailWeeklyDigest: boolean;
  systemDeadlineAlerts: boolean;
  systemAiAnalysis: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  emailAlerts: true,
  emailAiAnalysis: true,
  emailOpportunities: true,
  emailWeeklyDigest: true,
  systemDeadlineAlerts: true,
  systemAiAnalysis: true,
};

const STORAGE_KEY = "bidmaster_notification_prefs";

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => {
    if (typeof window === "undefined") return DEFAULT_PREFS;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleToggle = (key: keyof NotificationPrefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      setMsg({ type: "ok", text: "Preferências de notificação salvas com sucesso." });
      setTimeout(() => setMsg(null), 3000);
    } catch {
      setMsg({ type: "err", text: "Não foi possível salvar as preferências." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
          Notificações
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Escolha como e quando o BidMaster deve avisar sobre prazos, análises e oportunidades.
        </p>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl text-sm border ${
            msg.type === "ok"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* E-mail */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
          E-mail
        </h3>

        <div className="space-y-4 divide-y divide-slate-100">
          <label className="flex items-center justify-between pt-2 cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-slate-900">Alertas de prazo</p>
              <p className="text-xs text-slate-500">Receba e-mail quando um edital estiver próximo da data limite.</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.emailAlerts}
              onChange={() => handleToggle("emailAlerts")}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between pt-3 cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-slate-900">Análise da IA concluída</p>
              <p className="text-xs text-slate-500">Avise quando a análise automática de um edital for finalizada.</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.emailAiAnalysis}
              onChange={() => handleToggle("emailAiAnalysis")}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between pt-3 cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-slate-900">Novas oportunidades</p>
              <p className="text-xs text-slate-500">Sugestões de editais alinhados aos interesses da empresa.</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.emailOpportunities}
              onChange={() => handleToggle("emailOpportunities")}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between pt-3 cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-slate-900">Resumo semanal</p>
              <p className="text-xs text-slate-500">Um digest com status do Kanban e próximos prazos.</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.emailWeeklyDigest}
              onChange={() => handleToggle("emailWeeklyDigest")}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* No Sistema */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
          No Sistema
        </h3>

        <div className="space-y-4 divide-y divide-slate-100">
          <label className="flex items-center justify-between pt-2 cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-slate-900">Avisos de prazo na plataforma</p>
              <p className="text-xs text-slate-500">Exibe alertas na interface quando houver prazos próximos.</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.systemDeadlineAlerts}
              onChange={() => handleToggle("systemDeadlineAlerts")}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between pt-3 cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-slate-900">Análise concluída na plataforma</p>
              <p className="text-xs text-slate-500">Mostra notificação quando a IA terminar de processar um edital.</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.systemAiAnalysis}
              onChange={() => handleToggle("systemAiAnalysis")}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl text-sm transition-colors shadow-sm"
        >
          {saving ? "Salvando..." : "Salvar preferências"}
        </button>
      </div>
    </div>
  );
}