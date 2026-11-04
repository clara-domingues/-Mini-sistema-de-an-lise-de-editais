import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, AlignmentType,
} from "docx";

function runs(text: string): TextRun[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((p) =>
      p.startsWith("**") && p.endsWith("**")
        ? new TextRun({ text: p.slice(2, -2), bold: true })
        : new TextRun(p)
    );
}

export async function baixarDocx(md: string, nome: string) {
  const lines = md.split("\n");
  const children: (Paragraph | Table)[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();

    if (!line.trim()) { i++; continue; }

    // Tabela markdown
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{3,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          // Remove margens/espaçamento externo da tabela se necessário
          rows: rows.map(
            (r, ri) =>
              new TableRow({
                tableHeader: ri === 0,
                children: r.map(
                  (c) =>
                    new TableCell({
                      // Remove ou reduz o espaçamento interno (padding) das células da tabela/BDI
                      margins: {
                        top: 60,    // Valor menor (padrão costuma ser maior)
                        bottom: 60,
                        left: 100,
                        right: 100,
                      },
                      children: [
                        new Paragraph({
                          // Remove margens de espaçamento pós-parágrafo dentro da tabela
                          spacing: { after: 0, before: 0 },
                          children: ri === 0 ? [new TextRun({ text: c, bold: true })] : runs(c),
                        }),
                      ],
                    })
                ),
              })
          ),
        })
      );
      // Espaçamento reduzido após a tabela (era parágrafo vazio, agora controlamos via espaçamento ou reduzimos)
      children.push(new Paragraph({ spacing: { after: 120 } }));
      continue;
    }

    if (line.startsWith("# ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 120, before: 120 },
          children: [new TextRun({ text: line.slice(2), bold: true })],
        })
      );
    } else if (line.startsWith("## ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 100, before: 100 },
          children: [new TextRun({ text: line.slice(3), bold: true })],
        })
      );
    } else if (line.startsWith("- ")) {
      children.push(
        new Paragraph({ 
          bullet: { level: 0 }, 
          spacing: { after: 60 },
          children: runs(line.slice(2)) 
        })
      );
    } else {
      children.push(new Paragraph({ spacing: { after: 120 }, children: runs(line) }));
    }
    i++;
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}