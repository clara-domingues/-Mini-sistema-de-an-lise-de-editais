import { CommercialProposalInput, PostItem } from '../types/proposal';

export function calcularPropostaComercial(input: CommercialProposalInput) {
  if (!(input.prazoMeses > 0)) {
    throw new Error("Prazo em meses deve ser maior que zero.");
  }

  let totalMaoDeObra = 0;
  let totalPericulosidade = 0;
  let totalAlimentacao = 0;
  let totalBeneficios = 0;
  let totalInsumosEPI = 0;
  let totalComunicacao = 0;
  let totalVeiculos = 0;

  const meses = input.prazoMeses;

  // 1. Pessoal e insumos por posto
  input.itens.forEach((item: PostItem) => {
    totalMaoDeObra += item.salarioBase * item.quantidade * meses;
    totalPericulosidade +=
      item.salarioBase * item.periculosidadePercentual * item.quantidade * meses;

    totalAlimentacao +=
      input.custosInsumos.alimentacaoUnitaria *
      input.custosInsumos.diasAlimentacaoMes *
      item.quantidade *
      meses;

    const beneficioUnitarioMes =
      input.custosInsumos.planoSaudeUnitario +
      input.custosInsumos.caixaAssistenciaUnitaria +
      input.custosInsumos.valeTransporteUnitario +
      input.custosInsumos.seguroDeVidaUnitario;

    totalBeneficios += beneficioUnitarioMes * item.quantidade * meses;

    // EPIs + exames + treinamentos: custo mensal por posto vindo da planilha de dimensionamento.
    // Se não vier, cai no cálculo antigo (valores unitários únicos), para não quebrar propostas existentes.
    if (item.custoMensalDimensionamento !== undefined) {
      totalInsumosEPI += item.custoMensalDimensionamento * item.quantidade * meses;
    } else {
      totalInsumosEPI +=
        (input.custosInsumos.treinamentoUnitario + input.custosInsumos.uniformesEPIsUnitario) *
        item.quantidade;
    }

    totalComunicacao += input.custosInsumos.comunicacaoMovelUnitario * item.quantidade * meses;
  });

  // 2. Veículos
  input.veiculos.forEach((v) => {
    totalVeiculos += (v.custoUnitarioMensal + v.combustivelMensal) * v.quantidade * meses;
  });

  // Subtotal D (custos diretos)
  const subtotalD =
    totalMaoDeObra +
    totalPericulosidade +
    totalAlimentacao +
    totalBeneficios +
    totalInsumosEPI +
    totalComunicacao +
    totalVeiculos;

  // 3. BDI
  const valorAdminCentral = subtotalD * input.bdi.administracaoCentral;
  const valorReajuste = subtotalD * input.bdi.reajusteAnual;
  const valorDespesasFin = subtotalD * input.bdi.despesasFinanceiras;

  const subtotalE = subtotalD + valorAdminCentral + valorReajuste + valorDespesasFin;

  // 4. Lucro
  const valorLucro = subtotalE * input.bdi.lucro;
  const totalParcialSemImpostos = subtotalE + valorLucro;

  // 5. Tributos (cálculo "por dentro")
  const percentualTotalTributos =
    input.tributos.cofins +
    input.tributos.pis +
    input.tributos.iss +
    input.tributos.csll +
    input.tributos.irpj;

  if (percentualTotalTributos >= 1) {
    throw new Error("A soma dos tributos deve ser menor que 100%.");
  }

  const totalGeralContrato = totalParcialSemImpostos / (1 - percentualTotalTributos);
  const totalImpostos = totalGeralContrato * percentualTotalTributos;
  const valorMensalGeral = totalGeralContrato / meses;

  return {
    subtotalD,
    subtotalE,
    totalParcialSemImpostos,
    totalImpostos,
    totalGeralContrato,
    valorMensalGeral,
    detalhamento: {
      totalMaoDeObra,
      totalPericulosidade,
      totalAlimentacao,
      totalBeneficios,
      totalInsumosEPI,
      totalComunicacao,
      totalVeiculos,
      valorAdminCentral,
      valorReajuste,
      valorDespesasFin,
      valorLucro,
    },
  };
}