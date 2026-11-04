import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} from 'docx';
import { CommercialProposalInput } from '../types/proposal';
import { calcularPropostaComercial } from './calculator';

export async function gerarDocumentoProposta(input: CommercialProposalInput) {
  const resultado = calcularPropostaComercial(input);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);

  // Bordas corrigidas (sem o valor 'AUTO' que causava erro na biblioteca docx)
  const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Cabeçalho / Título
          new Paragraph({
            text: "PROPOSTA COMERCIAL - SEGURANÇA PATRIMONIAL",
            heading: "Heading1",
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
          }),

          // Informações do Cliente e Projeto
          new Paragraph({
            children: [
              new TextRun({ text: "Cliente: ", bold: true }),
              new TextRun({ text: input.cliente }),
            ],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Objeto: ", bold: true }),
              new TextRun({ text: input.objeto }),
            ],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Prazo Contratual: ", bold: true }),
              new TextRun({ text: `${input.prazoMeses} meses` }),
            ],
            spacing: { after: 300 },
          }),

          // Título da Tabela
          new Paragraph({
            text: "Resumo da Composição Orçamentária",
            heading: "Heading2",
            spacing: { after: 150 },
          }),

          // Tabela de Custos
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              // Cabeçalho da Tabela
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: "F3F4F6" },
                    borders: tableBorders,
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: "Item / Descrição", bold: true })],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { fill: "F3F4F6" },
                    borders: tableBorders,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [new TextRun({ text: "Valor Total (R$)", bold: true })],
                      }),
                    ],
                  }),
                ],
              }),

              // Linhas de Custos
              new TableRow({
                children: [
                  new TableCell({
                    borders: tableBorders,
                    children: [new Paragraph("Mão de Obra e Encargos Sociais (82%)")],
                  }),
                  new TableCell({
                    borders: tableBorders,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        text: formatCurrency(
                          resultado.detalhamento.totalMaoDeObra +
                            resultado.detalhamento.totalPericulosidade
                        ),
                      }),
                    ],
                  }),
                ],
              }),

              new TableRow({
                children: [
                  new TableCell({
                    borders: tableBorders,
                    children: [new Paragraph("Alimentação e Benefícios (Saúde/VT/Seguro)")],
                  }),
                  new TableCell({
                    borders: tableBorders,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        text: formatCurrency(
                          resultado.detalhamento.totalAlimentacao +
                            resultado.detalhamento.totalBeneficios
                        ),
                      }),
                    ],
                  }),
                ],
              }),

              new TableRow({
                children: [
                  new TableCell({
                    borders: tableBorders,
                    children: [new Paragraph("Insumos, EPIs, Uniformes e Comunicação")],
                  }),
                  new TableCell({
                    borders: tableBorders,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        text: formatCurrency(
                          resultado.detalhamento.totalInsumosEPI +
                            resultado.detalhamento.totalComunicacao
                        ),
                      }),
                    ],
                  }),
                ],
              }),

              new TableRow({
                children: [
                  new TableCell({
                    borders: tableBorders,
                    children: [new Paragraph("Frota de Veículos e Combustível")],
                  }),
                  new TableCell({
                    borders: tableBorders,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        text: formatCurrency(resultado.detalhamento.totalVeiculos),
                      }),
                    ],
                  }),
                ],
              }),

              new TableRow({
                children: [
                  new TableCell({
                    borders: tableBorders,
                    children: [new Paragraph("Administração Central, Reajuste e Lucro (BDI)")],
                  }),
                  new TableCell({
                    borders: tableBorders,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        text: formatCurrency(
                          resultado.detalhamento.valorAdminCentral +
                            resultado.detalhamento.valorReajuste +
                            resultado.detalhamento.valorDespesasFin +
                            resultado.detalhamento.valorLucro
                        ),
                      }),
                    ],
                  }),
                ],
              }),

              new TableRow({
                children: [
                  new TableCell({
                    borders: tableBorders,
                    children: [new Paragraph("Tributos Incidentes (10,65%)")],
                  }),
                  new TableCell({
                    borders: tableBorders,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        text: formatCurrency(resultado.totalImpostos),
                      }),
                    ],
                  }),
                ],
              }),

              // Total Geral
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: "FEF3C7" },
                    borders: tableBorders,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "VALOR TOTAL DO CONTRATO", bold: true }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    shading: { fill: "FEF3C7" },
                    borders: tableBorders,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.RIGHT,
                        children: [
                          new TextRun({
                            text: formatCurrency(resultado.totalGeralContrato),
                            bold: true,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  // Dispara o download automático do arquivo no navegador
  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Proposta_Comercial_${input.cliente.replace(/\s+/g, '_')}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}