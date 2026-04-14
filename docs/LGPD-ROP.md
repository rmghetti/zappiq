# ROP — Registro de Operações de Tratamento de Dados Pessoais

**Controlador:** ZappIQ Tecnologia Ltda. (CNPJ a cadastrar)
**Encarregado (DPO):** Rodrigo Ghetti — dpo@zappiq.com
**Base legal da elaboração:** LGPD (Lei 13.709/2018), Art. 37
**Versão:** 1.0 — abril/2026
**Próxima revisão:** outubro/2026 (revisão semestral)

---

## Contexto

Este ROP registra as operações de tratamento de dados pessoais realizadas pela ZappIQ em sua atuação como:

- **Controladora** — dados dos usuários administrativos da plataforma (clientes que contratam ZappIQ)
- **Operadora** — dados dos clientes finais dos nossos clientes (titulares atendidos via WhatsApp)

As duas figuras coexistem e exigem registros distintos.

---

## Seção A — ZappIQ como Controladora

Dados dos próprios clientes/usuários da plataforma.

### A.1 Cadastro e autenticação de usuários

- **Categorias de dados:** Nome completo, e-mail, telefone, senha (hash bcrypt), IP de acesso, user-agent, data/hora de login
- **Titulares:** usuários administrativos dos clientes ZappIQ (gestores, atendentes, admins)
- **Finalidade:** autenticação, controle de acesso, auditoria de segurança
- **Base legal:** execução de contrato (Art. 7º, V) e legítimo interesse para logs de auditoria (Art. 7º, IX + Art. 10)
- **Retenção:** dados de cadastro durante vigência + 5 anos após término; logs de acesso 1 ano (hot), 4 anos (cold/arquivo)
- **Compartilhamento:** nenhum com terceiros além de operadores técnicos (Supabase, Fly.io, Upstash)
- **Medidas de segurança:** criptografia AES-256 em repouso, TLS 1.3 em trânsito, senha em hash bcrypt cost 12, MFA opcional (obrigatório para admins Enterprise), audit log de acessos

### A.2 Faturamento e cobrança

- **Categorias de dados:** Razão social, CNPJ, endereço de faturamento, e-mail financeiro, histórico de transações, meios de pagamento (processados pelo Stripe — nunca armazenados no banco ZappIQ)
- **Titulares:** pessoas de contato financeiro dos clientes ZappIQ
- **Finalidade:** faturamento, cobrança, obrigações fiscais
- **Base legal:** execução de contrato (Art. 7º, V) + obrigação legal (Art. 7º, II — receita federal, nota fiscal)
- **Retenção:** 5 anos após último evento (obrigação fiscal SPED/NF)
- **Compartilhamento:** Stripe (processador de pagamento — acordo DPA via Stripe Services Agreement), contador para obrigações fiscais
- **Medidas de segurança:** PCI DSS compliance via Stripe (ZappIQ não toca cartão)

### A.3 Comunicação comercial e suporte

- **Categorias de dados:** e-mail, telefone, conteúdo de tickets, gravações de chamadas de suporte (quando aplicável), dados de interação (produto utilizado, features acessadas)
- **Titulares:** contatos comerciais dos clientes ZappIQ
- **Finalidade:** suporte técnico, comunicação de atualizações, customer success
- **Base legal:** execução de contrato (Art. 7º, V) + consentimento para marketing (Art. 7º, I)
- **Retenção:** ativo enquanto cliente + 2 anos após término (para histórico de atendimento); gravações 90 dias
- **Compartilhamento:** nenhum

### A.4 Logs técnicos e observabilidade

- **Categorias de dados:** IP, user-agent, timestamps, paths acessados, métricas de uso anonimizadas
- **Titulares:** usuários administrativos dos clientes
- **Finalidade:** operação técnica, detecção de fraude, SLA mensuration, suporte
- **Base legal:** legítimo interesse (Art. 7º, IX) + obrigação legal (Marco Civil Art. 15 — retenção 6 meses mínimo)
- **Retenção:** 1 ano hot (Grafana), 4 anos cold (S3 arquivado cifrado)
- **Compartilhamento:** Grafana Cloud (operador técnico sob DPA via ToS Grafana Labs)

---

## Seção B — ZappIQ como Operadora

Dados dos consumidores finais dos nossos clientes (titulares atendidos via WhatsApp).

### B.1 Conversas via WhatsApp

- **Categorias de dados:** número de telefone, nome (se fornecido), conteúdo de mensagens trocadas (texto, áudio, imagem, documento), metadados (timestamp, status de leitura), tags e campos customizados criados pelo cliente
- **Titulares:** consumidores/leads/clientes dos nossos clientes
- **Finalidade:** intermediar comunicação WhatsApp conforme instruções do controlador (nosso cliente)
- **Base legal:** a ser estabelecida pelo CONTROLADOR (nosso cliente). ZappIQ não coleta consentimento direto — atua como operadora conforme Art. 39.
- **Retenção:** conforme política do cliente (default 2 anos, configurável)
- **Compartilhamento:** Meta (via WhatsApp Business Cloud API — operadora sub-encarregada sob DPA Meta)
- **Medidas de segurança:** isolamento multi-tenant via Row-Level Security, criptografia em repouso e trânsito, auditoria de acesso, DSR portal nativo

### B.2 Dados de CRM (Nexus)

- **Categorias de dados:** dados cadastrais criados pelo cliente (nome, CPF, e-mail, telefone, endereço, tags, histórico de interações, notas de agentes)
- **Titulares:** leads/clientes dos nossos clientes
- **Finalidade:** gestão de relacionamento conforme instruções do controlador
- **Base legal:** a ser estabelecida pelo CONTROLADOR
- **Retenção:** conforme política do cliente + 30 dias após solicitação de exclusão (para permitir auditoria de exclusão)
- **Compartilhamento:** nenhum (exceto integrações explicitamente configuradas pelo cliente)

### B.3 Embeddings vetoriais para busca semântica (RAG)

- **Categorias de dados:** texto ingestionado pelo cliente (FAQs, catálogos, documentos de conhecimento), representações vetoriais 1024-dim, hashes de conteúdo para deduplicação
- **Titulares:** dados corporativos do cliente (geralmente não pessoais); se cliente envia dados pessoais, esses ficam isolados no namespace dele
- **Finalidade:** busca semântica pelo Pulse AI (respostas automatizadas)
- **Base legal:** execução de contrato
- **Retenção:** enquanto cliente mantém documento; exclusão imediata via endpoint DSR `/ingest/{namespace}/{source}`
- **Compartilhamento:** Voyage AI (processamento de embeddings — operadora sub-encarregada sob ToS Voyage) OU OpenAI como fallback
- **Medidas de segurança:** namespace isolation por cliente (`org_<uuid>`), unique index por hash para idempotência, RLS no banco

### B.4 Mídias (áudio, imagem, documento)

- **Categorias de dados:** arquivos enviados em conversas WhatsApp
- **Titulares:** consumidores
- **Finalidade:** intermediar troca de mídia conforme WhatsApp Business
- **Retenção:** 90 dias em hot storage, 2 anos em cold storage (configurável pelo cliente)
- **Compartilhamento:** Meta CDN (referência) + storage próprio (S3/Supabase Storage)
- **Medidas de segurança:** URLs assinadas com TTL, criptografia server-side

---

## Seção C — Transferências internacionais (Art. 33)

**Status atual:** operação 100% no Brasil. Infraestrutura:

- Fly.io região `gru` (São Paulo)
- Supabase região São Paulo
- Upstash região São Paulo

**Transferências internacionais existentes:**

| Operação                         | Destino              | Base legal                                          | Garantias adotadas                          |
|----------------------------------|----------------------|-----------------------------------------------------|---------------------------------------------|
| Chamadas para Anthropic (Claude) | EUA                  | Art. 33, VII — cumprimento de obrigação contratual  | SCC + DPA da Anthropic                      |
| Chamadas para OpenAI (fallback)  | EUA                  | Art. 33, VII                                        | DPA OpenAI + zero data retention opcional   |
| Chamadas para Voyage AI          | EUA                  | Art. 33, VII                                        | ToS Voyage (dados não armazenados após embed) |
| WhatsApp Business Cloud API       | Multi-região Meta   | Art. 33, VII + parte de serviço WhatsApp já aceito pelo titular ao usar a plataforma | DPA Meta                                   |
| Grafana Cloud                    | EU/US (configurável) | Art. 33, VII                                        | SCC + DPA Grafana Labs                      |

Telemetria enviada a Grafana é anônima (métricas agregadas, traces com IDs hashed). Nenhum dado pessoal do titular trafega.

Se expandirmos operação para fora do Brasil, revisar `docs/MULTI-REGION-READY.md` e atualizar esta seção.

---

## Seção D — Operadores sub-encarregados

Lista de operadores com os quais ZappIQ compartilha dados para prestação do serviço (Art. 39, §2º):

| Operador          | Serviço prestado                        | Categoria de dados        | País sede     | DPA/contrato                 |
|-------------------|------------------------------------------|---------------------------|---------------|-------------------------------|
| Supabase          | Banco de dados gerenciado                | Todos dados operacionais  | EUA (dados BR)| DPA Supabase + BAA disponível |
| Fly.io            | Hospedagem de aplicação                  | Dados em processamento    | EUA           | DPA Fly.io                    |
| Upstash           | Cache Redis                              | Dados transitórios        | EUA (dados BR)| DPA Upstash                   |
| Meta (WhatsApp)   | API WhatsApp Business                    | Mensagens, mídias         | EUA           | DPA Meta via WhatsApp BSP     |
| Anthropic         | LLM Claude                               | Prompts + responses       | EUA           | DPA Anthropic + zero retention|
| OpenAI (fallback) | LLM/embeddings fallback                  | Prompts + embeddings      | EUA           | DPA OpenAI + opt-out training |
| Voyage AI         | Embeddings para RAG                      | Texto para embedding      | EUA           | ToS Voyage                    |
| Stripe            | Processamento de pagamento               | Dados de cartão, faturas  | EUA           | Stripe DPA + PCI DSS Level 1  |
| Grafana Labs      | Observabilidade                          | Telemetria (anonimizada)  | EU/US         | DPA Grafana                   |
| AWS               | Backup de dumps cifrados                 | Dumps Postgres cifrados   | EUA/BR (sa-east-1)| DPA AWS                   |
| Vercel            | Hospedagem frontend Next.js              | Logs de edge, nenhum PII  | EUA           | DPA Vercel                    |

Operadores adicionados ou removidos devem ser registrados neste documento com data e justificativa.

---

## Seção E — Controles de acesso interno

Acesso a dados de titulares é controlado via:

- **Row-Level Security** no banco de dados (isolamento por org_id)
- **RBAC** (Role-Based Access Control) em nível aplicação (roles: OWNER, ADMIN, AGENT, VIEWER)
- **Audit log** completo de todos os acessos a dados de titulares, mantido por 1 ano em hot + 4 anos em cold
- **MFA** opcional (obrigatório para admins Enterprise a partir de Q3/2026)
- **Segregation of duties** — ninguém tem acesso simultâneo a secrets de prod e capacidade de modificar audit logs

---

## Seção F — Tempo de resposta a titulares (DSR)

Conforme Art. 18, §6º, respondemos em:

- **Planos Starter/Growth/Scale:** até 15 dias corridos da solicitação
- **Plano Enterprise:** até 48 horas úteis

Tipos de solicitação atendidas via portal `/dsr` na plataforma:

- Confirmação de tratamento
- Acesso aos dados
- Correção de dados incompletos, inexatos ou desatualizados
- Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade
- Portabilidade (export JSON/CSV)
- Eliminação dos dados tratados com consentimento (ressalvados Art. 16)
- Revogação de consentimento

---

## Seção G — Plano de resposta a incidentes

Conforme Art. 48:

1. Identificação do incidente (via alertas Grafana ou notificação externa)
2. Triagem em 1h — classificação SEV1/2/3 (ver `docs/RUNBOOK-INCIDENT.md`)
3. Contenção do incidente
4. Avaliação de risco a titulares (se afirmativo, disparar notificação)
5. Notificação à ANPD e aos titulares afetados em até 72h (via e-mail + comunicação no app)
6. Postmortem público em até 72h
7. Ações corretivas documentadas e implementadas
8. Atualização deste ROP com lições aprendidas

---

## Seção H — Revisão e atualização

Este ROP é revisado:

- **Semestralmente** (padrão) pelo DPO
- **Imediatamente** após:
  - Lançamento de novo produto/feature que trate dados pessoais
  - Adição/remoção de operador sub-encarregado
  - Incidente de segurança
  - Mudança em legislação aplicável
  - Solicitação de auditoria (interna ou externa)

**Histórico de revisões:**

| Versão | Data       | Alteração                              | Responsável     |
|--------|------------|----------------------------------------|-----------------|
| 1.0    | 2026-04-14 | Versão inicial                         | Rodrigo Ghetti  |

---

## Assinatura

Este ROP é mantido em versão viva pelo DPO e disponibilizado à ANPD sob solicitação, conforme Art. 37, §4º.

**DPO:** Rodrigo Ghetti — dpo@zappiq.com — +55 (11) 97210-5451
