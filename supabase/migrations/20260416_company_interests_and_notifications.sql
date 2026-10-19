-- Execute no SQL Editor do Supabase (projeto BidMaster)
-- Colunas para interesses da empresa e preferências de notificação

alter table public.tenants
  add column if not exists company_interests jsonb default '{}'::jsonb;

alter table public.tenants
  add column if not exists notification_prefs jsonb default '{}'::jsonb;

comment on column public.tenants.company_interests is
  'Interesses comerciais (setores, regiões, modalidades, palavras-chave, faixa de valor)';

comment on column public.tenants.notification_prefs is
  'Preferências de notificação por e-mail e na plataforma';
