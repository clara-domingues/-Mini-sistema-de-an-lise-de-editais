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

const cardClass =
  "space-y-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors";

const cardTitleClass =
  "border-b border-slate-100 dark:border-slate-800 pb-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500";

const checkboxClass =
  "h-4 w-4 cursor-pointer rounded border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-blue-600 focus:ring-blue-500";

const itemTitleClass = "text-sm font-semibold text-slate-900 dark:text-slate-100";
const itemDescClass = "text-xs text-slate-500 dark:text-slate-400";

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
        <h2 className="border-b border-slate-100 dark:border-slate-800 pb-2 text-base font-bold text-slate-900 dark:text-white">
          Notificações
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Escolha como e quando o BidMaster deve avisar sobre prazos, análises e oportunidades.
        </p>
      </div>

      {msg && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            msg.type === "ok"
              ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
              : "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* E-mail */}
      <div className={cardClass}>
        <h3 className={cardTitleClass}>E-mail</h3>

        <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
          <label className="flex cursor-pointer items-center justify-between pt-2">
            <div>
              <p className={itemTitleClass}>Alertas de prazo</p>
              <p className={itemDescClass}>
                Receba e-mail quando um edital estiver próximo da data limite.
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.emailAlerts}
              onChange={() => handleToggle("emailAlerts")}
              className={checkboxClass}
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between pt-3">
            <div>
              <p className={itemTitleClass}>Análise da IA concluída</p>
              <p className={itemDescClass}>
                Avise quando a análise automática de um edital for finalizada.
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.emailAiAnalysis}
              onChange={() => handleToggle("emailAiAnalysis")}
              className={checkboxClass}
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between pt-3">
            <div>
              <p className={itemTitleClass}>Novas oportunidades</p>
              <p className={itemDescClass}>
                Sugestões de editais alinhados aos interesses da empresa.
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.emailOpportunities}
              onChange={() => handleToggle("emailOpportunities")}
              className={checkboxClass}
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between pt-3">
            <div>
              <p className={itemTitleClass}>Resumo semanal</p>
              <p className={itemDescClass}>Um digest com status do Kanban e próximos prazos.</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.emailWeeklyDigest}
              onChange={() => handleToggle("emailWeeklyDigest")}
              className={checkboxClass}
            />
          </label>
        </div>
      </div>

      {/* No Sistema */}
      <div className={cardClass}>
        <h3 className={cardTitleClass}>No Sistema</h3>

        <div className="space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
          <label className="flex cursor-pointer items-center justify-between pt-2">
            <div>
              <p className={itemTitleClass}>Avisos de prazo na plataforma</p>
              <p className={itemDescClass}>
                Exibe alertas na interface quando houver prazos próximos.
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.systemDeadlineAlerts}
              onChange={() => handleToggle("systemDeadlineAlerts")}
              className={checkboxClass}
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between pt-3">
            <div>
              <p className={itemTitleClass}>Análise concluída na plataforma</p>
              <p className={itemDescClass}>
                Mostra notificação quando a IA terminar de processar um edital.
              </p>
            </div>
            <input
              type="checkbox"
              checked={prefs.systemAiAnalysis}
              onChange={() => handleToggle("systemAiAnalysis")}
              className={checkboxClass}
            />
          </label>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar preferências"}
        </button>
      </div>
    </div>
  );
}