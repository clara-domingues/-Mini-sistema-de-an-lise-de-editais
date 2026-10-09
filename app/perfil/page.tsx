"use client";

import {
  useCallback,
  useEffect,
  useState,
  useMemo,
  type FormEvent,
} from "react";

import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";

type Profile = {
  razao_social: string;
  cnpj: string;
  banco: string;
  agencia: string;
  conta: string;
  responsavel_nome: string;
  responsavel_cpf: string;
  responsavel_cargo: string;
};

type Message = {
  type: "ok" | "err";
  text: string;
};

const emptyProfile: Profile = {
  razao_social: "",
  cnpj: "",
  banco: "",
  agencia: "",
  conta: "",
  responsavel_nome: "",
  responsavel_cpf: "",
  responsavel_cargo: "",
};

const sections: {
  title: string;
  description: string;
  fields: {
    key: keyof Profile;
    label: string;
    placeholder: string;
    required?: boolean;
  }[];
}[] = [
  {
    title: "Dados da empresa",
    description: "Informações de identificação da empresa.",
    fields: [
      {
        key: "razao_social",
        label: "Razão social",
        placeholder: "Nome registrado da empresa",
        required: true,
      },
      {
        key: "cnpj",
        label: "CNPJ",
        placeholder: "00.000.000/0000-00",
      },
    ],
  },
  {
    title: "Dados bancários",
    description: "Informações bancárias utilizadas nas propostas.",
    fields: [
      {
        key: "banco",
        label: "Banco",
        placeholder: "Nome do banco",
      },
      {
        key: "agencia",
        label: "Agência",
        placeholder: "Número da agência",
      },
      {
        key: "conta",
        label: "Conta",
        placeholder: "Número da conta",
      },
    ],
  },
  {
    title: "Responsável legal",
    description: "Dados da pessoa responsável pela empresa.",
    fields: [
      {
        key: "responsavel_nome",
        label: "Nome completo",
        placeholder: "Nome do responsável legal",
      },
      {
        key: "responsavel_cpf",
        label: "CPF",
        placeholder: "000.000.000-00",
      },
      {
        key: "responsavel_cargo",
        label: "Cargo",
        placeholder: "Ex.: Sócio-administrador",
      },
    ],
  },
];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocorreu um erro inesperado. Tente novamente.";
}

export default function PerfilPage() {
  const supabase = useMemo(() => createClient(), []);

  const [form, setForm] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Message | null>(null);

 const loadProfile = useCallback(async () => {
  setMsg(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(
          "Não foi possível verificar sua autenticação. Entre novamente."
        );
      }

      if (!user) {
        setMsg({
          type: "err",
          text: "Você precisa estar autenticado para acessar seu perfil.",
        });

        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "razao_social, cnpj, banco, agencia, conta, responsavel_nome, responsavel_cpf, responsavel_cargo"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        throw new Error("Não foi possível carregar os dados do perfil.");
      }

      if (data) {
        setForm({
          razao_social: data.razao_social ?? "",
          cnpj: data.cnpj ?? "",
          banco: data.banco ?? "",
          agencia: data.agencia ?? "",
          conta: data.conta ?? "",
          responsavel_nome: data.responsavel_nome ?? "",
          responsavel_cpf: data.responsavel_cpf ?? "",
          responsavel_cargo: data.responsavel_cargo ?? "",
        });
      } else {
        setForm({ ...emptyProfile });
      }
    } catch (error: unknown) {
      setMsg({
        type: "err",
        text: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

 useEffect(() => {
  const timer = window.setTimeout(() => {
    void loadProfile();
  }, 0);

  return () => {
    window.clearTimeout(timer);
  };
}, [loadProfile]);
  function handleChange(
    field: keyof Profile,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setMsg(null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error(
          "Sua sessão não está válida. Entre novamente para salvar."
        );
      }

      if (!form.razao_social.trim()) {
        throw new Error("Informe a razão social da empresa.");
      }

      const profileToSave = {
        id: user.id,
        razao_social: form.razao_social.trim(),
        cnpj: form.cnpj.trim(),
        banco: form.banco.trim(),
        agencia: form.agencia.trim(),
        conta: form.conta.trim(),
        responsavel_nome: form.responsavel_nome.trim(),
        responsavel_cpf: form.responsavel_cpf.trim(),
        responsavel_cargo: form.responsavel_cargo.trim(),
      };

      const { error } = await supabase
        .from("profiles")
        .upsert(profileToSave, {
          onConflict: "id",
        });

      if (error) {
        throw new Error(
          "Não foi possível salvar o perfil. Verifique sua conexão e tente novamente."
        );
      }

      setMsg({
        type: "ok",
        text: "Perfil da empresa salvo com sucesso!",
      });
    } catch (error: unknown) {
      setMsg({
        type: "err",
        text: getErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Nav />

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="mb-8">
          <span className="text-sm font-semibold uppercase tracking-wider text-blue-600">
            Configurações
          </span>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Perfil da empresa
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Mantenha os dados da sua empresa atualizados para facilitar
            o preenchimento de propostas e a organização das informações
            utilizadas nas análises de editais.
          </p>
        </header>

        {msg && (
          <div
            role="status"
            aria-live="polite"
            className={`mb-6 rounded-xl border p-4 text-sm ${
              msg.type === "ok"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {msg.text}
          </div>
        )}

        {loading ? (
          <div
            className="rounded-xl border border-slate-200 bg-white p-8 text-center"
            role="status"
          >
            <p className="font-medium text-slate-700">
              Carregando perfil...
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Estamos buscando os dados da sua empresa.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="mb-5 border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {section.title}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {section.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {section.fields.map((field) => (
                    <label
                      key={field.key}
                      className="block text-sm"
                    >
                      <span className="font-medium text-slate-700">
                        {field.label}

                        {field.required && (
                          <span className="ml-1 text-red-600">
                            *
                          </span>
                        )}
                      </span>

                      <input
                        type="text"
                        name={field.key}
                        value={form[field.key]}
                        onChange={(event) =>
                          handleChange(
                            field.key,
                            event.target.value
                          )
                        }
                        placeholder={field.placeholder}
                        required={field.required}
                        autoComplete="off"
                        disabled={saving}
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    </label>
                  ))}
                </div>
              </section>
            ))}

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-500">
                Confira os dados antes de salvar. Eles poderão ser
                utilizados no preenchimento de propostas.
              </p>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </form>
        )}
      </main>
    </>
  );
}