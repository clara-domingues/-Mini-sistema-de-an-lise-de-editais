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

    // tabela markdown
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
          rows: rows.map(
            (r, ri) =>
              new TableRow({
                tableHeader: ri === 0,
                children: r.map(
                  (c) =>
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: ri === 0 ? [new TextRun({ text: c, bold: true })] : runs(c),
                        }),
                      ],
                    })
                ),
              })
          ),
        })
      );
      children.push(new Paragraph(""));
      continue;
    }

    if (line.startsWith("# ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: line.slice(2), bold: true })],
        })
      );
    } else if (line.startsWith("## ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: line.slice(3), bold: true })],
        })
      );
    } else if (line.startsWith("- ")) {
      children.push(new Paragraph({ bullet: { level: 0 }, children: runs(line.slice(2)) }));
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