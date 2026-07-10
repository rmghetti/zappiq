# Fase 1 — "Saiba mais" em todo o Dashboard da ZappIQ

Data: 2026-07-10
Autor: Rodrigo Ghetti (MACHIA) + Claude
Status: proposto, aguardando revisão

## 1. Objetivo

Levar o padrão "Saiba mais" para todas as telas que o cliente da ZappIQ acessa no Dashboard, de forma que ele entenda sozinho **o que é**, **para que serve**, **como implementa/obtém** e **um exemplo de resultado na operação** de cada recurso. Meta de negócio: reduzir dúvida e volume de suporte, deixando a plataforma autoexplicativa.

Esta é a Fase 1 do programa "Central de Ajuda da ZappIQ". A Fase 2 (Iza Ajuda, chat de suporte em todas as páginas) é especificada em separado e consome o conteúdo produzido aqui.

## 2. Escopo

### Dentro (telas do cliente)

Rotas em `apps/web/app/(dashboard)` visíveis ao cliente, conforme `components/Sidebar.tsx`:

- `/dashboard` — Dashboard (visão geral)
- `/conversations` — Conversas
- `/contacts` — Contatos
- `/crm` — CRM, incluindo `/crm/agenda` (Agenda) e `/crm/atribuicao` (Atribuição)
- `/tasks` — Tarefas
- `/campaigns` — Zap Impulso
- `/templates` — Templates
- `/flows` — Maestro (fluxos), incluindo `/flows/templates`
- `/analytics` — Analytics (camadas + Pulso)
- `/ai-training` — Treinar IA
- `/treinar/qualidade` — Qualidade da IA
- `/knowledge-base` — Base de conhecimento
- `/settings` — Configurações
- `/billing` — Plano & Fatura
- `/audit-logs` — Auditoria (papéis ADMIN/AUDITOR/SUPERADMIN do cliente)
- `/dsr` — Requisições LGPD (mesmos papéis)

### Fora

- Toda a árvore `admin/*` (superadmin interno da ZappIQ): `admin/clientes`, `admin/llm-health`, `admin/unit-economics`, `admin/iza-conversations`, `admin/quota-watch`, `admin/coupons`, `admin/agent-quality`, `admin/iza-knowledge`, `admin/leads`. Nada de esforço de Saiba mais nessas telas.
- Fluxos de autenticação `(auth)`.

### Não-objetivos (YAGNI)

- Sem sistema de i18n multi-idioma (o produto é pt-BR).
- Sem CMS/editor visual de conteúdo nesta fase. O conteúdo mora em código, versionado.
- Sem infraestrutura genérica de tour para todas as telas. O tour existe apenas de forma pontual, em 3 fluxos P0 (ver secção 5.5), como complemento e não substituto do Saiba mais.

## 3. Modelo de conteúdo

Cada "Saiba mais" segue o padrão MACHIA (ver memória `saiba-mais-popup-padrao`): popup grande, ilustrado, escrito para leigo, com quatro blocos fixos:

1. **O que é** — definição curta e sem jargão.
2. **Para que serve** — o benefício concreto na operação do cliente.
3. **Como implementar / obter** — o passo a passo prático dentro da própria tela.
4. **Exemplo de resultado na operação** — um caso realista com números plausíveis.

Requisitos de voz e forma:

- pt-BR com acentuação completa, padrão /voz-humana, **sem travessão (—)**.
- Escrito para um dono de PME não técnico.
- Mini-mockups em CSS/SVG inline quando ajudarem a ilustrar (nada de imagens externas).
- Texto enxuto: cada bloco cabe em poucas frases.

## 4. Arquitetura

Três peças, todas novas, sem quebrar padrões existentes (o repo já usa FAB persistente `TreinarAgenteFAB` no layout do dashboard e componentes em `@zappiq/ui`).

### 4.1 Registro central de conteúdo (fonte única da verdade)

- Local: `apps/web/content/saiba-mais/` (um arquivo por área, ex. `analytics.ts`, `ai-training.ts`) mais um `index.ts` que agrega e um `types.ts`.
- Cada item é identificado por uma `featureKey` no formato `area.recurso[.subrecurso]`, ex.: `analytics.pulso`, `ai-training.survey`, `billing.proration`.
- Schema (TypeScript):

```ts
export interface SaibaMaisContent {
  featureKey: string;          // "analytics.pulso"
  titulo: string;              // rótulo curto exibido no header do popup
  oQueE: string;
  paraQueServe: string;
  comoImplementar: string[];   // passos
  exemploResultado: string;
  mockup?: string;             // SVG/CSS inline opcional
  clientSafe: boolean;         // true = pode entrar no corpus da Iza Ajuda (Fase 2)
  relacionados?: string[];     // outras featureKeys
}
```

- `clientSafe` já nasce marcando o que a Fase 2 pode indexar. Para telas de cliente o padrão é `true`; itens sensíveis (ex.: detalhes de billing de terceiros) podem ser `false`.
- Um registro central tipado garante: chave única, sem conteúdo órfão, fácil auditar e, na Fase 2, exportar como corpus.

### 4.2 Componente `<SaibaMais />`

- Local: `apps/web/components/shared/SaibaMais/`.
- API: `<SaibaMais featureKey="analytics.pulso" variant="icon" | "link" />`.
  - `variant="icon"` — o afeto "(i)" ao lado de títulos de seção, cards de métrica e labels de formulário.
  - `variant="link"` — o texto "Saiba mais" para estados vazios e blocos maiores.
- Ao acionar, abre um modal padronizado que renderiza os quatro blocos a partir do registro pela `featureKey`.
- Se a `featureKey` não existir no registro, em dev estoura aviso; em prod não renderiza nada (falha silenciosa e segura).
- Acessível: foco preso no modal, fecha por ESC e clique fora, `aria-label` no gatilho.
- Reusa estilo/modal já presente em `@zappiq/ui` quando houver; caso contrário, um modal próprio no diretório do componente.

### 4.3 Telemetria

- Ao abrir um Saiba mais, dispara um evento `saiba_mais_opened` com `featureKey`, rota e timestamp, pela mesma via de analytics já usada no app (a confirmar na varredura; se não houver, um POST simples para um endpoint existente de eventos).
- Objetivo: ranquear os mais abertos = mapa de onde o produto confunde. Alimenta melhoria de produto e comprova redução de suporte. Sem PII.

## 5. Varredura por agentes

A construção total é precedida por uma varredura-catálogo **interna** (artefato, não entra no diff final), para garantir cobertura e consistência.

- Um agente por área do escopo (aprox. 14 agentes em paralelo), cada um lendo sua fatia de `apps/web/app/(dashboard)` e os componentes correspondentes.
- Cada agente devolve um catálogo estruturado (JSON) com, por recurso identificado:

```
{ area, rota, recurso, tipoUI (pagina|secao|card|metrica|campo|botao|estadoVazio),
  descricaoObservada, jaTemAjuda (bool), precisaSaibaMais (bool),
  prioridade (P0|P1|P2), featureKeyProposta, justificativa }
```

- Um passo de consolidação junta os catálogos, remove duplicatas, resolve colisões de `featureKey` e produz o backlog priorizado em `docs/superpowers/specs/2026-07-10-saiba-mais-catalogo.md`.

### Priorização

- **P0** — recursos que mais geram dúvida/ticket e onboarding: `ai-training`, `billing`, `campaigns` (Zap Impulso), `flows` (Maestro), `analytics` (Pulso), conectar canais.
- **P1** — CRM, conversas, contatos, templates, tarefas, agenda.
- **P2** — configurações, auditoria, DSR, itens de baixa confusão.

Botões óbvios (ex.: "salvar") não recebem Saiba mais. A varredura marca `precisaSaibaMais: false` nesses casos.

## 5.5 Tour pontual (complemento nos fluxos difíceis)

O Saiba mais explica "o que é" e "como fazer", mas não guia a ordem dos cliques. Para 3 fluxos sequenciais onde o cliente leigo mais erra a ordem das ações, um tour leve resolve o que o popup estático não resolve.

- **Fluxos com tour** (apenas estes): (1) conectar canal do WhatsApp, (2) montar o primeiro fluxo no Maestro, (3) configurar o Treinar IA.
- **Forma:** tooltips sequenciais tipo spotlight, 3 a 5 passos, com "próximo/anterior/pular". Dispara na primeira visita ao fluxo ou por um botão "Ver tour" sempre disponível.
- **Fonte de texto:** reaproveita o mesmo registro central da secção 4.1 (um tour é uma sequência de `featureKey` mais um passo curto de ação). Nada de copy nova espalhada.
- **Componente:** `apps/web/components/shared/GuidedTour/`, dirigido por um registro `apps/web/content/tours/` que lista, por tour, os passos (seletor do alvo na tela + featureKey + microcopy da ação).
- **Não-objetivo:** não é um walkthrough de produto inteiro nem substitui o Saiba mais. Fora desses 3 fluxos, só popup sob demanda.
- Persistência do "já viu o tour" no mesmo mecanismo de estado do onboarding existente (o repo já tem `OnboardingWizard`), sem inventar storage novo.

## 6. Fases de execução

1. **Varredura** — agentes em paralelo produzem o catálogo; consolidação gera o backlog priorizado. Checkpoint de revisão rápido do backlog.
2. **Fundação técnica** — `types.ts`, `index.ts` do registro, componente `<SaibaMais />` e telemetria. Ligado em uma tela P0 como prova de conceito.
3. **Conteúdo + wiring** — redação de todos os itens P0, depois P1, depois P2, cada um ligado na sua tela. Conteúdo passa pela voz /voz-humana.
4. **Tour pontual** — componente `GuidedTour` + registro de tours + ligação nos 3 fluxos da secção 5.5, reusando o conteúdo já redigido.
5. **Verificação** — preview local, screenshots dos popups e do tour nas telas P0/P1, checagem de console/erros, e revisão do diff.

Tudo numa branch (`feat/saiba-mais-dashboard`), entregue junto para revisão do Rodrigo antes de qualquer deploy. Preview antes de produção; nada de `--prod` sem confirmação ou verificação automatizada.

## 7. Ponte com a Fase 2 (Iza Ajuda)

O registro central da secção 4.1 é o corpus inicial da Iza Ajuda:

- Um exportador transforma os itens `clientSafe: true` em documentos para a RAG.
- A fronteira de segurança da Fase 2 (só conteúdo de cliente, nunca admin) começa aqui, no flag `clientSafe`.
- Nenhum item de área `admin/*` entra no registro, logo não há caminho para vazar conteúdo interno via Iza.

## 8. Governança

- Item no checklist de revisão de código: mudou a feature, atualiza o Saiba mais correspondente.
- Chaves `featureKey` são estáveis; renomear exige atualizar os pontos de uso (o TypeScript acusa).
- Conteúdo versionado junto do código, sem CMS externo nesta fase.

## 9. Testes e verificação

- Teste unitário do componente: renderiza os quatro blocos a partir de uma `featureKey` mockada; não renderiza gatilho para chave inexistente em prod.
- Teste de que toda `featureKey` referenciada no JSX existe no registro (evita link morto).
- Verificação manual assistida: preview + screenshots das telas P0.

## 10. Riscos

- **Diff grande.** Mitigado pela ordem varredura -> fundação -> conteúdo por prioridade, tudo numa branch revisável.
- **Conteúdo inconsistente entre áreas.** Mitigado pelo registro tipado e pela passagem única de voz /voz-humana.
- **Telemetria inexistente hoje.** A varredura confirma a via; se não houver, fica um endpoint simples de eventos, sem bloquear a entrega.

## 11. Critérios de sucesso

- Todas as áreas do escopo com Saiba mais nos recursos marcados `precisaSaibaMais: true`.
- Componente e registro únicos, sem copy espalhada no JSX.
- Preview verificado com screenshots dos popups P0/P1.
- Registro pronto para exportar como corpus da Fase 2.
