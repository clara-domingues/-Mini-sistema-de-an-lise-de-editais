import { SECTOR_OPTIONS } from "@/lib/sectors";

export type CompanyInterests = {
  sectors: string[];
  regions: string[];
  modalities: string[];
  keywords: string[];
  min_value: number | null;
  max_value: number | null;
  notes: string;
};

export const emptyInterests: CompanyInterests = {
  sectors: [],
  regions: [],
  modalities: [],
  keywords: [],
  min_value: null,
  max_value: null,
  notes: "",
};

export const REGION_OPTIONS = [
  "Nacional",
  "Norte",
  "Nordeste",
  "Centro-Oeste",
  "Sudeste",
  "Sul",
  "Distrito Federal",
  "Estados do Nordeste",
  "Capitais",
  "Interior",
];

export const MODALITY_OPTIONS = [
  "Pregão Eletrônico",
  "Pregão Presencial",
  "Concorrência",
  "Tomada de Preços",
  "Dispensa de Licitação",
  "Inexigibilidade",
  "Credenciamento",
  "RDC / Contratação Integrada",
];

export type InterestSuggestions = {
  sectors: string[];
  regions: string[];
  modalities: string[];
  keywords: string[];
  rationale: string;
};

/**
 * Gera sugestões contextualizadas para detalhar interesses da empresa.
 * Usa heurísticas locais (sempre disponíveis) e pode ser enriquecido
 * por uma Edge Function `suggest-company-fields` quando existir.
 */
export function suggestCompanyInterests(input: {
  razaoSocial?: string;
  cnpj?: string;
  existing?: Partial<CompanyInterests>;
}): InterestSuggestions {
  const text = `${input.razaoSocial ?? ""} ${input.existing?.notes ?? ""}`.toLowerCase();

  const sectorHits = SECTOR_OPTIONS.filter((s) => {
    if (s === "Outro") return false;
    const token = s.toLowerCase().split(/[\s/]+/)[0] ?? "";
    return token.length > 3 && text.includes(token.slice(0, 6));
  });

  const sectors =
    sectorHits.length > 0
      ? sectorHits.slice(0, 4)
      : [
          "Tecnologia da Informação",
          "Consultoria e Serviços Especializados",
          "Material de Consumo / Expediente",
        ];

  const regions =
    text.includes("fortaleza") || text.includes("ceará") || text.includes("ceara")
      ? ["Nordeste", "Estados do Nordeste", "Capitais"]
      : text.includes("são paulo") || text.includes("sao paulo")
        ? ["Sudeste", "Capitais", "Interior"]
        : ["Nacional", "Nordeste", "Sudeste"];

  const modalities = [
    "Pregão Eletrônico",
    "Dispensa de Licitação",
    "Concorrência",
  ];

  const keywords = [
    "fornecimento contínuo",
    "registro de preços",
    "suporte técnico",
    "implantação",
    "manutenção",
  ];

  if (text.includes("soft") || text.includes("ti") || text.includes("tecnolog")) {
    keywords.unshift("software", "licença", "cloud", "infraestrutura de TI");
  }
  if (text.includes("obra") || text.includes("engenharia")) {
    keywords.unshift("execução de obras", "reforma", "projeto básico");
  }
  if (text.includes("saúde") || text.includes("saude") || text.includes("hospital")) {
    keywords.unshift("equipamentos médicos", "insumos hospitalares");
  }

  return {
    sectors,
    regions,
    modalities,
    keywords: Array.from(new Set(keywords)).slice(0, 8),
    rationale:
      "Sugestões geradas com base no perfil da empresa e nos padrões mais comuns de licitações públicas no Brasil. Revise e aceite apenas o que fizer sentido para o seu negócio.",
  };
}

export function toggleListValue(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}
