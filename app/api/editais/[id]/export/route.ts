// app/api/editais/[id]/export/route.ts
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

/* =========================================================
   TIPOS (locais, sem depender de outros arquivos)
========================================================= */
type Periodicidade = "MENSAL" | "ANUAL" | "UNICO" | "POR_DEMANDA" | "DEPRECIACAO";

type ItemEntrada = {
  item?: string;
  nome?: string;
  grupo?: string;
  quantidade?: number | null;
  quantidade_padrao?: number | null;
  preco_unitario_estimado?: number | null;
  preco_unitario?: number | null;
  periodicidade?: string;
  depreciacao_meses?: number | null;
  requer_validacao?: boolean;
};

type LinhaFuncaoEntrada = {
  tipo?: string;
  name?: string;
  quantidade_padrao?: number | null;
  valor_unit?: number | null;
  preco_override?: number | null;
  depreciacao_meses?: number | null;
  periodicidade?: string;
  requer_validacao?: boolean;
};

type FuncaoEntrada = {
  nome?: string;
  escala?: string | null;
  quantidade_postos?: number | null;
  insalubridade_pct?: number | null;
  periculosidade_pct?: number | null;
  linhas?: LinhaFuncaoEntrada[];
};

type Corpo = {
  titulo?: string | null;
  valorEstimado?: number | null;
  dimensionamento?: { itens?: ItemEntrada[]; funcoes?: FuncaoEntrada[] };
};

type Linha = {
  nome: string;
  quantidade: number | null;
  preco: number | null;
  per: Periodicidade;
  meses: number | null;
  pendente: boolean;
};

/* =========================================================
   ESTILO
========================================================= */
const BRL = '_("R$"* #,##0.00_);_("R$"* (#,##0.00);_("R$"* "-"??_);_(@_)';
const thin: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FF000000" } };
const BORDER: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };
const GREY: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E6" } };
const AMARELO: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
const RED = { argb: "FFFF0000" };

const ROTULO_PER: Record<Periodicidade, string> = {
  MENSAL: "Mensal",
  ANUAL: "Anual",
  UNICO: "Único",
  POR_DEMANDA: "Por demanda",
  DEPRECIACAO: "Deprec.",
};

const ROTULO_GRUPO: Record<string, string> = {
  MATERIAL: "Materiais e insumos",
  EPI: "Equipamentos de proteção individual",
  EXAME: "Exames ocupacionais",
  TREINAMENTO: "Treinamentos",
  UNIFORME: "Uniformes",
  EQUIPAMENTO: "Equipamentos",
  SERVICO: "Serviços",
  MAO_DE_OBRA: "Mão de obra",
  BENEFICIO: "Benefícios",
  ENCARGO: "Encargos",
  CUSTO_INDIRETO: "Custos indiretos",
  OUTRO: "Outros",
};

type Opt = {
  bold?: boolean;
  red?: boolean;
  fmt?: string;
  align?: ExcelJS.Alignment["horizontal"];
  fill?: ExcelJS.Fill;
  wrap?: boolean;
  size?: number;
};

function set(ws: ExcelJS.Worksheet, addr: string, value: ExcelJS.CellValue, o: Opt = {}) {
  const c = ws.getCell(addr);
  c.value = value;
  c.font = { name: "Calibri", size: o.size ?? 11, bold: !!o.bold, color: o.red ? RED : undefined };
  c.border = BORDER;
  c.alignment = { horizontal: o.align ?? "left", vertical: "middle", wrapText: o.wrap };
  if (o.fmt) c.numFmt = o.fmt;
  if (o.fill) c.fill = o.fill;
  return c;
}

/* =========================================================
   CÁLCULOS (mesma regra da tela)
========================================================= */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normPer(v: unknown): Periodicidade {
  const s = String(v ?? "").toUpperCase();
  return s in ROTULO_PER ? (s as Periodicidade) : "MENSAL";
}

function arred(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function custoMensal(
  q: number | null,
  p: number | null,
  per: Periodicidade,
  meses: number | null
): number | null {
  if (q === null || p === null) return null;
  const sub = q * p;
  switch (per) {
    case "MENSAL":
      return sub;
    case "ANUAL":
      return sub / 12;
    case "DEPRECIACAO":
      return meses !== null && meses > 0 ? sub / meses : null;
    default:
      return null; // ÚNICO e POR DEMANDA não entram no custo mensal
  }
}

function linhaDeItem(i: ItemEntrada): Linha {
  const quantidade = num(i.quantidade ?? i.quantidade_padrao);
  const preco = num(i.preco_unitario_estimado ?? i.preco_unitario);
  return {
    nome: String(i.item ?? i.nome ?? "").trim() || "Item",
    quantidade,
    preco,
    per: normPer(i.periodicidade),
    meses: num(i.depreciacao_meses),
    pendente: i.requer_validacao === true || quantidade === null || preco === null,
  };
}

function linhaDeFuncao(l: LinhaFuncaoEntrada): Linha {
  const preco = num(l.preco_override ?? l.valor_unit);
  return {
    nome: String(l.name ?? "").trim() || "Item",
    quantidade: num(l.quantidade_padrao),
    preco,
    per: l.periodicidade ? normPer(l.periodicidade) : "DEPRECIACAO",
    meses: num(l.depreciacao_meses),
    pendente: l.requer_validacao === true || preco === null,
  };
}

/* =========================================================
   BLOCOS DO LAYOUT
========================================================= */
function titulo(ws: ExcelJS.Worksheet, start: number, texto: string, logoId: number | null) {
  set(ws, `A${start}`, texto.toUpperCase(), {
    bold: true,
    size: 16,
    align: "center",
    fill: GREY,
    wrap: true,
  });
  ws.mergeCells(`A${start}:J${start + 2}`);
  if (logoId !== null) {
    ws.addImage(logoId, { tl: { col: 0.15, row: start - 1 + 0.1 }, ext: { width: 110, height: 55 } });
  }
  return start + 3;
}

/** side "L" = colunas A–E (com quantidade) | "R" = colunas G–J (exames/treinamentos) */
function tabela(ws: ExcelJS.Worksheet, start: number, side: "L" | "R", tit: string, linhas: Linha[]) {
  if (linhas.length === 0) return { proxima: start, total: null as string | null, valor: 0 };

  const L = side === "L";
  const cols = L ? ["A", "B", "C", "D", "E"] : ["G", "H", "I", "J"];
  const first = cols[0];
  const last = cols[cols.length - 1];
  const cDesc = cols[0];
  const cQtd = L ? cols[1] : "";
  const cPreco = L ? cols[2] : cols[1];
  const cDep = L ? cols[3] : cols[2];

  set(ws, `${first}${start}`, tit, { bold: true, align: "center", fill: GREY });
  ws.mergeCells(`${first}${start}:${last}${start}`);

  const heads = L
    ? ["DESCRIÇÃO", "QUANT.", "VALOR UNIT.", "PERIODICIDADE / DEPREC. (MESES)", "VALOR MENSAL UNITÁRIO"]
    : ["DESCRIÇÃO", "VALOR UNIT.", "DEPRECIAÇÃO (MESES)", "VALOR MENSAL UNITÁRIO"];
  heads.forEach((h, i) =>
    set(ws, `${cols[i]}${start + 1}`, h, { bold: true, align: "center", wrap: true })
  );
  ws.getRow(start + 1).height = 32;

  let r = start + 2;
  const firstRow = r;
  let valor = 0;

  for (const l of linhas) {
    const dep = l.per === "DEPRECIACAO";
    const calcula = l.per === "MENSAL" || l.per === "ANUAL" || dep;

    set(ws, `${cDesc}${r}`, l.nome, { fill: l.pendente ? AMARELO : undefined, wrap: true });
    if (L) set(ws, `${cQtd}${r}`, l.quantidade, { red: true, align: "center" });
    set(ws, `${cPreco}${r}`, l.preco, { red: true, fmt: BRL });
    set(ws, `${cDep}${r}`, dep ? l.meses : ROTULO_PER[l.per], { red: true, align: "center" });

    if (!calcula) {
      set(ws, `${last}${r}`, "—", { red: true, align: "center" });
    } else {
      const q = L ? `${cQtd}${r}` : String(l.quantidade ?? 1);
      const p = `${cPreco}${r}`;
      const d = `${cDep}${r}`;
      const guarda = [L ? `${q}=""` : null, `${p}=""`, dep ? `N(${d})<=0` : null]
        .filter(Boolean)
        .join(",");
      const corpo =
        l.per === "ANUAL" ? `${q}*${p}/12` : dep ? `${q}*${p}/${d}` : `${q}*${p}`;

      const custo = custoMensal(L ? l.quantidade : l.quantidade ?? 1, l.preco, l.per, l.meses);
      if (custo !== null) valor += custo;

      set(
        ws,
        `${last}${r}`,
        { formula: `IF(OR(${guarda}),"",${corpo})`, result: custo === null ? "" : arred(custo) },
        { red: true, fmt: BRL }
      );
    }
    r++;
  }

  cols.slice(0, -2).forEach((c) => set(ws, `${c}${r}`, "", { fill: GREY }));
  set(ws, `${cols[cols.length - 2]}${r}`, "TOTAL", { bold: true, align: "center", fill: GREY });
  set(
    ws,
    `${last}${r}`,
    { formula: `SUM(${last}${firstRow}:${last}${r - 1})`, result: arred(valor) },
    { bold: true, red: true, fmt: BRL, fill: GREY }
  );

  return { proxima: r + 1, total: `${last}${r}` as string | null, valor };
}

function adicional(ws: ExcelJS.Worksheet, row: number, rotulo: string, pct: number | null | undefined) {
  const p = num(pct) ?? 0;
  set(ws, `A${row}`, rotulo, { bold: true });
  ws.mergeCells(`A${row}:B${row}`);
  set(ws, `C${row}`, p > 0 ? "SIM" : "Não", { bold: true, red: true, align: "center" });
  set(ws, `D${row}`, "Percentual:", { bold: true, align: "center" });
  set(ws, `E${row}`, p / 100, { bold: true, red: true, fmt: "0%", align: "center" });
  return row + 1;
}

function blocoFuncao(
  ws: ExcelJS.Worksheet,
  start: number,
  f: FuncaoEntrada,
  logoId: number | null
) {
  const nome = String(f.nome ?? "Função");
  const r0 = titulo(ws, start, `${nome}${f.escala ? " - " + f.escala : ""}`, logoId) + 1;

  const linhas: LinhaFuncaoEntrada[] = f.linhas ?? [];
  const epis = linhas.filter((l: LinhaFuncaoEntrada) => l.tipo === "EPI").map(linhaDeFuncao);
  const exames = linhas.filter((l: LinhaFuncaoEntrada) => l.tipo === "EXAME").map(linhaDeFuncao);
  const trein = linhas.filter((l: LinhaFuncaoEntrada) => l.tipo === "TREINAMENTO").map(linhaDeFuncao);
  const outros = linhas
    .filter((l: LinhaFuncaoEntrada) => !["EPI", "EXAME", "TREINAMENTO"].includes(String(l.tipo)))
    .map(linhaDeFuncao);

  const totais: string[] = [];
  let valor = 0;

  // esquerda: EPIs + insalubridade/periculosidade (+ outros)
  let rl = r0;
  const a = tabela(ws, rl, "L", "EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL", epis);
  rl = a.proxima;
  if (a.total) totais.push(a.total);
  valor += a.valor;
  rl = adicional(ws, rl, "Recebe insalubridade?", f.insalubridade_pct);
  rl = adicional(ws, rl, "Recebe periculosidade?", f.periculosidade_pct);
  if (outros.length) {
    const o = tabela(ws, rl + 1, "L", "OUTROS ITENS", outros);
    rl = o.proxima;
    if (o.total) totais.push(o.total);
    valor += o.valor;
  }

  // direita: exames e treinamentos
  let rr = r0;
  const e = tabela(ws, rr, "R", `EXAMES - ${nome.toUpperCase()}`, exames);
  rr = e.proxima + (e.total ? 1 : 0);
  if (e.total) totais.push(e.total);
  valor += e.valor;
  const t = tabela(ws, rr, "R", "TREINAMENTOS ESPECÍFICOS", trein);
  rr = t.proxima;
  if (t.total) totais.push(t.total);
  valor += t.valor;

  const postos = num(f.quantidade_postos) || 1;
  return { proxima: Math.max(rl, rr) + 1, totais, valor, postos };
}

function blocoItens(
  ws: ExcelJS.Worksheet,
  start: number,
  tit: string,
  itens: ItemEntrada[],
  logoId: number | null
) {
  let r = titulo(ws, start, tit, logoId) + 1;

  const porGrupo = new Map<string, Linha[]>();
  for (const item of itens) {
    const chave = String(item.grupo ?? "OUTRO").toUpperCase();
    const g = ROTULO_GRUPO[chave] ?? chave;
    porGrupo.set(g, [...(porGrupo.get(g) ?? []), linhaDeItem(item)]);
  }

  const totais: string[] = [];
  let valor = 0;
  for (const [grupo, linhas] of porGrupo) {
    const t = tabela(ws, r, "L", grupo.toUpperCase(), linhas);
    r = t.proxima + 1;
    if (t.total) totais.push(t.total);
    valor += t.valor;
  }
  return { proxima: r, totais, valor };
}

function resumo(
  ws: ExcelJS.Worksheet,
  start: number,
  estimado: number | null,
  formula: string,
  custo: number,
  pendentes: number
) {
  set(ws, `A${start}`, "RESUMO DO DIMENSIONAMENTO", { bold: true, align: "center", fill: GREY });
  ws.mergeCells(`A${start}:E${start}`);

  const linha = (row: number, rotulo: string, v: ExcelJS.CellValue, fmt?: string) => {
    set(ws, `A${row}`, rotulo, { bold: true });
    ws.mergeCells(`A${row}:D${row}`);
    set(ws, `E${row}`, v, { bold: true, red: true, fmt, align: "right" });
  };

  linha(start + 1, "Valor estimado do edital", estimado, BRL);
  linha(start + 2, "Custo mensal calculado", { formula: formula || "0", result: arred(custo) }, BRL);
  linha(start + 3, "Itens pendentes de validação", pendentes);

  const nota = ws.getCell(`A${start + 4}`);
  nota.value = "Os totais somam apenas itens com quantidade e preço informados.";
  nota.font = { name: "Calibri", size: 9, italic: true };
  return start + 5;
}

function carregarLogo(wb: ExcelJS.Workbook): number | null {
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), "public", "logo-seguro.png"));
    return wb.addImage({ buffer: buf as unknown as ExcelJS.Buffer, extension: "png" });
  } catch {
    return null; // sem logo, segue sem imagem
  }
}

/* =========================================================
   ROTA  (POST /api/editais/[id]/export)
========================================================= */
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const { id: editalId } = await Promise.resolve(context.params);
    const corpo = (await req.json()) as Corpo;

    const itens: ItemEntrada[] = corpo.dimensionamento?.itens ?? [];
    const funcoes: FuncaoEntrada[] = corpo.dimensionamento?.funcoes ?? [];

    if (itens.length === 0 && funcoes.length === 0) {
      return NextResponse.json(
        { error: "Não há itens no dimensionamento para exportar." },
        { status: 400 }
      );
    }

    const wb = new ExcelJS.Workbook();
    wb.calcProperties = { fullCalcOnLoad: true };
    const ws = wb.addWorksheet("DIMENSIONAMENTO", { views: [{ showGridLines: false }] });
    ws.columns = [
      { width: 48 }, { width: 12 }, { width: 16 }, { width: 22 }, { width: 20 }, // A–E
      { width: 4 },                                                                // F
      { width: 38 }, { width: 16 }, { width: 18 }, { width: 20 },                 // G–J
    ];
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

    const logoId = carregarLogo(wb);
    const partes: string[] = [];
    let custo = 0;
    let r = 1;

    if (itens.length > 0) {
      const b = blocoItens(ws, r, corpo.titulo?.trim() || "Itens do edital", itens, logoId);
      r = b.proxima;
      partes.push(...b.totais);
      custo += b.valor;
    }

    for (const f of funcoes) {
      const b = blocoFuncao(ws, r, f, logoId);
      r = b.proxima;
      if (b.totais.length) partes.push(`(${b.totais.join("+")})*${b.postos}`);
      custo += b.valor * b.postos;
    }

    const pendentes = itens.filter(
      (i: ItemEntrada) =>
        i.requer_validacao === true ||
        num(i.quantidade ?? i.quantidade_padrao) === null ||
        num(i.preco_unitario_estimado ?? i.preco_unitario) === null
    ).length;

    resumo(ws, r, num(corpo.valorEstimado), partes.join("+"), custo, pendentes);

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="dimensionamento_${editalId}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Erro ao gerar Excel estilizado:", error);
    return NextResponse.json({ error: "Erro interno ao gerar o Excel" }, { status: 500 });
  }
}