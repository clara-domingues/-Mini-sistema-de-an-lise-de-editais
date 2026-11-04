import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Ajuste se o seu catalog_items usa outros nomes de coluna
const NOME_COL = "name";
const VALOR_COL = "unit_price";

type Tipo = "EPI" | "EXAME" | "TREINAMENTO";
type Linha = { tipo: Tipo; nome: string; quant: number; valor: number; deprec: number };
type Bloco = { nome: string; escala: string | null; insal: number; perig: number; linhas: Linha[] };

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

function val(ws: ExcelJS.Worksheet, r: number, c: number): unknown {
  const cell = ws.getCell(r, c);
  const v = cell.value;
  if (v && typeof v === "object") {
    if ("result" in v) return (v as { result?: unknown }).result;
    if ("richText" in v && Array.isArray((v as { richText?: unknown[] }).richText)) {
      return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
    }
    if ("text" in v) return (v as { text?: unknown }).text;
  }
  return v;
}

const txt = (ws: ExcelJS.Worksheet, r: number, c: number) => String(val(ws, r, c) ?? "").trim();
const num = (ws: ExcelJS.Worksheet, r: number, c: number) => {
  const v = val(ws, r, c);
  return typeof v === "number" ? v : NaN;
};
const pct = (v: number, padrao: number) => (isNaN(v) ? padrao : v <= 1 ? v * 100 : v);

function lerBlocos(ws: ExcelJS.Worksheet): Bloco[] {
  const ultima = ws.rowCount;
  const cabecalhos: number[] = [];
  for (let r = 1; r <= ultima; r++) {
    if (norm(txt(ws, r, 1)) === "EQUIPAMENTOS DE PROTECAO INDIVIDUAL") cabecalhos.push(r);
  }

  return cabecalhos.map((h, i) => {
    const fim = (cabecalhos[i + 1] ?? ultima + 2) - 2;

    // nome da função: primeiro texto em caixa alta acima do cabeçalho
    let nome = `FUNCAO_LINHA_${h}`;
    for (let r = h - 1; r >= 1; r--) {
      const t = norm(txt(ws, r, 1));
      if (/[A-Z]{4,}/.test(t) && !/^(EQUIPAMENTOS|DESCRI|TOTAL)/.test(t)) {
        nome = txt(ws, r, 1);
        break;
      }
    }
    const m = nome.match(/(\d+)\s*X\s*(\d+)/i);
    const bloco: Bloco = { nome, escala: m ? `${m[1]}x${m[2]}` : null, insal: 0, perig: 0, linhas: [] };

    // EPIs (colunas A..E): descrição, quant, valor unit, depreciação, valor mensal
    for (let r = h + 2; r <= fim; r++) {
      if (norm(txt(ws, r, 4)) === "TOTAL") break;
      const d = txt(ws, r, 1), q = num(ws, r, 2), v = num(ws, r, 3), dep = num(ws, r, 4);
      if (d && !isNaN(q) && !isNaN(v) && !isNaN(dep)) {
        bloco.linhas.push({ tipo: "EPI", nome: d, quant: q, valor: v, deprec: dep });
      }
    }

    // insalubridade / periculosidade
    for (let r = h; r <= fim; r++) {
      const a = norm(txt(ws, r, 1));
      if (a.startsWith("RECEBE INSALUBRIDADE")) {
        bloco.insal = norm(txt(ws, r, 3)) === "SIM" ? pct(num(ws, r, 5), 20) : 0;
      }
      if (a.startsWith("RECEBE PERICULOSIDADE")) {
        bloco.perig = norm(txt(ws, r, 3)) === "SIM" ? pct(num(ws, r, 5), 30) : 0;
      }
    }

    // Exames e Treinamentos (colunas G..J): descrição, valor unit, depreciação, valor mensal
    let modo: Tipo | null = null;
    for (let r = h; r <= fim; r++) {
      const g = norm(txt(ws, r, 7));
      if (g.startsWith("EXAMES")) { modo = "EXAME"; continue; }
      if (g.startsWith("TREINAMENTOS")) { modo = "TREINAMENTO"; continue; }
      if (!modo) continue;
      if (/^TOTA/.test(norm(txt(ws, r, 9)))) { modo = null; continue; } // pega "TOTA" (typo da planilha)
      if (!g || g === "DESCRICAO") continue;
      const v = num(ws, r, 8), dep = num(ws, r, 9);
      if (!isNaN(v) && !isNaN(dep)) {
        bloco.linhas.push({ tipo: modo, nome: txt(ws, r, 7), quant: 1, valor: v, deprec: dep });
      }
    }
    return bloco;
  });
}

async function main() {
  const args = process.argv.slice(2);
  const arquivo = args.find((a) => !a.startsWith("--"));
  const tenant = args[args.indexOf("--tenant") + 1];
  const aplicar = args.includes("--apply");
  if (!arquivo || !tenant) {
    console.error('Uso: npx tsx scripts/importar-epis.ts "arquivo.xlsx" --tenant <uuid> [--apply]');
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arquivo);
  const ws = wb.getWorksheet("EPIS") ?? wb.worksheets[0];
  const blocos = lerBlocos(ws);

  // consolida itens: mesma chave = mesmo item do catálogo; preço base = o mais frequente
  const grupos = new Map<string, { tipo: Tipo; nome: string; ocorr: Linha[] }>();
  for (const b of blocos) for (const l of b.linhas) {
    const k = `${l.tipo}|${norm(l.nome)}`;
    if (!grupos.has(k)) grupos.set(k, { tipo: l.tipo, nome: l.nome, ocorr: [] });
    grupos.get(k)!.ocorr.push(l);
  }
  const base = new Map<string, { valor: number; deprec: number }>();
  const conflitos: string[] = [];
  for (const [k, g] of grupos) {
    const cont = new Map<string, number>();
    g.ocorr.forEach((o) => cont.set(`${o.valor}|${o.deprec}`, (cont.get(`${o.valor}|${o.deprec}`) ?? 0) + 1));
    const [melhor] = [...cont.entries()].sort((a, b) => b[1] - a[1])[0];
    const [valor, deprec] = melhor.split("|").map(Number);
    base.set(k, { valor, deprec });
    if (cont.size > 1) conflitos.push(`${g.tipo} ${g.nome}: preços ${[...cont.keys()].map((x) => x.split("|")[0]).join(" / ")} (usei ${valor})`);
  }

  console.log(`\nFunções encontradas: ${blocos.length}`);
  blocos.forEach((b) =>
    console.log(` - ${b.nome} | escala ${b.escala ?? "-"} | insal ${b.insal}% | peric ${b.perig}% | ${b.linhas.length} linhas`));
  console.log(`\nItens distintos no catálogo: ${grupos.size}`);
  console.log(`\nPreços divergentes entre funções (${conflitos.length}):`);
  conflitos.forEach((c) => console.log(" ! " + c));

  if (!aplicar) { console.log("\nSimulação. Nada foi gravado. Rode com --apply para gravar."); return; }

 const sb = createClient(
    "https://jauyhikogisucwycfwor.supabase.co", 
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphdXloaWtvZ2lzdWN3eWNmd29yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTQ2NjEzOSwiZXhwIjoyMTA3MDQyMTM5fQ.cDRxKbMclZ7ZJa3N47D7xfuYOKg_OYT99_FRCyv5c7w"
  );
 const itens = [...grupos.entries()].map(([k, g]) => ({
  tenant_id: tenant,
  tipo: g.tipo,
  type: g.tipo === "EPI" ? "Produto" : "Serviço",
  unit: "UN",
  [NOME_COL]: g.nome,
  nome_normalizado: norm(g.nome),
  [VALOR_COL]: base.get(k)!.valor,
  depreciacao_meses: base.get(k)!.deprec,
}));
  const { data: cat, error: e1 } = await sb.from("catalog_items")
    .upsert(itens, { onConflict: "tenant_id,tipo,nome_normalizado" }).select("id,tipo,nome_normalizado");
  if (e1) throw e1;
  const idItem = new Map(cat!.map((c: Record<string, unknown>) => [`${c.tipo}|${c.nome_normalizado}`, c.id]));

  const funcoes = blocos.map((b) => ({
    tenant_id: tenant, nome: b.nome, escala: b.escala,
    insalubridade_pct: b.insal, periculosidade_pct: b.perig,
  }));
  const { data: roles, error: e2 } = await sb.from("job_roles")
    .upsert(funcoes, { onConflict: "tenant_id,nome" }).select("id,nome");
  if (e2) throw e2;
  const idRole = new Map(roles!.map((r: Record<string, unknown>) => [r.nome, r.id]));

  const vinculos = blocos.flatMap((b) => b.linhas.map((l) => {
    const k = `${l.tipo}|${norm(l.nome)}`;
    const bs = base.get(k)!;
    return {
      role_id: idRole.get(b.nome), item_id: idItem.get(`${l.tipo}|${norm(l.nome)}`),
      quantidade_padrao: l.quant,
      preco_override: l.valor !== bs.valor ? l.valor : null,
      depreciacao_override: l.deprec !== bs.deprec ? l.deprec : null,
    };
  }));
  const { error: e3 } = await sb.from("job_role_items").upsert(vinculos, { onConflict: "role_id,item_id" });
  if (e3) throw e3;

  console.log(`\nGravado: ${cat!.length} itens, ${roles!.length} funções, ${vinculos.length} vínculos.`);
}
main().catch((e) => { console.error(e); process.exit(1); });