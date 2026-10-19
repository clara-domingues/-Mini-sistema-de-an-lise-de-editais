/** Opções padrão de ramo/setor para clientes e interesses da empresa. */
export const SECTOR_OPTIONS = [
  "Tecnologia da Informação",
  "Telecomunicações",
  "Obras e Engenharia Civil",
  "Manutenção Predial",
  "Saúde e Hospitalar",
  "Educação e Treinamentos",
  "Segurança e Vigilância",
  "Limpeza e Conservação",
  "Alimentação e Refeições",
  "Transporte e Logística",
  "Mobiliário e Equipamentos",
  "Material de Consumo / Expediente",
  "Energia e Sustentabilidade",
  "Consultoria e Serviços Especializados",
  "Meio Ambiente",
  "Agronegócio",
  "Indústria e Manufatura",
  "Outro",
] as const;

export type SectorOption = (typeof SECTOR_OPTIONS)[number];
