export interface PostItem {
  id: string;
  cargo: string;
  quantidade: number;
  custoMensalDimensionamento?: number;
  salarioBase: number; // ou number
  periculosidadePercentual: number; // ex: 0.30 (30%)
  encargosSociaisPercentual: number; // ex: 0.82 (82%)
  adicionalNoturno?: boolean;
  tipoJornada: '12h Diurna' | '12h Noturna';
  
}

export interface CommercialProposalInput {
  cliente: string;
  objeto: string;
  prazoMeses: number; // ex: 36 meses
  itens: PostItem[];
  custosInsumos: {
    custoMensalDimensionamento?: number; // EPIs + exames + treinamentos por posto, vindo da planilha
    alimentacaoUnitaria: number; // R$ 22,50 por dia base
    diasAlimentacaoMes: number;  // 15.25 dias
    planoSaudeUnitario: number;
    caixaAssistenciaUnitaria: number;
    valeTransporteUnitario: number;
    seguroDeVidaUnitario: number;
    treinamentoUnitario: number; // R$ 65,00
    uniformesEPIsUnitario: number;
    comunicacaoMovelUnitario: number;
  };
  veiculos: {
    tipo: '4x4' | '4x2';
    quantidade: number;
    custoUnitarioMensal: number;
    combustivelMensal: number;
  }[];
  bdi: {
    administracaoCentral: number; // 9.83%
    reajusteAnual: number;       // 7.00%
    despesasFinanceiras: number; // 2.20%
    lucro: number;               // 4.91%
  };
  tributos: {
    cofins: number; // 3.00%
    pis: number;    // 0.65%
    iss: number;    // 5.00%
    csll: number;   // 1.00%
    irpj: number;   // 1.00%
  };
}