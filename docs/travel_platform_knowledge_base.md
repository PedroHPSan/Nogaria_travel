# Contexto do Projeto: Travel Platform

## Visão Geral
A **Travel Platform** é uma aplicação web voltada para a gestão completa de viagens, abrangendo desde o planejamento financeiro (orçamentos, DRE, gift cards) até a logística (voos, hospedagem) e o roteiro diário (focado fortemente em parques temáticos).

## Stack Tecnológica
- **Frontend**: React, TypeScript, Vite, TailwindCSS, Lucide React.
- **Backend / Banco de Dados**: Supabase (PostgreSQL).
- **Testes**: Vitest, @testing-library/react.
- **Linting**: Oxlint, ESLint.

## Arquitetura de Dados e Supabase
A plataforma utiliza o **Supabase** como núcleo de persistência e autenticação, seguindo boas práticas estritas de arquitetura:
- **Multi-Tenant e RLS (Row Level Security)**: Total isolamento de dados por locatário (tenant) e viagem. Regras declarativas garantem o acesso apenas aos membros e administradores da viagem.
- **Desempenho no Postgres**: Uso de estratégias avançadas de paginação (Cursor-Based), prevenção contra `N+1`, indexação composta, `VACUUM` e `ANALYZE`, além de `pg_try_advisory_lock` para controle de concorrência.
- **Time Truncation**: Tratamento explícito de fuso horário e truncamento de tempo no Postgres.

## Principais Módulos de Negócio (Domínios)

### 1. Trip Management (Gestão da Viagem)
- **Trips**: O núcleo agregador. Cada viagem possui configurações, participantes e metas de orçamento.
- **Participants**: Pessoas atreladas à viagem, usadas para divisão de custos e controle de elegibilidade de itens do roteiro (ex: altura para brinquedos).

### 2. Financial & Budgeting (Motor Financeiro)
- **DRE Engine**: Motor de demonstração de resultados para visualizar custos previstos vs. realizados, liquidação de dívidas e divisões entre participantes.
- **Purchase Decision Engine**: Simulador de compras para ajudar o usuário a decidir se vale a pena comprar algo em Dólar/Real.
- **Gift Cards Calculator**: Cálculo de savings (economia) no portfólio de cartões de presente.
- **Exchange Rate Service**: Conversão de moedas (BRL/USD) com taxas de câmbio em tempo real e em cache.
- **Expenses & Purchases**: Registro contábil de tudo que é gasto na viagem.

### 3. Roteiro e Parques Temáticos (Itinerary)
- **Theme Parks Master Itinerary**: Roteiros fatiados detalhados para parques da Disney e Universal (Magic Kingdom, Epcot, Hollywood Studios, Animal Kingdom, Epic Universe).
- **Timeline Coverage Engine**: Motor que calcula a cobertura da viagem (dias preenchidos x vazios) e monta calendários visuais por mês e dia.
- Controle rigoroso de horários de shows, conflitos de agendamento e status diário.

### 4. Logística
- Controle de **Voos (Flights)**, **Hospedagem (Accommodations)**, **Transportes (Transports)** e **Malas (Luggages)**.
- **Places Service (Google Radar)**: Integração para busca de restaurantes curados e lojas ao redor, exibindo badges de gratuidade/custo.

### 5. Integrações Externas e IA
- **WhatsApp Webhook**: Sistema que gera resumos diários (Daily Digest) formatados em PT-BR contendo voos, roteiro do dia e tarefas, enviados automaticamente via WhatsApp.
- **AI Copilot (Gemini)**: Integração com IA para pesquisa de preços, análise de dados e assistente de viagem (com controle de quotas e logs de uso no banco).

## Convenções de Código (Clean Code)
- Funções com responsabilidade única.
- Uso de early returns.
- Nenhuma dependência visual forte atrelada diretamente a drivers de banco de dados (o acesso ao dado é isolado em custom hooks `use*Data.ts`).
- Uso estrito de TypeScript sem `any` ou type casts cegos.
