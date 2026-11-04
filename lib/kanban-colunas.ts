export const KANBAN_COLUNAS = [
  { slug: 'a_fazer',           label: 'A Fazer',             cor: '#f59e0b' },
  { slug: 'analise_inicial',   label: 'Análise Inicial',     cor: '#eab308' },
  { slug: 'diagnostico',       label: 'Diagnóstico',         cor: '#a855f7' },
  { slug: 'dimensionamento',   label: 'Dimensionamento',     cor: '#3b82f6' },
  { slug: 'propostas',         label: 'Propostas',           cor: '#06b6d4' },
  { slug: 'concluido',         label: 'Concluído',           cor: '#22c55e' },
  { slug: 'cancelado_perdido', label: 'Cancelado/Perdido',   cor: '#ef4444' },
] as const;

export type StatusEdital = (typeof KANBAN_COLUNAS)[number]['slug'];

export const labelDoStatus = (s: string) =>
  KANBAN_COLUNAS.find(c => c.slug === s)?.label ?? s;