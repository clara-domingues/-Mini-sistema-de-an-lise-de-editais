"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Nav() {
  const router = useRouter();
  const supabase = createClient();

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-white border-b">
      <div className="max-w-3xl mx-auto flex items-center justify-between p-4">
        <span className="font-bold text-slate-900">EditalAI</span>
        <nav className="flex gap-4 text-sm items-center">
          <Link href="/perfil" className="text-slate-600 hover:text-blue-600">Perfil</Link>
          <Link href="/editais" className="text-slate-600 hover:text-blue-600">Editais</Link>
          <button onClick={logout} className="text-red-600">Sair</button>
        </nav>
      </div>
    </header>
  );
}