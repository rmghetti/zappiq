# Catalogo consolidado de Saiba Mais - dashboard ZappIQ

Documento gerado em 2026-07-10 a partir da varredura completa das 12 areas do dashboard do cliente (dashboard, conversations, contacts, crm, tasks, campaigns, templates, flows, analytics, ai-training, qualidade da IA / knowledge-base legado, settings, billing, auditoria).

## Resumo

- **Total de recursos catalogados:** 279
- **Precisam de Saiba mais:** 129 (46% do total)
- **Nao precisam de Saiba mais:** 150

**Contagem por prioridade (todos os itens do catalogo):**

| Prioridade | Itens | Dos quais precisam de Saiba mais |
|---|---|---|
| P0 | 63 | 49 |
| P1 | 90 | 59 |
| P2 | 126 | 21 |

**Fluxos com tour recomendado (tourRecomendado=true): 10**

- `dsr.fluxo-atendimento` [auditoria] /dsr, Fluxo completo de atendimento de uma solicitação DSR (Iniciar → Exportar/Eliminar → Concluir/Rejeitar)
- `conversations.inbox` [conversations] /conversations, Página de Conversas (Inbox)
- `crm.pipeline.kanban` [crm] /crm, Kanban com drag-and-drop entre colunas
- `dashboard.agent-training-widget` [dashboard] /dashboard (topo de todas as páginas), AgentTrainingWidget , card de progresso de treinamento do agente
- `flows.mapa-operacao.visao` [flows] /flows, Mapa da Operação (painel com fluxos já criados) , cards de fluxo expansíveis + conexões (handoffs) entre fluxos
- `settings.canais.instagram-1-clique` [settings] /settings#canais, Conectar Instagram em 1 clique (Embedded Signup)
- `settings.canais.whatsapp-1-clique` [settings] /settings#canais, Conectar WhatsApp em 1 clique (Embedded Signup)
- `settings.canais.instagram-manual` [settings] /settings#canais, Formulário manual Instagram (Account ID / Page ID / Access Token)
- `settings.canais.whatsapp-manual` [settings] /settings#canais, Formulário manual WhatsApp (Phone Number ID / WABA ID / Access Token)
- `templates.fluxo-aprovacao-meta` [templates] /templates, Fluxo completo: criar → enviar à Meta → aguardar aprovação → usar em campanha/reengajamento

---

## P0 - critico, bloqueia confianca ou operacao central

49 itens precisam de Saiba mais nesta prioridade.

### `qualidade.correcao-sugerida`

- **Area:** Qualidade da IA (/treinar/qualidade) e Base de Conhecimento legado (/knowledge-base)
- **Rota:** /treinar/qualidade
- **Recurso:** Bloco 'Correção sugerida' (resumo + diff + % confiança)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** O conceito de 'diff' (patch de texto tipo linha +/-) é jargão de programador; dono de PME não vai entender esse formato nem o que significa 'confiança 80%'. Alto risco de aplicar ou recusar sem entender o impacto real.

### `qualidade.aplicar-correcao`

- **Area:** Qualidade da IA (/treinar/qualidade) e Base de Conhecimento legado (/knowledge-base)
- **Rota:** /treinar/qualidade
- **Recurso:** Botão 'Aplicar correção' (com confirm dialog)
- **Tipo de UI:** botao
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** Ação irreversível-na-prática que muda o comportamento do agente com clientes reais; o confirm() nativo é insuficiente (some da tela, não explica como reverter ou testar antes). Merece popup completo com exemplo de antes/depois.

### `qualidade.executar-teste`

- **Area:** Qualidade da IA (/treinar/qualidade) e Base de Conhecimento legado (/knowledge-base)
- **Rota:** /treinar/qualidade
- **Recurso:** Botão 'Executar teste agora' (dispara nova run de avaliação)
- **Tipo de UI:** botao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Não é um botão óbvio (salvar/cancelar): dispara um processo assíncrono de vários minutos com custo de IA e limite de 1x/dia. Cliente precisa entender o que acontece ao clicar, quanto tempo leva e por que existe limite de frequência.

### `qualidade.saude-score`

- **Area:** Qualidade da IA (/treinar/qualidade) e Base de Conhecimento legado (/knowledge-base)
- **Rota:** /treinar/qualidade
- **Recurso:** Card de Saúde do agente (Bom/Atenção/Crítico + % de cenários aprovados)
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Métrica central da tela mas não explica como é calculada (quantos cenários, o que cada faixa significa, o que é 'bom' na prática) nem o que fazer para melhorá-la além do link genérico de treinamento.

### `qualidade.overview`

- **Area:** Qualidade da IA (/treinar/qualidade) e Base de Conhecimento legado (/knowledge-base)
- **Rota:** /treinar/qualidade
- **Recurso:** Página Qualidade da IA (visão geral)
- **Tipo de UI:** pagina
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Conceito central e pouco intuitivo pra dono de PME: a IA roda 'testes automáticos' simulando conversas de clientes e propõe correções no comportamento do agente. Sem explicação inicial, o cliente não entende o que é essa auditoria, por que ela existe, nem o que fazer com o resultado.

### `qualidade.cenarios-revisar`

- **Area:** Qualidade da IA (/treinar/qualidade) e Base de Conhecimento legado (/knowledge-base)
- **Rota:** /treinar/qualidade
- **Recurso:** Seção 'Comportamentos para revisar' (lista de cenários reprovados/parciais)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** É o núcleo acionável da tela; cliente leigo não sabe o que é um 'cenário' de teste nem por que a IA simula essas conversas. Falta contexto de que são simulações automáticas, não conversas reais de clientes.

### `ai-training.readiness-score`

- **Area:** ai-training
- **Rota:** /ai-training
- **Recurso:** AI Readiness Score (card de topo com % e nível)
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** É a primeira coisa que o dono de PME vê ao entrar na tela e o número mais importante da página, mas nada explica o que é 'readiness', como ele é calculado (soma dos 5 blocos abaixo) nem por que a IA melhora quando ele sobe. Sem isso o cliente vê um percentual sem contexto.

### `analytics.resultado.kpis`

- **Area:** analytics
- **Rota:** /analytics
- **Recurso:** Camada 'Resultado' , cards de KPI (Respostas pela IA, Conversas resolvidas, Novos contatos, CSAT)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Métricas centrais do produto (taxa de automação, resolução, CSAT). O termo 'CSAT' e o cálculo de 'Respostas pela IA' não são óbvios para dono de PME; e o delta 'pp'/'%' vs período anterior confunde sem explicação.

### `analytics.pulso`

- **Area:** analytics
- **Rota:** /analytics
- **Recurso:** Pulso (resumo da operação narrado pela IA)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** É o recurso mais visível e diferenciado da página (resumo gerado por IA), mas o cliente não entende a diferença entre 'Pulso · IA' e 'Pulso · automático', o que dispara a severidade (crítico/atenção) nem o que fazer com as 'ações recomendadas'. Alta confusão para leigo, alto valor de onboarding.

### `analytics.pagina`

- **Area:** analytics
- **Rota:** /analytics
- **Recurso:** Página Analytics (visão geral)
- **Tipo de UI:** pagina
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** É a tela de BI do produto; um dono de PME leigo não sabe o que cada camada (Resultado/Operação/Campanhas) representa nem como interpretar o conjunto para tomar decisão. Um popup geral orientando 'como ler esta página' reduz abandono.

### `analytics.vendas-ia`

- **Area:** analytics
- **Rota:** /analytics
- **Recurso:** Vendas atribuídas à IA (seção)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** Já tem uma legenda textual da regra de atribuição no rodapé (jaTemAjuda parcial), mas é um conceito de negócio complexo (atribuição de receita a um canal de IA) que merece popup ilustrado com exemplo prático para o dono de PME confiar no número e não achar que é 'invenção do sistema'.

### `billing.pagamento-pendente`

- **Area:** billing
- **Rota:** /billing
- **Recurso:** Badge 'Pagamento pendente' (status past_due) e consequência prática
- **Tipo de UI:** estadoVazio
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** Estado crítico: se o dono da PME não agir, a Iza pode parar de atender clientes no WhatsApp. A nota atual é genérica e não diz o prazo de carência nem o que acontece se não resolver. Um Saiba mais reduziria pânico e diria exatamente o passo a passo (ir ao portal, atualizar cartão, prazo).

### `billing.assinar-checkout`

- **Area:** billing
- **Rota:** /billing
- **Recurso:** Botão 'Assinar' / 'Começar Xd grátis' (checkout direto, sem preview)
- **Tipo de UI:** botao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Ação financeira irreversível/relevante sem nenhuma explicação prévia dentro do app sobre o que vai acontecer (será redirecionado para o Stripe, vai pedir cartão, quando começa a cobrar). Diferente do fluxo de troca de plano (que tem modal explicativo), aqui não há nenhuma tela intermediária.

### `billing.outcome-beta`

- **Area:** billing
- **Rota:** /billing
- **Recurso:** Card Beta 'Conversa Convertida' (pricing outcome-based)
- **Tipo de UI:** card
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** Apesar de já ter um parágrafo explicativo, é um modelo de cobrança totalmente novo e não intuitivo (pagar por resultado, o que é 'score>60', o que conta como 'oportunidade criada pela Iza'). Envolve risco financeiro direto (pode gerar cobranças variáveis) e merece um popup completo com exemplo numérico de fatura.

### `billing.dias-trial`

- **Area:** billing
- **Rota:** /billing
- **Recurso:** Contador de dias restantes de trial
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Métrica com consequência financeira direta (após zerar, cobra automaticamente ou perde acesso, dependendo da configuração). O leigo precisa saber se há cobrança automática ao final e como evitar surpresa no cartão.

### `billing.comparativo-planos`

- **Area:** billing
- **Rota:** /billing
- **Recurso:** Grade de cards de planos (Lite/Growth/Scale/Enterprise) com lista de recursos
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Decisão de compra mais importante da tela. Os bullets usam termos técnicos do produto (ex.: 'atendentes', 'documentos na base', limites de mensagens de IA) sem explicar o que cada limite significa na operação real da PME. Falta de clareza aqui é a maior causa de downgrade equivocado ou plano insuficiente.

### `billing.recomendacao-plano`

- **Area:** billing
- **Rota:** /billing
- **Recurso:** Hero de recomendação de plano (RecommendationHero)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** As 'razões' (reasons) já explicam parcialmente por que aquele plano foi sugerido, mas não explicam a lógica geral (como a ZappIQ calcula a recomendação a partir do uso, o que muda se eu escolher outro plano, o que é 'ciclo anual travado'). É o principal ponto de conversão pós-trial: confusão aqui custa receita.

### `billing.pagina`

- **Area:** billing
- **Rota:** /billing
- **Recurso:** Página Plano e Fatura (header)
- **Tipo de UI:** pagina
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** É a tela financeira central do produto (o que o dono da PME está pagando, quando vence, o que pode mudar). Um leigo chega aqui sem entender a lógica de trial/assinatura/ciclo/proration da ZappIQ. Um popup introdutório orientaria o que a página faz antes de qualquer decisão de compra.

### `campaigns.iza-estrategista`

- **Area:** campaigns
- **Rota:** /campaigns
- **Recurso:** Botão 'Criar com a Iza'
- **Tipo de UI:** botao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** É o pilar central do produto (Zap Impulso) e o fluxo mais estranho para um leigo: gerar uma campanha inteira a partir de uma frase livre. Precisa explicar o que é, como escrever um bom objetivo, e um exemplo de resultado (campanha gerada) para reduzir o medo de 'a IA vai fazer algo errado com meus clientes'.

### `conversations.assumir-handoff`

- **Area:** conversations
- **Rota:** /conversations
- **Recurso:** Botão 'Assumir' (handoff humano)
- **Tipo de UI:** botao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Efeito não é óbvio pelo rótulo: o cliente pode não saber que isso pausa a IA automaticamente até ele mesmo retomar. Erro aqui gera IA 'sumida' sem o dono entender por quê, prejudicando a operação central de atendimento.

### `conversations.corrigir-treinar`

- **Area:** conversations
- **Rota:** /conversations
- **Recurso:** Botão 'Corrigir & treinar [agente]' (correção inline de resposta)
- **Tipo de UI:** botao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** É um mecanismo central de melhoria contínua da IA (vira Q&A automaticamente), mas o botão só aparece em hover e o conceito 'isso vira treinamento permanente do agente' não é óbvio para um leigo; se ele não usar, a IA nunca aprende com os erros.

### `conversations.retomar-ia`

- **Area:** conversations
- **Rota:** /conversations
- **Recurso:** Indicador 'IA pausada , em atendimento humano' + botão 'Retomar Iza'
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Dono de PME leigo precisa entender que a IA fica desligada naquela conversa até ele clicar em retomar, senão o cliente final fica sem resposta automática indefinidamente.

### `conversations.inbox`

- **Area:** conversations
- **Rota:** /conversations
- **Recurso:** Página de Conversas (Inbox)
- **Tipo de UI:** pagina
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** sim
- **Justificativa:** É o coração do produto no dia a dia do cliente PME; ele precisa entender rapidamente a lógica de 3 painéis (conversa + CRM lado a lado) para tirar valor do produto desde o primeiro acesso.

### `crm.pipeline.kpis`

- **Area:** crm
- **Rota:** /crm
- **Recurso:** Barra de 6 KPIs (Win Rate, Ticket Médio, Forecast, Sales Velocity, Ciclo Médio, Perdas)
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Termos como 'Sales Velocity', 'Forecast' e 'Win Rate' são jargão de vendas em inglês que um dono de PME provavelmente não conhece; precisa de explicação de cada métrica, como é calculada e o que fazer ao ver um número ruim.

### `crm.pipeline.kanban`

- **Area:** crm
- **Rota:** /crm
- **Recurso:** Kanban com drag-and-drop entre colunas
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** sim
- **Justificativa:** A frase de apoio ensina o gesto mas não o conceito por trás dos estágios (o que significa cada um, quando mover, o que acontece ao mover para Ganho/Perdido). Um popup ajudaria a entender a lógica de funil de vendas para quem nunca usou CRM.

### `crm.pipeline`

- **Area:** crm
- **Rota:** /crm
- **Recurso:** Página Pipeline de Vendas (kanban)
- **Tipo de UI:** pagina
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** É a porta de entrada do CRM; dono de PME leigo não sabe o que é 'pipeline', 'estágio' ou como isso se conecta às conversas de WhatsApp que a IA gera. Precisa explicar o conceito, de onde vêm os deals (criados manualmente ou pela IA) e um exemplo prático.

### `crm.agenda`

- **Area:** crm
- **Rota:** /crm/agenda
- **Recurso:** Página Agenda (hub de agendamentos)
- **Tipo de UI:** pagina
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** Apesar do subtítulo curto, o leigo não entende a relação entre essa agenda interna e um calendário externo (Google Agenda etc.), nem como configurar a IA para agendar; falta explicar o conceito de fonte única e sincronização.

### `crm.atribuicao.kpis.roi`

- **Area:** crm
- **Rota:** /crm/atribuicao
- **Recurso:** KPI ROI geral
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** ROI é jargão financeiro que o leigo confunde facilmente; o rodapé já explica como o CAC é calculado mas o card de ROI em si não explica a fórmula (receita - custo)/custo nem como interpretar valores negativos.

### `crm.atribuicao`

- **Area:** crm
- **Rota:** /crm/atribuicao
- **Recurso:** Página Atribuição de campanhas
- **Tipo de UI:** pagina
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Conceito de 'atribuição' (ligar uma campanha de WhatsApp a vendas reais) é avançado de marketing; dono de PME não relaciona CAC/ROI/funil sozinho. Precisa de explicação do que é, para que serve e um exemplo de leitura da tabela.

### `dashboard.csat`

- **Area:** dashboard
- **Rota:** /dashboard
- **Recurso:** Card 'Satisfação (CSAT)' , gauge 0 a 10
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Métrica de negócio importante mas não explica como o CSAT é coletado (pesquisa pós-atendimento? pergunta automática?) nem como aumentar a nota. Estado vazio 'Colete CSAT' não diz como fazer isso , gap crítico de onboarding.

### `dashboard.kpi.taxa-automacao`

- **Area:** dashboard
- **Rota:** /dashboard
- **Recurso:** KPI card Taxa de Automação
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Métrica central do valor do produto (quanto a IA está poupando trabalho humano). Dono de PME precisa entender como é calculada e o que fazer para subi-la (treinar o agente), ligando a métrica à ação. Alta confusão e é core do produto.

### `dashboard.agent-training-widget`

- **Area:** dashboard
- **Rota:** /dashboard (topo de todas as páginas)
- **Recurso:** AgentTrainingWidget , card de progresso de treinamento do agente
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** sim
- **Justificativa:** Embora já tenha texto explicativo curto, o conceito de 'score de prontidão do agente' e como ele se traduz em qualidade real de atendimento não é óbvio para leigo. É o principal gancho de ativação/onboarding do produto (P0), merece popup completo com exemplo de como cada ação melhora uma resposta real da IA.

### `flows.mapa-operacao.visao`

- **Area:** flows
- **Rota:** /flows
- **Recurso:** Mapa da Operação (painel com fluxos já criados) , cards de fluxo expansíveis + conexões (handoffs) entre fluxos
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** sim
- **Justificativa:** Conceito abstrato (handoff entre fluxos, 'chamar e voltar' vs 'enviar sem voltar') sem popup dedicado explicando pra que serve na prática e um exemplo de resultado na operação; só há uma frase curta de descrição. Como é o hub central de todos os fluxos, o impacto de confusão é alto.

### `flows.mapa-operacao.arquitetar`

- **Area:** flows
- **Rota:** /flows
- **Recurso:** Mapa da Operação (visão consolidada, inline e tela cheia) , estado inicial vazio com botão 'Maestro, arquitete minha operação'
- **Tipo de UI:** estadoVazio
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Ação de alto impacto (cria vários fluxos automaticamente e sobrescreve o mapa de interligações) mas o dono da PME não tem como saber, antes de clicar, o que exatamente será criado, quanto tempo leva, se pode desfazer, nem como isso aparece depois. Um popup 'Saiba mais' com exemplo de resultado (ex.: fluxos de Atendimento, Vendas, Agendamento interligados) reduziria a hesitação em clicar.

### `flows.editor.testar`

- **Area:** flows
- **Rota:** /flows (editor de fluxo)
- **Recurso:** Botão 'Testar' (replay no motor real da produção)
- **Tipo de UI:** botao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** É a forma de validar o fluxo antes de publicar (core do produto), mas o botão em si não explica que ele salva o fluxo automaticamente antes de testar, nem como interpretar a saída (efeitos, 'próximo', 'Iza assume'). Um popup com exemplo de simulação ajudaria o dono leigo a confiar no resultado.

### `flows.no-ia.ferramenta-webhook`

- **Area:** flows
- **Rota:** /flows (editor de fluxo, nó Nó-IA)
- **Recurso:** Campo 'Usar uma ferramenta (webhook)' , nome, descrição, URL, método HTTP, headers
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** É um recurso técnico (integração via webhook/API) dentro do core do produto (Nó-IA), mas o dono de PME leigo não tem contexto do que é um webhook, quando usar, nem quem configura isso (normalmente precisa de um desenvolvedor). Sem exemplo prático, é a peça mais confusa do editor.

### `settings.ai.segmento`

- **Area:** settings
- **Rota:** /settings#ai
- **Recurso:** Campo Segmento (select: dentista, psicólogo, academia, etc.)
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Define o contexto/vocabulário de negócio que a IA usa para responder clientes; é decisão central de configuração do agente (core do produto) e não há nenhuma explicação do impacto de cada opção.

### `settings.billing.teto-gasto`

- **Area:** settings
- **Rota:** /settings#billing
- **Recurso:** Campo Teto de gasto mensal em overage (R$)
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** Falta um exemplo prático (ex: 'com teto de R$200 e custo de R$0,50/mensagem extra, a IA pausa depois de ~400 mensagens além do plano') para o dono de PME saber dimensionar o valor certo sem arriscar cortar atendimento sem querer.

### `settings.billing.auto-overage`

- **Area:** settings
- **Rota:** /settings#billing
- **Recurso:** Toggle Auto-overage
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** É uma decisão financeira crítica (deixar a IA parar de atender clientes vs. pagar excedente) sem nenhum exemplo numérico de quanto custa o excedente por mensagem nem cenário concreto do que o cliente final vê quando a IA 'pausa'.

### `settings.canais.whatsapp-1-clique`

- **Area:** settings
- **Rota:** /settings#canais
- **Recurso:** Conectar WhatsApp em 1 clique (Embedded Signup)
- **Tipo de UI:** fluxo
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** sim
- **Justificativa:** É o ponto mais crítico do onboarding (ativar o canal principal do produto). A descrição de uma linha não prepara o cliente pro que vai ver no popup da Meta (login, seleção de WABA/número, permissões pedidas) nem o que fazer se travar ou for recusado.

### `settings.canais.whatsapp-manual`

- **Area:** settings
- **Rota:** /settings#canais
- **Recurso:** Formulário manual WhatsApp (Phone Number ID / WABA ID / Access Token)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** sim
- **Justificativa:** É hoje o caminho mais usado (Embedded Signup ainda depende de Advanced Access da Meta). Os hints são de uma linha e não mostram onde clicar dentro do Meta Business Suite nem como gerar um token permanente de System User , só o tutorial em modal cobre isso, um popup contextual aqui economizaria a saída da tela.

### `settings.canais.saude-qualidade`

- **Area:** settings
- **Rota:** /settings#canais
- **Recurso:** Saúde dos canais (badges de qualidade / número sinalizado)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Um selo de 'Qualidade baixa' ou 'Número sinalizado' pode significar que a Meta vai limitar ou bloquear o envio de mensagens , impacto direto na operação , mas nada na tela explica a causa nem o que o dono de PME deve fazer.

### `settings.general.plano-atual`

- **Area:** settings
- **Rota:** /settings#general
- **Recurso:** Plano atual (campo somente leitura)
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Dono de PME vê só o nome do plano, sem entender o que está pagando, o que está incluso nem como comparar com outros planos. É informação de billing/core do produto.

### `tasks.overview`

- **Area:** tasks
- **Rota:** /tasks
- **Recurso:** Página Tarefas (visão geral) , de onde vêm as tarefas
- **Tipo de UI:** pagina
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Dono de PME leigo abre a tela e vê tarefas aparecendo 'do nada' sem entender que foi a IA que criou a partir de uma conversa. Sem explicar isso, ele pode achar que precisa criar tarefas manualmente (não há botão para isso) ou desconfiar que é bug. É conceito central do produto (automação pós-conversa) e afeta confiança/adoção , por isso P0.

### `templates.status-aprovacao`

- **Area:** templates
- **Rota:** /templates
- **Recurso:** Badge de status do template (Aprovado / Pendente / Em análise / Rejeitado)
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** O cliente vai ficar sem saber por que um template 'Em análise' não pode ser usado ainda, quanto tempo a Meta demora pra aprovar, ou o que fazer se for rejeitado. Sem essa explicação ele acha que o sistema travou.

### `templates.reengajamento-24h`

- **Area:** templates
- **Rota:** /templates
- **Recurso:** Badge/checkbox 'Reengajamento 24h'
- **Tipo de UI:** card
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** Já existe uma frase explicativa no modal, mas o conceito da 'janela de 24h da Meta' é um dos pontos mais confusos do WhatsApp Business pra dono de PME e merece um popup completo com exemplo prático (cliente sumiu há 3 dias, IA não consegue responder livremente, precisa desse template pra reabrir).

### `templates.enviar-meta`

- **Area:** templates
- **Rota:** /templates
- **Recurso:** Botão 'Enviar à Meta' (submissão para aprovação)
- **Tipo de UI:** botao
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** É uma ação quase irreversível (trava edição) e o único aviso é um confirm() genérico do browser. Falta explicar o que acontece depois (prazo de análise, o que fazer se for rejeitado, por que o texto não pode mudar).

### `templates.fluxo-aprovacao-meta`

- **Area:** templates
- **Rota:** /templates
- **Recurso:** Fluxo completo: criar → enviar à Meta → aguardar aprovação → usar em campanha/reengajamento
- **Tipo de UI:** fluxo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** sim
- **Justificativa:** É um fluxo sequencial onde a ordem importa (nome errado ou categoria errada faz a Meta rejeitar, e o cliente só descobre dias depois); um tour guiado evita que ele crie o template errado e perca tempo com reprovação da Meta.

### `templates.overview`

- **Area:** templates
- **Rota:** /templates
- **Recurso:** Página Templates de WhatsApp (visão geral)
- **Tipo de UI:** pagina
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Dono de PME leigo não sabe o que é 'template de WhatsApp aprovado pela Meta', por que precisa disso, nem a diferença entre mensagem livre e template. É pré-requisito pra usar campanhas e reengajamento, então confusão aqui trava outras features core.

---

## P1 - importante, gera confusao recorrente

59 itens precisam de Saiba mais nesta prioridade.

### `qualidade.editar-correcao`

- **Area:** Qualidade da IA (/treinar/qualidade) e Base de Conhecimento legado (/knowledge-base)
- **Rota:** /treinar/qualidade
- **Recurso:** Botão '✎ Editar antes de aplicar' (edição manual do diff)
- **Tipo de UI:** botao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Pede que um leigo edite texto em formato de patch técnico sem nenhuma orientação de como escrever uma regra eficaz para a IA seguir.

### `qualidade.interacao-testada`

- **Area:** Qualidade da IA (/treinar/qualidade) e Base de Conhecimento legado (/knowledge-base)
- **Rota:** /treinar/qualidade
- **Recurso:** Card de cenário: bloco 'Interação testada' (mensagem enviada + resposta do agente)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Formato de log/código pode intimidar leigo; vale deixar claro que é uma simulação e como ler a pergunta vs. resposta para julgar se está certo.

### `qualidade.historico-execucoes`

- **Area:** Qualidade da IA (/treinar/qualidade) e Base de Conhecimento legado (/knowledge-base)
- **Rota:** /treinar/qualidade
- **Recurso:** Coluna 'Últimas execuções' (histórico de runs)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Cliente pode não saber que existe uma execução automática semanal (cron) rodando sozinha nem o que significam os diferentes gatilhos (manual, pré-deploy); vale um esclarecimento rápido.

### `qualidade.kpis-cenarios`

- **Area:** Qualidade da IA (/treinar/qualidade) e Base de Conhecimento legado (/knowledge-base)
- **Rota:** /treinar/qualidade
- **Recurso:** KPIs Aprovados / Parciais / Reprovados / Críticos
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Diferença entre 'Parcial', 'Reprovado' e 'Crítico' não é óbvia para leigo; sem explicação, o dono de PME não sabe priorizar o que resolver primeiro.

### `ai-training.scheduling.tipo-agendamento`

- **Area:** ai-training
- **Rota:** /ai-training#scheduling
- **Recurso:** Formulário 'Adicionar tipo de agendamento'
- **Tipo de UI:** fluxo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** É um formulário técnico (antecedência em minutos, horizonte em dias, campos custom) que um dono de PME leigo preenche uma única vez, sem exemplo de como ficaria na prática nem explicação de cada regra; o guia geral da aba não desce a esse nível de detalhe.

### `analytics.operacao.primeira-resposta`

- **Area:** analytics
- **Rota:** /analytics
- **Recurso:** 1ª resposta (média) , mini stat
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** 'p95' é jargão estatístico que confunde dono de PME leigo; vale um popup simples explicando o que é tempo de 1ª resposta e por que importa para conversão no WhatsApp.

### `analytics.campanhas.funil`

- **Area:** analytics
- **Rota:** /analytics
- **Recurso:** Camada 'Campanhas' , funil (Enviadas/Entregues/Lidas/Respondidas)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Conceito de funil de disparo em massa (entregue vs lida vs respondida) e por que a taxa cai a cada etapa não é óbvio para quem nunca fez campanha de WhatsApp; popup com exemplo ajuda a interpretar taxas baixas sem achar que é erro do sistema.

### `analytics.operacao.volume`

- **Area:** analytics
- **Rota:** /analytics
- **Recurso:** Camada 'Operação' , Volume de mensagens recebidas (gráfico de barras clicável)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** A interação (clicar na barra) já tem hint textual, mas o significado do gráfico (só mensagens recebidas, não enviadas) e a granularidade (hora vs dia conforme período) não é óbvio; vale popup curto.

### `analytics.vendas-ia.influencia`

- **Area:** analytics
- **Rota:** /analytics
- **Recurso:** Influência da Iza (% dentro do deal expandido)
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Métrica derivada (score de influência) sem explicação de como é calculada; leigo não sabe se 60% é bom ou ruim nem como usar isso para decidir onde investir.

### `analytics.resultado.csat`

- **Area:** analytics
- **Rota:** /analytics
- **Recurso:** Métrica CSAT
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Sigla técnica (Customer Satisfaction) sem explicação de como é coletada (pesquisa pós-atendimento?) nem como agir sobre uma nota baixa.

### `analytics.operacao.sentimento`

- **Area:** analytics
- **Rota:** /analytics
- **Recurso:** Sentimento das conversas (gráfico de pizza clicável)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** Falta explicar que o sentimento é classificado automaticamente pela IA a partir do teor das mensagens do cliente, e como usar 'Negativo' para priorizar atendimento humano , não é óbvio para leigo de onde vem essa classificação.

### `billing.portal-faturas`

- **Area:** billing
- **Rota:** /billing
- **Recurso:** Botão 'Portal de faturas' (Stripe Customer Portal)
- **Tipo de UI:** botao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** O botão leva o usuário para fora do app (site do Stripe) sem aviso do que ele pode fazer lá (trocar cartão, baixar nota fiscal, cancelar). Leigo pode estranhar sair da ZappIQ e não confiar no site. Saiba mais evita abandono/confusão.

### `billing.addon-integracao-meta`

- **Area:** billing
- **Rota:** /billing
- **Recurso:** Card 'Integração Meta gerenciada' (addon específico com jargão técnico 'Embedded Signup')
- **Tipo de UI:** card
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** 'Embedded Signup' é jargão técnico da Meta/WhatsApp Business API que nenhum dono de PME reconhece. Sem explicação, o cliente não entende o que está pagando R$297 para obter nem por que precisaria disso.

### `billing.addons-hero`

- **Area:** billing
- **Rota:** /billing
- **Recurso:** Checkbox de addons dentro do hero de recomendação
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** O leigo não sabe o que cada addon faz na prática (ex.: 'Mensagens IA extras' , o que conta como mensagem?). Marcar errado gera cobrança indesejada. Falta explicação de cada item antes de marcar a caixa.

### `billing.uso-do-plano`

- **Area:** billing
- **Rota:** /billing
- **Recurso:** Seção 'Uso do plano atual' (barras de Conversas, Atendentes, Documentos, Mensagens de IA)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** O cliente precisa entender o que conta em cada métrica (ex.: 'Mensagens de IA' são só respostas da Iza ou toda troca? 'Documentos na base' é a base de treinamento?) para saber quando vai estourar o limite e precisar fazer upgrade ou comprar addon.

### `billing.addons-catalogo`

- **Area:** billing
- **Rota:** /billing
- **Recurso:** Seção de Add-ons (Voice, Mensagens IA extras, Disparos extras, Atendente extra, Número WA adicional, Integração Meta gerenciada)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Descrições de uma linha não explicam o que é cada addon na operação (ex.: o que muda ter um 'número WA adicional com fila própria', quando faz sentido comprar 'atendente extra'). PME leiga precisa de exemplo prático para decidir se vale a pena.

### `campaigns.status-badge`

- **Area:** campaigns
- **Rota:** /campaigns
- **Recurso:** Badge de status da campanha (Rascunho/Agendada/Enviando/Concluída/Pausada)
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Cinco estados distintos sem nenhuma legenda; o dono de PME pode não entender por que uma campanha está 'Pausada' (CANCELLED) versus 'Rascunho', ou o que precisa fazer para uma sair de Agendada para Enviando. Merece um popup curto tipo legenda com o significado de cada status e o que fazer em cada um.

### `campaigns.funil-entrega`

- **Area:** campaigns
- **Rota:** /campaigns
- **Recurso:** Estatísticas do card (Enviados/Entregues/Lidos/Respostas + barras de progresso)
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** É um funil clássico de campanhas de marketing (conceito familiar a profissionais de marketing, mas não necessariamente a um dono de PME leigo); vale um popup curto explicando a diferença entre entregue/lido/respondido e por que os números caem em cada etapa (limitações da Meta, ex. 'lido' depende do cliente ter confirmação de leitura ativada no WhatsApp).

### `campaigns.coach-insights`

- **Area:** campaigns
- **Rota:** /campaigns
- **Recurso:** Insights do Coach (CoachTip) no card da campanha
- **Tipo de UI:** card
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Recurso de IA analisando a campanha e dando recomendações automáticas; não há explicação de onde vêm esses insights nem como agir sobre eles. Um popup explicando 'o que é o Coach da Iza, como ele gera essas dicas e um exemplo de dica aplicada' ajuda a dar confiança no recurso.

### `campaigns.metrica.receita-atribuida`

- **Area:** campaigns
- **Rota:** /campaigns
- **Recurso:** Métrica 'Receita atribuída'
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** O hint é curto e não explica o que é 'atribuição', por que está zerado, nem como (no futuro) conectar anúncios para essa métrica funcionar. Um dono de PME leigo pode achar que é bug ou que a campanha não vendeu nada.

### `contacts.lead-score`

- **Area:** contacts
- **Rota:** /contacts
- **Recurso:** Coluna/valor Score (lead score) na tabela
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Métrica calculada (provavelmente pela IA a partir do engajamento/intenção na conversa) sem nenhuma explicação visível de como é calculada, o que significa um score alto vs baixo, e como usar isso para priorizar atendimento. Alta chance de confusão para leigo.

### `contacts.empty-state`

- **Area:** contacts
- **Rota:** /contacts
- **Recurso:** Estado vazio 'Nenhum contato encontrado'
- **Tipo de UI:** estadoVazio
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Quando a base está genuinamente vazia (cliente novo, sem conversas ainda), o estado vazio não explica que contatos aparecem automaticamente quando alguém manda mensagem no WhatsApp conectado, nem oferece atalho para conectar canal ou criar contato manual. Isso é um ponto crítico de onboarding.

### `contacts.lead-status`

- **Area:** contacts
- **Rota:** /contacts
- **Recurso:** Filtro de Status do lead (select)
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Os rótulos do funil (Novo/Contactado/Qualificado/Não qualificado/Convertido) não são autoexplicativos para leigo: quem define esse status, é automático pela IA ou manual, o que cada estágio significa na prática de vendas. Popup evitaria confusão e ensinaria a usar o funil para gerir leads.

### `contacts.row-click-edit`

- **Area:** contacts
- **Rota:** /contacts
- **Recurso:** Linha da tabela (clique abre edição)
- **Tipo de UI:** fluxo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Não há affordance clara (ícone de editar, indicação textual) sinalizando que a linha inteira é clicável para editar; usuário leigo pode não descobrir essa interação sozinho. Um 'Saiba mais' com essa dica resolve a confusão.

### `contacts.overview`

- **Area:** contacts
- **Rota:** /contacts
- **Recurso:** Página Contatos (visão geral)
- **Tipo de UI:** pagina
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Dono de PME leigo pode não entender de onde vêm esses contatos (criados automaticamente pela IA ao conversar no WhatsApp), o que é lead score, status do funil e como isso se conecta ao CRM/pipeline. Um popup explicando o conceito geral evita confusão logo na entrada da área.

### `conversations.crm.lead-score`

- **Area:** conversations
- **Rota:** /conversations
- **Recurso:** Barra e número de Lead Score
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Métrica calculada automaticamente sem explicação visível de como é gerada (quais eventos aumentam/diminuem o score); leigo não sabe interpretar nem o que fazer para melhorá-la.

### `conversations.nota-interna`

- **Area:** conversations
- **Rota:** /conversations
- **Recurso:** Botão 'Nota' (nota interna)
- **Tipo de UI:** botao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Placeholder já avisa 'não enviada ao contato', mas o cliente pode não saber que a nota vira item na timeline de CRM ao lado; um popup rápido evita dúvida sobre onde a nota fica salva.

### `conversations.crm.oportunidade`

- **Area:** conversations
- **Rota:** /conversations
- **Recurso:** Card de Oportunidade (deal) no painel CRM
- **Tipo de UI:** card
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Cliente pode não entender de onde vem essa 'oportunidade' (criada automaticamente pela IA/CRM) nem como ela se relaciona ao pipeline de vendas visto em outra tela.

### `conversations.crm.contato`

- **Area:** conversations
- **Rota:** /conversations
- **Recurso:** Card de contato no painel CRM (nome, empresa, status do lead, score, tags)
- **Tipo de UI:** card
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** O dono de PME precisa entender que esses dados vêm do CRM integrado automaticamente durante a conversa e como as tags/status são definidos, para confiar e usar essa informação na hora de decidir uma ação com o lead.

### `conversations.status-badge`

- **Area:** conversations
- **Rota:** /conversations
- **Recurso:** Etiqueta de status da conversa (OPEN/WAITING/ASSIGNED/CLOSED)
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Os valores aparecem em inglês/código técnico (não traduzidos como nos filtros), o que pode confundir um dono de PME leigo sobre o que cada status significa operacionalmente.

### `conversations.crm.timeline`

- **Area:** conversations
- **Rota:** /conversations
- **Recurso:** Linha do tempo de atividades (timeline) no painel CRM
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Muitos tipos de evento diferentes (STAGE_CHANGE, AI_SUMMARY, CAMPAIGN_EVENT etc.) sem legenda; leigo não sabe interpretar todos os ícones/eventos que aparecem ali.

### `conversations.crm.tarefas`

- **Area:** conversations
- **Rota:** /conversations
- **Recurso:** Próximos passos (tarefas) no painel CRM
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Não fica claro se essas tarefas são criadas automaticamente pela IA, por um humano, ou como o cliente cria uma nova a partir dali; falta contexto de origem e ação.

### `crm.pipeline.deal-drawer`

- **Area:** crm
- **Rota:** /crm
- **Recurso:** DealDrawer , painel de detalhe/edição do deal
- **Tipo de UI:** fluxo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Painel denso com várias seções (contato, conversa de origem, timeline de atividades tipadas); leigo pode não entender por que aparecem 'atividades' automáticas geradas pela IA (STAGE_CHANGE, AI_SUMMARY etc).

### `crm.pipeline.kpis.forecast`

- **Area:** crm
- **Rota:** /crm
- **Recurso:** Métrica Forecast (pipeline-weighted)
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** O conceito de 'forecast ponderado por probabilidade de fechamento por estágio' não é óbvio; o rodapé até detalha o breakdown mas o cartão de KPI sozinho não explica a lógica.

### `crm.pipeline.kpis.sales-velocity`

- **Area:** crm
- **Rota:** /crm
- **Recurso:** Métrica Sales Velocity
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Métrica composta (nº deals × win rate × ticket médio / ciclo) pouco intuitiva; leigo não relaciona 'R$/dia' com nada acionável sem explicação.

### `crm.pipeline.kpis.win-rate`

- **Area:** crm
- **Rota:** /crm
- **Recurso:** Métrica Win Rate
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Termo em inglês sem explicação de fórmula (ganhos / (ganhos+perdidos)); popup ajuda a interpretar se a taxa está boa ou ruim para o segmento.

### `crm.pipeline.conversao-estagio`

- **Area:** crm
- **Rota:** /crm
- **Recurso:** Rodapé: Conversão por estágio (funil)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Sem explicação, não fica claro o que significa 'passou 3/10 · 30%' em cada linha nem por que isso importa para identificar gargalos de vendas.

### `crm.pipeline.forecast-breakdown`

- **Area:** crm
- **Rota:** /crm
- **Recurso:** Rodapé: De onde vem o forecast (breakdown por estágio)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Visual sofisticado (duas barras sobrepostas + probabilidade por estágio) sem nenhuma legenda; leigo não entende a diferença entre 'valor bruto' e 'valor projetado' nem de onde vem o percentual de probabilidade.

### `crm.agenda.origem`

- **Area:** crm
- **Rota:** /crm/agenda
- **Recurso:** Origem do agendamento ('via IA' / 'calendário externo')
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Não é óbvio pra um leigo o que significa 'via IA' vs 'calendário externo' nem como configurar essa sincronização externa; merece explicação rápida com exemplo.

### `crm.atribuicao.kpis.receita-atribuida`

- **Area:** crm
- **Rota:** /crm/atribuicao
- **Recurso:** KPI Receita atribuída
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Não é óbvio que esse valor soma apenas deals GANHOS vinculados a campanhas rastreadas; popup evita interpretação errada como 'faturamento total'.

### `crm.atribuicao.tabela-campanhas`

- **Area:** crm
- **Rota:** /crm/atribuicao
- **Recurso:** Tabela de campanhas com colunas (Enviadas, Respostas, Contatos, Deals, Ganhos, Receita, CAC, ROI)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** Muitas colunas técnicas lado a lado (CAC, ROI, conversão) sem cabeçalho explicativo; mesmo com o aviso de rodapé sobre CAC, falta explicar o funil completo sent→reply→contact→deal→won representado nas colunas.

### `dashboard.leads-por-estagio`

- **Area:** dashboard
- **Rota:** /dashboard
- **Recurso:** Card 'Leads por estágio' (Novos / Em atendimento / Finalizados)
- **Tipo de UI:** card
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Não explica a diferença entre os três estágios nem como um lead 'anda' entre eles (é automático pelo status da conversa?). Confunde dono de PME que espera controlar isso manualmente como um CRM tradicional.

### `dashboard.grafico.volume-mensagens`

- **Area:** dashboard
- **Rota:** /dashboard
- **Recurso:** Card 'Mensagens no período' com gráfico de área
- **Tipo de UI:** card
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Gráfico sem eixos rotulados (SVG placeholder), leigo não sabe interpretar picos/vales nem o que fazer com essa informação no dia a dia do negócio.

### `dashboard.kpi.conversas-abertas`

- **Area:** dashboard
- **Rota:** /dashboard
- **Recurso:** KPI card Conversas Abertas
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Não fica óbvio por que essa métrica nunca mostra variação percentual como as outras 3 (é 'foto do momento', não acumulado do período). Confunde o leigo achar que é um bug.

### `dashboard.kpi.mensagens`

- **Area:** dashboard
- **Rota:** /dashboard
- **Recurso:** KPI card Mensagens (com delta vs período anterior)
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Dono de PME leigo não entende o que conta como 'mensagem' (enviada+recebida? só do agente?) nem por que às vezes aparece ',' em vez de percentual. Um popup explicando a métrica e o exemplo evita interpretação errada dos números do negócio.

### `dashboard.kpi.novos-contatos`

- **Area:** dashboard
- **Rota:** /dashboard
- **Recurso:** KPI card Novos Contatos
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Cliente PME quer saber se isso conta leads duplicados, contatos que voltaram, etc. Popup evita mal-entendido comercial.

### `flows.editor.experimento-ab`

- **Area:** flows
- **Rota:** /flows (editor de fluxo)
- **Recurso:** Botão 'A/B' (Experimento A/B entre fluxo A e variante B)
- **Tipo de UI:** botao
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** Já há descrições funcionais de cada campo, mas falta o 'porquê usar' e um exemplo de resultado prático pro dono leigo (ex.: 'variante B converteu 8% a mais, ative-a'); o conceito de teste A/B em si não é comum pra dono de PME.

### `flows.editor.simular`

- **Area:** flows
- **Rota:** /flows (editor de fluxo)
- **Recurso:** Botão 'Simular' (simulação com personas sintéticas / clientes de IA)
- **Tipo de UI:** botao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Conceito não trivial (IA gera clientes fictícios e 'conversa' com o próprio fluxo) sem explicação prévia de como funciona, o que conta como 'passar', ou um exemplo de uso real antes de o dono clicar e esperar o resultado.

### `flows.editor.metricas-por-no`

- **Area:** flows
- **Rota:** /flows (editor de fluxo)
- **Recurso:** Botão/Toggle 'Métricas' (badges de entradas/fins por nó, 7 dias)
- **Tipo de UI:** botao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Os badges ▶/⏹ não são autoexplicativos para um leigo; não há legenda nem explicação do que 'entradas' e 'fins' significam operacionalmente (ex.: quantos clientes passaram por aquele ponto do atendimento).

### `flows.no-mensagem.botoes-midia`

- **Area:** flows
- **Rota:** /flows (editor de fluxo, nó Mensagem)
- **Recurso:** Seletor de modo Texto / Botões-Lista / Mídia (MessageRichFields)
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Recurso de uso recorrente (personalizar mensagens) mas com nuances do WhatsApp (limite de botões, áudio por URL não suportado nesta versão) que só aparecem como avisos pequenos e tardios; um Saiba mais com mockup de como o cliente final vê ajudaria a decidir o formato certo.

### `settings.ai.tom-de-voz`

- **Area:** settings
- **Rota:** /settings#ai
- **Recurso:** Campo Tom de voz (select: Amigável/Formal/Técnico)
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Cliente não tem como prever como a IA vai soar no WhatsApp real ao escolher 'Formal' vs 'Amigável'; falta exemplo de mensagem antes/depois.

### `settings.canais.instagram-1-clique`

- **Area:** settings
- **Rota:** /settings#canais
- **Recurso:** Conectar Instagram em 1 clique (Embedded Signup)
- **Tipo de UI:** fluxo
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** sim
- **Justificativa:** Canal secundário (menos crítico que WhatsApp) mas mesma lacuna: falta explicar pré-requisitos (conta Business, página vinculada) e o que esperar do popup da Meta.

### `settings.canais.instagram-manual`

- **Area:** settings
- **Rota:** /settings#canais
- **Recurso:** Formulário manual Instagram (Account ID / Page ID / Access Token)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** sim
- **Justificativa:** Mesma lacuna do formulário WhatsApp, porém canal secundário.

### `settings.canais.app-secret`

- **Area:** settings
- **Rota:** /settings#canais
- **Recurso:** Segurança do webhook (App Secret)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** Explicação já suficiente para o caso de uso, campo avançado de baixa frequência de uso.

### `settings.flows.horario-comercial`

- **Area:** settings
- **Rota:** /settings#flows
- **Recurso:** Editor de Horário comercial (BusinessHoursEditor)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** Falta o exemplo de resultado na operação: o que acontece quando um cliente manda mensagem fora do horário , a IA para de responder, manda uma mensagem automática, ou passa pra fila humana? Sem isso o dono de PME configura no escuro.

### `settings.team.papeis`

- **Area:** settings
- **Rota:** /settings#team
- **Recurso:** Lista de membros com papéis (Admin/Supervisor/Agente/Auditor)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Antes de convidar alguém, o dono precisa entender o que cada papel pode fazer no sistema (ex: Auditor só visualiza? Supervisor pode remover membros?). Isso não está explicado em nenhum lugar da tela.

### `templates.categoria`

- **Area:** templates
- **Rota:** /templates
- **Recurso:** Categoria do template no card (Marketing / Utilidade / Autenticação)
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Categoria errada é motivo comum de rejeição pela Meta e pode ter custo diferente por conversa; o cliente leigo escolhe no escuro sem noção prática de quando usar cada uma.

### `templates.form.corpo-variaveis`

- **Area:** templates
- **Rota:** /templates (modal)
- **Recurso:** Campo 'Corpo da mensagem'
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** A nota existe mas é só uma linha; o conceito de variáveis numeradas da Meta e como elas se conectam aos dados do contato (nome, pedido) merece exemplo visual completo pra quem nunca configurou um template de WhatsApp Business.

### `templates.form.categoria`

- **Area:** templates
- **Rota:** /templates (modal)
- **Recurso:** Seletor de Categoria (Meta) no formulário
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** Os hints ajudam mas não avisam sobre consequências (rejeição, custo por categoria, revisão mais rígida em Marketing). Um popup 'Saiba mais' com exemplos reais evitaria templates recusados pela Meta.

---

## P2 - baixo risco, mas ainda assim marcado como precisando de Saiba mais

21 itens precisam de Saiba mais nesta prioridade.

### `ai-training.training-history`

- **Area:** ai-training
- **Rota:** /ai-training#documents
- **Recurso:** Histórico de treinamento (log de auditoria kb.*)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Não há nenhuma frase explicando para que serve esse histórico (auditoria/rastreabilidade de quem treinou o quê); um dono de PME pode não entender o propósito de uma lista de eventos técnicos.

### `ai-training.scheduling.confirmacao-manual`

- **Area:** ai-training
- **Rota:** /ai-training#scheduling
- **Recurso:** Checkbox 'Exigir minha confirmação antes de valer'
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Não fica claro se marcado significa que o agendamento fica pendente até o dono aprovar manualmente, ou o oposto; pode ser coberto pelo Saiba mais do formulário como um todo em vez de popup isolado.

### `audit-logs.verificar-integridade`

- **Area:** auditoria
- **Rota:** /audit-logs
- **Recurso:** Botão Verificar Integridade
- **Tipo de UI:** botao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Termo técnico 'cadeia de hash' não é explicado. O leigo não entende o que está sendo verificado nem quando/por que deveria clicar nesse botão (ex: antes de uma auditoria externa).

### `audit-logs.resultado-verificacao`

- **Area:** auditoria
- **Rota:** /audit-logs
- **Recurso:** Card de resultado da verificação (cadeia íntegra / violada)
- **Tipo de UI:** card
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** Já tem texto explicativo básico, mas cita 'DPO' e 'Art. 48 da LGPD' sem explicar o que é DPO, o que fazer na prática e qual a gravidade real do alerta vermelho para quem nunca ouviu esses termos.

### `audit-logs.base-legal`

- **Area:** auditoria
- **Rota:** /audit-logs
- **Recurso:** Coluna/Campo 'Base legal' (legalBasis) na tabela e no modal
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** São conceitos jurídicos da LGPD (art. 7º/11º) que um dono de PME não domina; sem explicação ele não consegue avaliar se a base legal registrada está correta para o negócio dele.

### `audit-logs.detalhe-evento`

- **Area:** auditoria
- **Rota:** /audit-logs
- **Recurso:** Modal de detalhe do evento (Hash SHA-256 / Hash anterior)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Campos de hash são incompreensíveis para leigo; falta explicar que servem para provar que o registro não foi alterado depois de criado (característica de blockchain/tamper-evident) e por que isso importa numa fiscalização.

### `audit-logs.pagina`

- **Area:** auditoria
- **Rota:** /audit-logs
- **Recurso:** Página Trilha de Auditoria
- **Tipo de UI:** pagina
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Dono de PME não sabe o que é 'trilha de auditoria', por que ela existe, nem os termos legais citados (Art. 37/46 LGPD). Precisa de explicação leiga: é o registro imutável de tudo que aconteceu com os dados dos clientes, serve para provar conformidade em caso de fiscalização.

### `dsr.status-badge`

- **Area:** auditoria
- **Rota:** /dsr
- **Recurso:** Badge de Status na tabela (texto bruto r.status)
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Inconsistência: o tipo é traduzido mas o status não. Leigo não sabe o que 'IN_PROGRESS' ou 'EXPIRED' significam nem qual ação tomar em cada status.

### `dsr.concluir-exportacao`

- **Area:** auditoria
- **Rota:** /dsr
- **Recurso:** Botão Concluir + avisar (completeExport)
- **Tipo de UI:** botao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Não fica claro que o titular será avisado automaticamente por e-mail, nem que o export (JSON/CSV) deveria ser baixado e conferido antes de clicar aqui; erro de ordem pode gerar informação incompleta enviada ao cliente.

### `dsr.prazo`

- **Area:** auditoria
- **Rota:** /dsr
- **Recurso:** Coluna Prazo (dias) / indicador de vencido
- **Tipo de UI:** metrica
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** O impacto de deixar vencer (risco de sanção da ANPD) não é explicado na tela; popup deveria alertar a gravidade e o que fazer para não perder o prazo.

### `dsr.tipo-solicitacao`

- **Area:** auditoria
- **Rota:** /dsr
- **Recurso:** Coluna Tipo (ACCESS, CORRECTION, ANONYMIZATION, PORTABILITY, DELETION, CONSENT_REVOKE, INFORMATION)
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** sim
- **Tour recomendado:** nao
- **Justificativa:** Rótulo já traduzido ajuda, mas termos como 'Anonimização' vs 'Eliminação' vs 'Portabilidade' se confundem para quem não é jurídico; popup pode dar exemplo de cada um e qual ação o cliente final deve tomar.

### `dsr.filtro-status`

- **Area:** auditoria
- **Rota:** /dsr
- **Recurso:** Filtros de status (Todas/PENDING/IN_PROGRESS/COMPLETED/REJECTED/EXPIRED)
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Rótulos em inglês quebram a experiência em português e não são autoexplicativos para leigo; popup pode traduzir e explicar o significado de cada status do ciclo de vida da requisição.

### `dsr.fluxo-atendimento`

- **Area:** auditoria
- **Rota:** /dsr
- **Recurso:** Fluxo completo de atendimento de uma solicitação DSR (Iniciar → Exportar/Eliminar → Concluir/Rejeitar)
- **Tipo de UI:** fluxo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** sim
- **Justificativa:** A ordem certa de botões muda conforme o tipo de requisição e não há indicação visual disso; um popup estático não resolve porque o usuário precisa ser guiado passo a passo dependendo do caso, o que justifica um tour interativo.

### `dsr.pagina`

- **Area:** auditoria
- **Rota:** /dsr
- **Recurso:** Página Requisições do Titular (DSR)
- **Tipo de UI:** pagina
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Dono de PME não sabe o que é 'requisição do titular' (ex: um cliente pedindo para apagar os dados dele), nem que ignorar o prazo de 15 dias pode gerar multa da ANPD. Precisa de explicação prática com exemplo de quando isso aparece.

### `contacts.export`

- **Area:** contacts
- **Rota:** /contacts
- **Recurso:** Botão Exportar (CSV)
- **Tipo de UI:** botao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Dono de PME pode não saber para que serve exportar (ex: importar em outra ferramenta, fazer backup, rodar campanha de e-mail/WhatsApp externo) nem o formato/colunas do CSV gerado. Vale um popup curto com exemplo de uso.

### `contacts.tags`

- **Area:** contacts
- **Rota:** /contacts
- **Recurso:** Coluna Tags na tabela
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Não fica claro se tags são geradas automaticamente pela IA a partir da conversa ou só manuais, nem para que servem na prática (segmentação para campanhas, por exemplo). Um popup rápido com exemplo ajudaria o dono de PME a aproveitar o recurso.

### `crm.pipeline.deal-drawer.timeline`

- **Area:** crm
- **Rota:** /crm
- **Recurso:** DealDrawer , Timeline de Atividades
- **Tipo de UI:** secao
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Mesmo com rótulos traduzidos, o conceito de log automático de atividades geradas pela IA/sistema não é intuitivo para quem nunca usou CRM; um popup explicaria a utilidade de rastrear o histórico.

### `dashboard.dia-mais-ativo`

- **Area:** dashboard
- **Rota:** /dashboard
- **Recurso:** Card 'Dia mais ativo' (gráfico de barras por dia da semana)
- **Tipo de UI:** card
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Útil para planejamento operacional (escalar equipe/humano nos dias de pico), mas dono de PME não relaciona sozinho essa informação a uma decisão prática sem explicação.

### `dashboard.status-conversa`

- **Area:** dashboard
- **Rota:** /dashboard
- **Recurso:** Indicador de status da conversa (bolinha colorida: verde/amarelo/azul/cinza)
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Cores sem legenda na tela; leigo não sabe o que verde/amarelo/azul significam. Baixa complexidade mas gera dúvida recorrente.

### `templates.form.idioma`

- **Area:** templates
- **Rota:** /templates (modal)
- **Recurso:** Campo 'Idioma'
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** Campo de texto livre sem máscara nem exemplos além do valor padrão; cliente pode digitar 'português' ou 'pt-br' errado e a submissão à Meta falhar sem explicação clara do motivo.

### `templates.form.rodape`

- **Area:** templates
- **Rota:** /templates (modal)
- **Recurso:** Campo 'Rodapé (opcional)'
- **Tipo de UI:** campo
- **Ja tem ajuda hoje:** nao
- **Tour recomendado:** nao
- **Justificativa:** O placeholder sugere um uso (opt-out) mas não explica que isso pode ser exigido pela Meta em certas categorias; cliente pode deixar em branco sem saber da implicação de compliance.

---

## Apendice: itens que NAO precisam de Saiba mais

150 itens ja sao autoexplicativos, ja tem ajuda inline suficiente, ou sao de baixo risco. Listados apenas por featureKey e recurso, agrupados por area.

### Qualidade da IA (/treinar/qualidade) e Base de Conhecimento legado (/knowledge-base)

- `qualidade.recusar-correcao` - Botão 'Recusar' correção
- `qualidade.reverter-correcao` - Botão '↺ Reverter aplicação'
- `qualidade.gerar-correcao-manual` - Botão '💡 Pedir correção da IA' (gerar sugestão sob demanda)
- `qualidade.retestar-cenario` - Botão '🔄 Re-testar agora' (após aplicar correção)
- `qualidade.observacao-decisao` - Campo 'Observação (opcional)' ao aplicar/recusar correção
- `qualidade.historico-vazio` - Estado vazio 'Nenhuma execução ainda'
- `qualidade.sem-agente` - Estado vazio 'Você ainda não tem agente publicado' (sem agentes)
- `qualidade.nudge-treinamento` - Nudge 'Completar treinamento eleva o resultado' (score < 90)
- `knowledge-base.redirect-legado` - Rota /knowledge-base (redirect legado para /ai-training)
- `qualidade.seletor-agente` - Seletor de agente (dropdown)

### ai-training

- `ai-training.scheduling` - Aba Agendamento (visão geral)
- `ai-training.documents` - Aba Documentos (upload, URL, texto colado)
- `ai-training.identity` - Aba Identidade do agente
- `ai-training.qa` - Aba Perguntas & Respostas
- `ai-training.survey` - Aba Qualificação (questionário do negócio)
- `ai-training.playground` - Aba Testar minha IA (playground de chat)
- `ai-training.not-indexed-alert` - Aviso 'itens não indexados' (NotIndexedAlert)
- `ai-training.readiness-breakdown` - Breakdown por categoria (Survey 30, Identidade 20, Documentos 25, Q&A 20, Canais 5)
- `ai-training.documents.texto` - Colar texto direto
- `ai-training.scheduling.google-connect` - Conectar Google Calendar
- `ai-training.documents.url` - Ingerir URLs do site
- `ai-training.proximas-acoes` - Próximas ações (checklist estilo Duolingo)
- `ai-training.indexed-badge` - Selo de indexação (verde 'X trechos' / âmbar 'não indexado')
- `ai-training.documents.upload` - Upload de arquivo (PDF/TXT/DOCX/XLSX)
- `ai-training.scheduling.upsell` - Upsell 'Agendamento pela IA' (plano sem entitlement)

### analytics

- `analytics.pulso.atualizar` - Botão 'Gerar com IA' / 'Atualizar' (Pulso)
- `analytics.operacao.conversas-abertas` - Conversas abertas , mini stat
- `analytics.drilldown` - Drawer de drill-down (mensagens/conversas do recorte clicado)
- `analytics.operacao.equipe` - Equipe & carga de atendimento (lista de atendentes)
- `analytics.campanhas.vazio` - Estado vazio , Nenhuma campanha enviada no período
- `analytics.vendas-ia.vazio` - Estado vazio , Vendas atribuídas à IA
- `analytics.operacao.ia-vs-humano` - Respostas: IA vs humano (barra de proporção)
- `analytics.periodo` - Seletor de período (24h / 7d / 30d / personalizado)
- `analytics.vendas-ia.sugestoes` - Sugestões de vínculo IA→venda (confirmar/rejeitar)

### auditoria

- `dsr.concluir` - Botão Concluir (status → COMPLETED, tipos não-export)
- `dsr.eliminar-dados` - Botão Eliminar (fulfillDeletion , anonimização + soft-delete)
- `dsr.botao-iniciar` - Botão Iniciar (PENDING → IN_PROGRESS)
- `dsr.rejeitar` - Botão Rejeitar (com prompt de motivo)
- `dsr.exportar-dados` - Botões Exportar JSON / CSV (dados do titular)
- `audit-logs.filtros` - Campos de filtro (Ação, Recurso)
- `audit-logs.estado-vazio` - Estado vazio 'Nenhum registro'
- `dsr.estado-vazio` - Estado vazio 'Nenhuma requisição'
- `audit-logs.acesso-restrito` - Tela de Acesso restrito (fora de ADMIN/AUDITOR/SUPERADMIN)
- `dsr.acesso-restrito` - Tela de Acesso restrito (fora de ADMIN/AUDITOR/SUPERADMIN)

### billing

- `billing.promo-trial-lite` - Banner promocional 'Lite , 14 dias grátis' (para quem nunca testou)
- `billing.falar-vendas-enterprise` - Botão 'Falar com vendas' (plano Enterprise, mailto)
- `billing.trocar-plano` - Botões 'Fazer upgrade' / 'Agendar downgrade' / 'Agendar p/ renovação' (troca de plano de pagante)
- `billing.status-assinatura` - Card de status da assinatura (SubscriptionCard: ativa/trial/pagamento pendente/cancelada/sem assinatura)
- `billing.modal-troca-plano` - Modal de confirmação de troca de plano (PlanChangeModal) , explicação de proration/agendamento
- `billing.faturas-datas` - Próxima cobrança / Última fatura (campos de data e valor)
- `billing.toast-troca-confirmada` - Toast de aviso pós-troca de plano (changeNotice)
- `billing.toggle-ciclo` - Toggle de ciclo de cobrança (Mensal / Anual -20%)

### campaigns

- `campaigns.trial-banner` - Banner de trial do Zap Impulso ativo
- `campaigns.trial-expired-banner` - Banner de trial expirado (serviço bloqueado)
- `campaigns.upsell.ativar-trial` - Botão 'Ativar teste grátis' (trial 7 dias)
- `campaigns.upsell.contratar` - Botão 'Contratar' por plano (checkout Stripe)
- `campaigns.disparar` - Botão 'Disparar' no card da campanha
- `campaigns.excluir` - Botão 'Excluir' no card da campanha
- `campaigns.nova-manual` - Botão 'Nova campanha' (manual)
- `campaigns.form.agendamento` - Campo 'Agendar disparo' (datetime opcional)
- `campaigns.form.template` - Campo 'Template aprovado' (select + textos de ajuda sobre janela de 24h)
- `campaigns.form.tipo` - Campo 'Tipo de campanha' (só Broadcast disponível)
- `campaigns.pilar.auto-otimizacao` - Card do pilar 'Auto-otimização' (status Em breve)
- `campaigns.pilar.loop-performance` - Card do pilar 'Loop de Performance' (status Em breve)
- `campaigns.estado-vazio` - Estado vazio (nenhuma campanha ainda)
- `campaigns.header` - Header 'Zap Impulso' + badge Campanhas
- `campaigns.lista` - Lista 'Suas campanhas' + contador total
- `campaigns.iza.campo-objetivo` - Modal 'Criar com a Iza' , campo Objetivo + exemplos
- `campaigns.metrica.ativas` - Métrica 'Campanhas ativas'
- `campaigns.metrica.disparos` - Métrica 'Disparos'
- `campaigns.metrica.taxa-resposta` - Métrica 'Taxa de resposta'
- `campaigns.upsell.planos` - Paywall/vitrine do Zap Impulso (planos Start/Pro/Scale + trial 7 dias + Enterprise)
- `campaigns.saiba-mais.planos-impulso` - Popup 'Saiba mais' de cada plano do Impulso
- `campaigns.iza.rascunho` - Rascunho gerado pela Iza (segmento, canais, horário, copy, orçamento, estimativa, racional)
- `campaigns.como-funciona` - Seção 'Como funciona o Impulso' (colapsável, 5 pilares)
- `campaigns.iza.instagram-toggle` - Toggle 'Enviar também pelo Instagram Direct'

### contacts

- `contacts.delete-button` - Botão Excluir contato (com confirmação)
- `contacts.create-button` - Botão Novo Contato
- `contacts.search` - Campo de busca (nome, telefone, email)
- `contacts.last-interaction` - Coluna Última interação
- `contacts.form-modal` - Modal Novo/Editar Contato , campos gerais
- `contacts.total-count` - Métrica 'X contatos no total'
- `contacts.pagination` - Paginação (anterior/próxima)

### conversations

- `conversations.carregar-anteriores` - Botão 'Carregar anteriores' (paginação de histórico)
- `conversations.encerrar-reabrir` - Botão 'Encerrar' / 'Reabrir' conversa
- `conversations.busca` - Busca de conversa por nome/telefone
- `conversations.enviar-mensagem` - Campo de resposta manual + botão enviar
- `conversations.estado-vazio-lista` - Estado vazio 'Nenhuma conversa encontrada'
- `conversations.estado-vazio-selecao` - Estado vazio 'Selecione uma conversa'
- `conversations.filtro-canal` - Filtro de canal (WhatsApp/Instagram)
- `conversations.filtro-status` - Filtros de status (Todas/Abertas/Aguardando/Fechadas)
- `conversations.rotulo-remetente` - Rótulo 'Agente IA' / 'Humano' nas bolhas de mensagem

### crm

- `crm.atribuicao.cac-nota` - Aviso 'Como o CAC é calculado' (rodapé)
- `crm.agenda.acoes-status` - Ações de status por agendamento (Confirmar, Concluir, Não compareceu, Cancelar)
- `crm.agenda.status-badge` - Badge de status do agendamento
- `crm.pipeline.novo-deal` - Botão 'Novo Deal' (CTA + botões + por coluna)
- `crm.pipeline.kpis.perdas` - Card 'Perdas' com top motivo
- `crm.pipeline.card` - Card do deal no kanban
- `crm.pipeline.novo-deal-modal` - DealFormModal , Novo deal
- `crm.agenda.estado-vazio` - Estado vazio 'Nenhum agendamento nos próximos 60 dias'
- `crm.atribuicao.estado-vazio` - Estado vazio 'Sem campanhas atribuídas ainda'
- `crm.atribuicao.kpis.melhor-campanha` - KPI Melhor ROI (melhor campanha)
- `crm.atribuicao.kpis.reply-rate` - KPI Reply rate médio
- `crm.pipeline.link-atribuicao` - Link 'Atribuição' (para /crm/atribuicao)
- `crm.pipeline.loss-reason-modal` - LossReasonModal , Por que perdemos este deal
- `crm.pipeline.motivos-perda` - Rodapé: Por que perdemos (top motivos de perda)

### dashboard

- `dashboard.agent-health-chip` - AgentHealthChip , chip de score do agente no cabeçalho
- `dashboard.atividade-recente` - Card 'Atividade recente' (lista de conversas)
- `dashboard.canais-tutorial-card` - Card 'Como conectar WhatsApp e Instagram' (CanaisTutorialCard)
- `dashboard.periodo` - Seletor de período (24h/7d/30d)
- `dashboard.treinar-agente-fab` - TreinarAgenteFAB , botão flutuante 'Treinar {Agente}'

### flows

- `flows.templates.biblioteca` - Biblioteca de Templates , página, filtro por vertical e detecção automática de nicho
- `flows.editor.historico` - Botão 'Histórico' (versões + restaurar)
- `flows.editor.publicar` - Botão 'Publicar' (ativa a versão do fluxo em produção)
- `flows.editor.prioridade-roteador` - Campo 'Prioridade (desempate do roteador)' no painel de configurações do fluxo
- `flows.novo-fluxo` - Card 'Novo fluxo' , botões 'Mapa da Operação' e 'Criar fluxo'
- `flows.maestro-inteligente` - Card MAESTRO INTELIGENTE (gerador autônomo de fluxo a partir do treinamento da IA)
- `flows.tutorial-maestro` - Card Tutorial , MAESTRO INTELIGENTE 2.0 (Baixar PDF / Abrir tutorial)
- `flows.templates.card` - Card de template , 'Visualizar' e 'Usar' (duplicar como rascunho)
- `flows.editor.condicoes-aresta` - Edição de conexão (aresta) , condição por palavra-chave / predicados / 'Aresta padrão (else)'
- `flows.templates.sem-template-nicho` - Estado 'Ainda não temos templates prontos pra [nicho]' , CTA 'Pedir pra Iza montar (3min)'
- `flows.lista.atualizar-otimizar` - Lista de fluxos , badge 'stale' com botão 'Atualizar com o Maestro' e botão 'Otimizar' por fluxo
- `flows.paleta-nos` - Paleta de nós (Mensagem, Condição, Perguntar e capturar, Nó-IA, Marcar tag, Atualizar lead, Humano, Aguardar, Agendar retomada, Enviar para outro fluxo)
- `flows.pagina-inicial` - Página inicial do Maestro (Construa o atendimento da sua IA)
- `flows.no-ask.validacao` - Validação da resposta (tipo texto/número/e-mail/telefone, mensagem de erro, tentativas)
- `flows.wizard-objetivos` - Wizard MAESTRO INTELIGENTE , seleção de objetivos + 'Quero um especialista por objetivo' (multiAgent)

### settings

- `settings.team.remover-membro` - Botão Remover membro (ícone lixeira)
- `settings.general.salvar` - Botão Salvar alterações (Geral)
- `settings.ai.mensagem-handoff` - Campo Mensagem de handoff
- `settings.general.nome-organizacao` - Campo Nome da organização
- `settings.ai.nome-agente` - Campo Nome do agente
- `settings.canais.onboarding-assistido` - Card 'Prefere que a gente conecte com você?' (onboarding assistido)
- `settings.canais.tutorial` - Card Tutorial interativo de ativação
- `settings.billing.intro` - Card introdutório 'Controle de gastos do plano'
- `settings.canais.desconectar` - Desconectar canal (com modal de confirmação)
- `settings.team.convidar` - Formulário Convidar membro (papel + senha inicial)
- `settings.billing.stripe-nota` - Nota 'Faturas, planos e pagamento via Stripe (em breve)'
- `settings.canais.seletor-ativacao` - Seletor 'O que você quer ativar?' (WhatsApp/Instagram/Ambos)
- `settings.billing.notificar-percentual` - Slider Notificar ao atingir X% do limite

### tasks

- `tasks.card.concluir` - Botão concluir tarefa (checkbox circular)
- `tasks.card.prazo` - Card de tarefa , prazo e indicador de atraso
- `tasks.card.conteudo` - Card de tarefa , título e descrição (texto gerado pela IA)
- `tasks.card.vinculos` - Card de tarefa , vínculo com contato e com negócio (deal)
- `tasks.contador` - Contador 'X tarefas pendentes'
- `tasks.estado-vazio` - Estado vazio (nenhuma tarefa pendente/nenhuma tarefa)
- `tasks.filtros` - Filtros de status (Pendentes / Concluídas / Todas)

### templates

- `templates.novo-botao` - Botão 'Novo template'
- `templates.form.nome` - Campo 'Nome do template'
- `templates.form.checkbox-reengajamento` - Checkbox 'Template de reengajamento (reabre a janela de 24h)'
- `templates.estado-vazio` - Estado vazio 'Nenhum template cadastrado'
