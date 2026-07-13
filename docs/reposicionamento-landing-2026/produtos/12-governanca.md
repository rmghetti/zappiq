# Governança e Confiança

### LGPD no núcleo, auditoria à prova de adulteração, SLA com crédito automático e dados que ficam no Brasil

> Dossiê de produto | Catálogo ZappIQ | Uma empresa MACHIA
> No Dash, este produto aparece como **Auditoria** e **Requisições LGPD**, sustentado pela camada de segurança e SLA da plataforma.
> Fonte: implementação real em `apps/web/app/(dashboard)/audit-logs`, `/dsr`, `apps/web/app/legal`, `apps/web/app/sla`, `apps/api/src/services/auditService.ts`, `dsrFulfillment.ts`, `packages/shared/src/planConfig.ts`.

---

## Tagline

**Toda ação da sua operação registrada, assinada em SHA-256 e verificável em um clique. A LGPD deixa de ser medo e vira botão.**

---

## O problema concreto do dono de PME

Você colocou uma IA para conversar com seus clientes no WhatsApp. Ótimo para vender. Péssimo para dormir, se ninguém pensou em governança.

- Um cliente manda "apaga tudo o que vocês têm sobre mim". Você tem **15 dias corridos** para cumprir (LGPD Art. 19). Hoje isso vira um caça ao dado em planilha, print e conversa perdida. Se estourar o prazo, é descumprimento passível de sanção da ANPD.
- Um funcionário sai brigado e você não faz ideia de quem leu, editou ou apagou o quê no seu CRM na última semana. Não existe trilha. Sua palavra contra a dele.
- Vem uma auditoria (Meta, ANPD, um cliente grande no seu processo de compra) e pergunta: "onde ficam os dados? Você treina IA com as conversas dos meus clientes? Me mostra o registro de acesso". Você trava.
- O WhatsApp é seu canal crítico de vendas. Se o sistema cai numa segunda de manhã, quanto você perde? E quem te devolve esse prejuízo?

O dono de PME brasileiro não é advogado, não tem DPO interno, não tem time de segurança. A maioria das plataformas de atendimento vende "IA que responde" e empurra toda a governança para o colo do cliente. Governança e Confiança inverte isso: a conformidade vem montada, ligada e verificável.

---

## O que é

Governança e Confiança é a camada de LGPD, auditoria, segurança e SLA que roda **por baixo de toda a plataforma ZappIQ**. Não é um PDF de política que ninguém lê. São três coisas que funcionam de verdade dentro do Dash:

1. **Auditoria** (`/audit-logs`): uma trilha imutável que grava cada operação sensível de todos os produtos (Conversas, Contatos, CRM, Zap Impulso, Maestro, Treinar IA, Configurações), com ator, data, IP, finalidade e base legal, encadeada por hash SHA-256. Cadeia à prova de adulteração: qualquer alteração retroativa de um registro quebra a verificação e acende o alarme.

2. **Requisições LGPD** (`/dsr`): a fila viva dos direitos do titular (LGPD Art. 18). O cliente final pede acesso, correção, portabilidade, anonimização ou eliminação em um portal público, e a solicitação cai direto na sua fila com protocolo, contador de prazo e botões de execução. Exportar os dados de um titular ou eliminá-los (anonimizando o contato e removendo as conversas, sem perder suas métricas de negócio) é literalmente um clique.

3. **Segurança e SLA da plataforma**: dados processados e armazenados no Brasil, em São Paulo, criptografia em trânsito (TLS 1.3) e em repouso (AES-256), MFA, isolamento por tenant no banco, cláusula explícita de **não-treinamento** (seus dados e os do seu cliente não treinam modelo nenhum) e, nos planos superiores, SLA contratual de 99,9% com crédito automático na fatura quando a gente falha.

Tudo isso é padrão MACHIA: LGPD no núcleo, não como enfeite de rodapé.

---

## Como funciona (o mecanismo, traduzido em benefício)

### A trilha de auditoria é uma cadeia, não uma lista

Cada evento auditável carrega os campos que uma auditoria LGPD exige de verdade (implementado em `auditService.ts`):

- **ação** (ex.: `conversation.delete`), **recurso**, **ator** (nome e papel), **quando**, **IP** e **user-agent**;
- **finalidade** da operação (LGPD Art. 6) e **base legal** (Art. 7 e 11: Consentimento, Contrato, Obrigação legal, Legítimo interesse, entre outras);
- **titular dos dados** afetado (Art. 48, apuração de incidentes);
- um **hash SHA-256** do registro que inclui o **hash do evento anterior** (`prevHash`).

Esse encadeamento é o pulo do gato. Cada registro sela o anterior. Se alguém tentar editar, apagar ou reordenar um evento no banco, a cadeia matemática se rompe. O botão **Verificar Integridade** recalcula a cadeia inteira e devolve, honestamente, "cadeia íntegra, N registros verificados" ou "cadeia violada na sequência X". Em quase nenhuma plataforma de atendimento do Brasil você aperta um botão e prova, na hora, que seu histórico não foi mexido.

Dois detalhes de engenharia que viram benefício direto:

- **Redação de PII em duas camadas.** Antes de gravar qualquer snapshot, o serviço remove campos secretos (senha, token, chave) e redige PII brasileira (CPF, CNPJ, cartão, e-mail, telefone, CEP) de forma determinística. A trilha registra o que aconteceu sem virar, ela mesma, um novo vazamento de dado pessoal.
- **Anonimização em vez de exclusão bruta** (Art. 16). Quando um log vence o período de retenção do plano, o sistema apaga a PII (IP, user-agent, snapshots, titular) mas preserva ação, recurso e data para estatística e conformidade, sem quebrar a cadeia de hash.

### As Requisições LGPD saem da caixa de e-mail e viram fluxo

O titular preenche o portal público (`/legal/deletar-dados`). A solicitação grava na **mesma fila** que o administrador vê no Dash (unificação corrigida em `dsrIntake.ts`: antes havia dois sistemas paralelos e o pedido do titular nunca chegava ao admin). Nasce com protocolo, `dueDate` de 15 dias (Art. 19) e status PENDING, e dispara e-mail para o DPO e para o solicitante.

No Dash, cada requisição mostra o **contador de prazo**, que fica amarelo faltando 3 dias e vermelho quando vence. E os botões executam de verdade:

- **Acesso / Portabilidade**: exporta um pacote estruturado (JSON ou CSV) com o contato, todas as conversas e todas as mensagens do titular, casadas por telefone ou e-mail. "Concluir e avisar" dispara o e-mail de conclusão ao titular.
- **Eliminação / Anonimização** (Art. 18 VI e Art. 16): em uma transação, faz soft-delete das conversas e transforma nome, telefone e e-mail do contato em placeholders, **preservando as métricas agregadas** (lead score, estágio de funil, contadores). Você cumpre a lei sem cegar seus indicadores. A ação é idempotente: rodar de novo não estraga nada.

### A base é isolada por tenant e mora no Brasil

Cada organização é isolada no banco por RLS (Row Level Security) no PostgreSQL, com defesa em profundidade: filtro explícito de organização em cada consulta, contexto de tenant por transação e a policy do Postgres como rede final. Os dados são processados e armazenados no Brasil, em São Paulo, sobre infraestrutura com certificação SOC 2 Type II. O pior caso de uma falha de contexto é a consulta devolver vazio, nunca vazar dado de um cliente para outro.

---

## O que o cliente faz na prática (casos de uso reais)

- **Cumpre um "apaga meus dados" em minutos, não em dias.** Chega a requisição, você abre `/dsr`, clica em Eliminar, confirma. Contato anonimizado, conversas removidas, e-mail de conclusão enviado ao titular. Protocolo e prazo registrados. Fim.
- **Responde a due diligence de um cliente grande sem suar.** O comprador corporativo pergunta "cadê a trilha de acesso e a garantia de que vocês não treinam IA com meus dados". Você mostra a tela de Auditoria, aperta Verificar Integridade na frente dele e aponta a cláusula de não-treinamento e os dados em São Paulo. Objeção morta.
- **Prova quem fez o quê depois de um desligamento.** Filtra a Auditoria por ação (`contact.update`, `conversation.delete`) ou por recurso, abre o evento, vê ator, IP, finalidade e hash. Discussão encerrada com evidência, não com opinião.
- **Atende pedido de portabilidade de forma limpa.** Exporta JSON ou CSV com tudo do titular e entrega em formato aberto, sem abrir o banco na mão.
- **Dorme tranquilo com o canal crítico no ar.** Nos planos com SLA contratual, se a plataforma passar de ~43 minutos de indisponibilidade no mês, o crédito cai automático na fatura. Sem abrir ticket, sem negociar.
- **Fecha o mês de compliance sozinho.** A retenção de logs (90 dias no Lite, 24 meses no Scale, até 5 anos no Enterprise) e a anonimização automática de logs vencidos rodam sem ninguém tocar.

---

## Diferenciais únicos (contra o mercado brasileiro)

Os concorrentes de atendimento com IA no Brasil (Blip, Zenvia, Huggy, Poli, Letalk, Kommo, RD Conversas, GPT Maker, Zaia) já dizem todos "temos agentes de IA". Quase nenhum abre o capô da governança. A cunha da ZappIQ:

- **Trilha imutável com cadeia SHA-256 verificável em um clique.** Ter log é comum. Ter uma cadeia de hash que o próprio cliente verifica na tela e que denuncia adulteração retroativa é raro no mercado de atendimento BR.
- **Fila de Requisições LGPD nativa e executável.** Não é um formulário que gera um e-mail. É export e eliminação de verdade, com preservação de métricas e prazo do Art. 19 controlado dentro do produto.
- **Dados no Brasil, por padrão.** Dados processados e armazenados no Brasil, em São Paulo. Muita plataforma processa e guarda fora do país sem deixar isso claro.
- **Não-treinamento explícito e contratual.** Seus dados e os do seu cliente não alimentam nenhum modelo, com garantia estendida aos sub-processadores de IA (retenção efêmera, zero treino em inputs e outputs).
- **SLA que paga quando falha.** Crédito automático na fatura, com RPO 1h, RTO 4h, notificação de incidente em até 72h e postmortem público. A maioria promete SLA e não documenta RPO/RTO, que é justamente o que importa num incidente.
- **Zero setup, mensalidade fixa, sem cobrança por conversa, trial de 14 dias sem cartão.** A governança inteira vem junto do plano, não como taxa escondida.

---

## Valor de alto impacto (prova antes de promessa)

- **Prazo legal de 15 dias (Art. 19) atendido em minutos.** O que era garimpo manual em planilhas vira export ou eliminação em 1 clique. A margem de erro que gera sanção da ANPD (até 2% do faturamento por infração, teto de R$ 50 milhões) sai de cima do dono.
- **100% dos eventos sensíveis encadeados e verificáveis.** Qualquer adulteração retroativa é detectada na sequência exata em que ocorreu. Zero pontos cegos na trilha.
- **99,9% de SLA = no máximo ~43 minutos de indisponibilidade por mês**, com crédito automático de 10% a 50% da mensalidade conforme a falha, limitado a 50% do mês afetado. RPO 1h, RTO 4h.
- **Notificação de incidente em até 72h** à ANPD e aos titulares (Art. 48), com postmortem público no mesmo prazo.
- **Retenção de trilha de até 5 anos** (Enterprise) e 24 meses (Scale), com anonimização automática do que vence.
- **Zero uso de dados para treinamento de IA**, cláusula explícita na Política de Privacidade e estendida aos provedores de modelo.

---

## Integração com o resto da plataforma (a tese da plataforma completa e autônoma)

Governança e Confiança não é um módulo à parte. É o chão embaixo de todos os outros produtos:

- **Conversas, Contatos e CRM**: cada leitura, edição ou exclusão de dado pessoal entra na Auditoria com finalidade e base legal. A eliminação de um titular varre as conversas de **todos os canais** (WhatsApp, Instagram Direct) e o registro do contato.
- **Iza (o agente)**: opera sempre dentro do tenant isolado do cliente. O que a Iza lê e faz é rastreável, e nada do que ela processa vira material de treino.
- **Zap Impulso** (campanhas e disparos): os disparos em massa ficam sob a mesma trilha e sob o consentimento de marketing registrado no contato, respeitando a revogação de consentimento vinda das Requisições LGPD.
- **Maestro** (construtor de fluxos) e **Treinar IA** (base de conhecimento): mudanças de fluxo e ingestão de documentos entram na Auditoria. A base de conhecimento do titular também é alcançada pela eliminação quando aplicável.
- **Qualidade da IA** (loop de auto-correção auditada): as correções da IA passam pela mesma lógica de trilha, o que fecha o ciclo de "a IA resolve e o sistema registra por que resolveu daquele jeito".
- **Analytics e Radar 360**: leem eventos que já nascem estruturados e com base legal, então a observabilidade herda a conformidade de origem.

A promessa é essa: a ZappIQ opera a operação do cliente de ponta a ponta e, ao mesmo tempo, mantém a prova de que operou dentro da lei. Autonomia com rastro auditável.

---

## Disponibilidade por plano, add-on e preço

Fonte: `packages/shared/src/planConfig.ts`. Planos ativos: **Lite R$ 247**, **Growth R$ 497** (mais popular), **Scale R$ 1.497**, **Enterprise** sob consulta. Anual com 20% de desconto no Lite, Growth e Scale (o Enterprise tem condição própria). Zero setup, sem cobrança por conversa; trial de 14 dias sem cartão no Lite e no Growth.

**Incluído em todos os planos (Lite, Growth, Scale, Enterprise):**
- Auditoria com cadeia SHA-256 e botão de verificação de integridade.
- Requisições LGPD (portal público + fila no Dash, export e eliminação).
- Dados no Brasil (São Paulo), TLS 1.3, AES-256, MFA, isolamento por tenant, não-treinamento.
- Acesso à Auditoria e às Requisições restrito por papel (ADMIN, AUDITOR).

**Retenção de logs por plano:** Lite 90 dias, Growth 180 dias, Scale 24 meses (730 dias), Enterprise até 5 anos (1.825 dias).

**A partir do Scale (governança madura):**
- **SLA contratual 99,9% com créditos automáticos** (`slaContractual`).
- **SSO (SAML 2.0 / OIDC)** e auditoria LGPD completa.
- **DPO como contato direto + ROP customizado** (`dpoDirect`).

> Nota honesta de status: a página pública `/sla` ainda exibe uma tabela antiga com planos descontinuados. A fonte de verdade comercial (`planConfig.ts`) já dá SLA contratual 99,9% + créditos ao Scale. A tabela pública precisa ser atualizada para refletir Lite/Growth/Scale/Enterprise antes de divulgar.

**Só no Enterprise:**
- **SOC / NOC dedicado 24/7**, incluído no Enterprise.
- **Infraestrutura isolada (pool dedicado)**, incluída no Enterprise.
- **Retenção estendida de logs (5 anos)**, incluída no Enterprise.
- Contratos customizados, MSA e DPA específicos.

**Documentação legal pública já no ar:** Política de Privacidade, Termos, Cookies, DPA (Data Processing Agreement), parceria oficial com a Meta (Meta Business Partner, Cloud API direta), Fair Use e portal de exclusão de dados. Governança editorial dessas páginas é controlada por SOP formal com smoke tests automatizados (o próprio repositório impede que Termos e Privacidade se contradigam sobre treinamento de modelo).

**Status honesto do isolamento por tenant:** o RLS multi-tenant está no ar com defesa em profundidade (filtro explícito + contexto por transação + policy no Postgres). O endurecimento fino de todos os handlers está em rollout por ondas (entidades core como Contato, Mensagem e Auditoria já refatoradas; conversas, base de conhecimento e campanhas na sequência). O pior caso de uma falha de contexto é retorno vazio, não vazamento entre clientes.

---

## Sugestão de prova / mini-demo para a landing

**Demo interativa "Verifique você mesmo".** Um bloco na página que mostra três eventos de auditoria empilhados (ex.: "contato editado", "conversa exportada", "titular eliminado"), cada um com seu hash e o hash anterior. Um botão **Verificar integridade** roda a animação de recálculo e mostra "Cadeia íntegra, 3 de 3 verificados" em verde. Um segundo botão, **Simular adulteração**, muda um caractere de um registro antigo e roda a verificação de novo: a cadeia quebra em vermelho na sequência exata, com o aviso "acionar DPO, incidente Art. 48". Em quinze segundos o visitante entende, sem jargão, por que hash encadeado é diferente de "log comum".

Microcopy de apoio para a seção: *"Log qualquer todo mundo tem. Prova de que ninguém mexeu no log, quase ninguém. Aperte o botão."*

Complemento: um contador ao vivo puxando `status.zappiq.com.br` com o uptime do mês, ao lado da linha "se passar de 43 minutos de queda, o crédito cai sozinho na sua fatura".

---

## CTA

**Comece o trial de 14 dias sem cartão (Lite ou Growth) e abra a aba Auditoria no primeiro dia. Aperte Verificar Integridade e veja sua operação selada em SHA-256. Para SLA contratual 99,9% com crédito automático, DPO direto e SSO, fale com um especialista sobre o Scale.**

---

## Business case

Governança não aparece no fluxo de caixa como receita, aparece como risco que some e como negócio que destrava. O valor é medido em três frentes: tempo para cumprir a lei, prova de auditoria e continuidade do canal crítico. Uma operação típica de PME, antes e depois de ligar Governança e Confiança:

**Antes (governança no braço):**
- Pedido de titular (acesso ou eliminação, Art. 18): 3 a 5 dias úteis de garimpo em planilha, print e conversa, com risco real de estourar o prazo de 15 dias (Art. 19).
- Trilha de auditoria verificável: 0%. Nenhuma prova de integridade, nenhuma forma de mostrar quem acessou o quê.
- Queda do canal crítico: prejuízo 100% absorvido pela PME, sem crédito, sem SLA.

**Depois (Governança e Confiança ligada):**
- Pedido de titular: minutos, em 1 clique (export ou eliminação com as métricas preservadas), 100% dentro do prazo.
- Trilha: 100% dos eventos sensíveis encadeados em SHA-256 e verificáveis na tela, com detecção exata de adulteração.
- Queda: no máximo ~43 minutos por mês sob SLA 99,9%, com crédito automático de 10% a 50% da fatura, sem abrir ticket.

**A conta de ROI, honesta.** Governança raramente se paga por economia de horas, embora reduza um pedido de dias para minutos. Ela se paga por dois eventos concretos:

1. **Multa evitada.** Uma sanção da ANPD parte de percentual do faturamento (até 2% por infração, teto de R$ 50 milhões). Para uma PME que fatura R$ 300 mil por mês, 2% já são R$ 6 mil por infração, mais de doze meses de plano Growth (R$ 497). O produto não promete imunidade, mas tira de cima do dono o descumprimento por falta de ferramenta.
2. **Deal destravado.** Governança é o que faz a PME passar na due diligence de um cliente grande. Um único contrato B2B destravado costuma pagar a mensalidade por muitos meses. [ilustrativo]

Somando à plataforma em que a governança roda (Iza resolvendo ~65% dos atendimentos sem humano, +30% de conversão nas jornadas ativas, payback em ~90 dias) [ilustrativo], o retorno vem por dois caminhos ao mesmo tempo: a operação vende mais e, ao lado, para de correr o risco de vender fora da lei.

---

## Exemplo de aplicabilidade: instituição financeira (LGPD crítica)

**CredSerra**, financeira de crédito pessoal e consignado do interior paulista, porte pequeno-médio: 42 atendentes, base de cerca de 80 mil clientes, todo o atendimento de originação e cobrança rodando no WhatsApp. O dado que ela manuseia é dos mais sensíveis que existem: CPF, comprovante de renda, holerite, dados bancários, valor de dívida.

**A dor.** A CredSerra vive três medos ao mesmo tempo:
- Recebe cerca de 30 pedidos de titular por mês ("me mandem tudo o que têm sobre mim", "apaguem meus dados"). Cada um vira um dia e meio de garimpo entre planilha, CRM e conversa, e mais de uma vez quase estourou os 15 dias.
- Um analista saiu brigado e ninguém conseguiu provar o que ele acessou na carteira antes de ir embora.
- Um fundo quer comprar parte da carteira e, na due diligence, exige trilha de acesso aos dados dos tomadores e garantia de que nenhuma conversa vira treino de IA. A CredSerra travou: não tinha como provar.

**O produto agindo na operação:**
1. No onboarding, a base já sobe isolada por tenant (RLS), com dados processados e armazenados no Brasil, em São Paulo, TLS 1.3, AES-256 e MFA para os 42 atendentes.
2. O portal público de exclusão entra no rodapé do site e no WhatsApp. Todo pedido de titular cai na fila de **Requisições LGPD** com protocolo, contador de 15 dias e base legal.
3. Cada vez que um atendente ou a **Iza** abre um contrato, consulta um CPF ou exporta dados, o evento entra na **Auditoria** encadeado em SHA-256, com ator, IP, finalidade e base legal.
4. Chega o pedido "apaguem meus dados" de um cliente que quitou. O DPO abre `/dsr`, clica em Eliminar: contato anonimizado, conversas removidas em soft-delete, e-mail de conclusão disparado, e o score e o estágio de funil preservados para a estatística. Minutos, não dias.
5. Na due diligence do fundo, a CredSerra abre a tela de Auditoria, aperta **Verificar Integridade** na frente do comprador ("cadeia íntegra, 12.480 registros verificados"), aponta a cláusula de não-treinamento e os dados em São Paulo. A objeção morre na sala.
6. Sobre o analista desligado, filtra a Auditoria por ator e mostra, com hash e finalidade, cada contrato que ele acessou na última semana. Discussão encerrada com evidência.
7. Numa segunda de originação, a plataforma oscila 50 minutos. Sob o SLA 99,9%, o crédito cai automático na fatura, sem a CredSerra abrir ticket.

**O desfecho, mensurável:**
- Pedidos LGPD: de ~1,5 dia útil para minutos por pedido, 100% dentro do prazo do Art. 19.
- Cobertura de auditoria: de 0% para 100% dos acessos a dado financeiro encadeados e verificáveis.
- Um contrato de repasse com o fundo, antes travado, destravado pela prova de governança. [ilustrativo]

**Como se conecta ao resto da plataforma (a tese completa).** A mesma CredSerra usa a **Iza** para originar e cobrar no WhatsApp dentro do tenant isolado; **Conversas** e **CRM** registram cada interação já com base legal; **Zap Impulso** dispara campanhas de renegociação respeitando o consentimento de marketing e a revogação vinda das Requisições LGPD; **Agenda** e **Tarefas** marcam os retornos de renegociação; **Analytics** e **Radar 360** leem eventos que já nascem conformes. Governança e Confiança é o chão que sustenta tudo isso: a financeira opera a operação inteira de ponta a ponta e, ao mesmo tempo, guarda a prova de que operou dentro da lei.

---

*Documento de trabalho interno para reposicionamento e landing. Os claims jurídicos e de infraestrutura seguem como copy final por decisão do fundador, sujeitos a revisão jurídica própria antes da publicação. Métricas modeladas estão marcadas [ilustrativo]. Sem travessão, pt-BR, tom MACHIA piloto-instrutor.*
