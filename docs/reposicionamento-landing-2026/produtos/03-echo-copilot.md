# Copiloto do Atendente

> Parte da plataforma ZappIQ. A Platform MACHIA Company. Meta Business Partner. Dados processados e armazenados no Brasil, em São Paulo.

**Tagline:** A IA não substitui o seu atendente. Ela senta do lado dele e sopra a resposta certa.

**Categoria:** camada de copiloto humano dentro de Conversas (a central de atendimento). Não é um produto avulso: é o cérebro que assiste quem está no teclado.

**Status honesto (por recurso):**

| Recurso | Status |
|---|---|
| Transcrição de áudio inbound (WhatsApp) | Disponível, em produção |
| Análise de sentimento em tempo real | Disponível, em produção |
| Corrigir e treinar a IA pelo Inbox (loop humano para a base) | Disponível, em produção |
| Sugestão de resposta em tempo real para o atendente | Em construção (entitlement Growth+ já ativo, geração em beta) |
| Resumo de conversa em 1 clique (para passagem de plantão) | Em construção (schema e tela prontos, geração sendo ligada) |
| Detecção de oportunidade de upsell durante a conversa | Em breve |

Nome interno do recurso no código: `echoCopilot` (entitlement por plano). No Dashboard, o cliente vive isso dentro de **Conversas**, não como um app separado.

---

## O problema concreto do dono de PME

Você contratou gente boa, mas nem todo mundo domina o catálogo, a política de troca, o preço da revisão ou o script de objeção. O resultado no dia a dia:

- O atendente novo trava numa pergunta que o veterano responderia em 5 segundos, e o cliente fica no vácuo.
- Cada pessoa responde de um jeito. A qualidade do atendimento depende de quem pegou a conversa.
- O cliente manda três áudios de 40 segundos e o atendente precisa ouvir tudo, com barulho de fundo, antes de entender o que ele quer.
- Na troca de turno, ninguém sabe o que já foi combinado. O cliente repete a história do zero e se irrita.
- O supervisor só descobre que uma conversa azedou quando o cliente já foi embora.

O custo disso não aparece numa planilha, mas aparece no faturamento: resposta lenta, venda perdida por insegurança e cliente que some porque foi mal atendido por quem estava aprendendo.

## O que é

O Copiloto do Atendente é a IA da ZappIQ trabalhando ao lado do humano, dentro da própria tela de Conversas. Quando o atendente está no comando, a Iza não some: ela ouve o áudio e devolve em texto, lê o sentimento do cliente, puxa o contexto do CRM e, na camada em construção, escreve um rascunho de resposta pronto para o atendente revisar e enviar.

A tese é simples: parte do atendimento a IA resolve sozinha (isso é o motor autônomo da Iza). O resto, quando entra um humano, esse humano não trabalha sozinho. Ele trabalha com um especialista invisível do lado, que já leu tudo sobre aquele cliente e já sabe o que a empresa costuma responder.

## Como funciona (o mecanismo, traduzido em benefício)

**1. Áudio vira texto na hora (disponível).** Quando o cliente manda áudio no WhatsApp, a plataforma baixa o arquivo da Meta e transcreve com Whisper (STT) antes de qualquer coisa. O texto puro fica registrado na conversa. Benefício para o atendente: ele lê em 2 segundos o que levaria 40 para ouvir, sem fone, sem pedir "pode repetir por escrito?". Custo de máquina de referência: cerca de US$ 0,006 por minuto de áudio, latência típica de 1,5 a 3 segundos para um áudio de 30 segundos. Isso roda no pipeline padrão da Iza, então vale em qualquer plano.

**2. Sentimento em tempo real (disponível).** Cada conversa carrega um marcador de sentimento (positivo, neutro, negativo) calculado por classificação de IA. Benefício: a conversa que está esfriando fica visível antes de o cliente sumir, e alimenta o gráfico de sentimento no Analytics.

**3. Sugestão de resposta (em construção, Growth+).** A ideia shipada em fases: a IA lê a última pergunta do cliente, o histórico do contato no CRM e a base de conhecimento da empresa (a mesma que treina a Iza), e devolve um rascunho de resposta. O atendente lê, ajusta se quiser e envia com um clique. O entitlement já está definido no plano (Growth para cima); a geração está em beta. Benefício alvo: o atendente novo responde com a segurança do veterano, porque a resposta certa já chega escrita.

**4. Resumo de conversa em 1 clique (em construção).** O campo de resumo e o evento de "Resumo da IA" na linha do tempo já existem no produto e aparecem na tela; a geração automática está sendo ligada. Benefício alvo: na troca de turno ou quando o vendedor assume um cliente que sumiu há um mês, ele lê "cliente esperando peça em estoque" em vez de rolar a conversa inteira.

**5. Corrigir e treinar pelo Inbox (disponível).** Este é o copiloto ao contrário, e já está no ar. Quando o atendente vê a IA dar uma resposta ruim, ele clica em "Corrigir e treinar", digita a resposta certa e ela vira um Q&A na base de conhecimento. Da próxima vez, a IA acerta sozinha. O humano não só é ajudado pela IA: ele ensina a IA, sem sair da conversa e sem abrir tela técnica.

## O que o cliente faz na prática (casos de uso reais)

- **Clínica com recepcionista em treinamento.** A recepcionista recebe "quanto custa a limpeza e vocês atendem sábado?". Em vez de travar, ela vê a transcrição do áudio já em texto, o histórico do paciente no painel do lado, e (na camada em beta) um rascunho pronto com o preço e o horário de sábado. Responde com confiança de especialista no primeiro dia.
- **Oficina automotiva, troca de turno.** O atendente da tarde assume 30 conversas abertas. Em vez de reler tudo, ele bate o olho no resumo de cada uma (recurso em construção) e sabe onde cada cliente parou.
- **Loja com fila de áudios.** O cliente manda três áudios explicando o problema do produto. O atendente lê o texto transcrito em segundos e já responde, sem ouvir 2 minutos de gravação com barulho.
- **Supervisor de equipe.** Ele acompanha o sentimento das conversas e vê antes quais estão em risco, priorizando onde a intervenção humana salva a venda.
- **Dono que quer padronizar o atendimento.** Toda vez que a IA erra e um humano corrige pelo Inbox, a base de conhecimento fica mais forte. O conhecimento do melhor atendente vira patrimônio da empresa, não sai pela porta quando ele pede demissão.

## Diferenciais únicos (contra os concorrentes brasileiros)

- **Vem junto, não é seat pago à parte.** Blip, Zenvia, Huggy, Poli e Kommo tratam "copiloto do atendente" como módulo premium ou cobram por assento e por crédito de IA. Na ZappIQ, o copiloto é entitlement do plano Growth, sem cobrança por sugestão e sem cobrança por conversa.
- **A sugestão bebe da mesma base que treina a IA.** Não é um chatbot genérico colado na tela. O rascunho puxa do RAG treinado no negócio do cliente (produto Treinar IA), então fala a língua da empresa.
- **O humano ensina a IA sem sair do Inbox.** O loop "corrigir e treinar" já está no ar e conecta direto com a base de conhecimento e com a Qualidade da IA. É a mesma governança de auto-correção auditada que nenhum concorrente de chat tradicional entrega.
- **Áudio é cidadão de primeira classe em qualquer plano.** A transcrição roda no motor padrão, não é "voz premium" escondida atrás do tier mais caro.
- **LGPD e dados no Brasil.** Transcrição e sugestão têm dados processados e armazenados no Brasil, em São Paulo, com trilha de auditoria por chamada de IA.

## Valor de alto impacto (resultados mensuráveis)

- Transcrição de áudio de 30 segundos disponível para o atendente em cerca de 1,5 a 3 segundos, contra os 30 a 40 segundos que ele levaria para ouvir. Ganho de tempo real por áudio: aproximadamente 90%.
- Redução de tempo de resposta do atendente com o copiloto ativo: alvo de até -60% [confirmar com dados de clientes reais].
- Precisão das sugestões de resposta: alvo de cerca de 90% [confirmar após saída do beta].
- Oportunidades de venda identificadas na conversa: alvo de +35% [confirmar; recurso de detecção de upsell ainda em breve].

Regra da casa: prova antes de promessa. Os três primeiros são de mecânica já em produção; os três com [confirmar] são metas do produto, a serem validadas com clientes antes de virar número de landing.

## Integração com os outros produtos (a tese da plataforma completa)

O Copiloto do Atendente não é uma ilha. Ele é o ponto onde a plataforma inteira conversa com o humano:

- **Conversas (central de atendimento):** é onde o copiloto vive. Áudio transcrito, sentimento e correção acontecem dentro do Inbox.
- **Treinar IA (base de conhecimento / RAG):** o rascunho de resposta puxa da mesma base que alimenta a Iza. Quando o humano corrige, a base fica mais forte na mesma hora.
- **Qualidade da IA (loop de auto-correção auditada):** cada correção feita pelo atendente entra no ciclo de melhoria auditada da IA.
- **CRM e Contatos:** o copiloto lê o histórico do contato, a etapa no funil e os negócios em aberto para sugerir com contexto, não no escuro.
- **Analytics:** sentimento e resumos alimentam o Pulso e os gráficos de operação.
- **Add-on Voz Nativa:** transcrição inbound mais resposta em voz (TTS) fecham o ciclo de áudio ponta a ponta.
- **Agenda (Agendamento pela IA):** quando a conversa vira intenção de marcar, o fluxo entrega para o agendamento automático.

Cada humano na operação passa a trabalhar com o CRM, a base de conhecimento e a IA da empresa inteira ao lado dele. Essa é a tese: uma plataforma agêntica que opera a operação, e quando entra gente, a gente não entra sozinha.

## Disponibilidade por plano, add-on e preço

- **Lite (R$ 247/mês):** não inclui o copiloto de sugestão. Já conta com transcrição de áudio (roda no motor da Iza) e com o loop de corrigir e treinar pelo Inbox.
- **Growth (R$ 497/mês, o mais popular):** copiloto habilitado (entitlement `echoCopilot` ativo). É o ponto de entrada para a sugestão de resposta ao atendente.
- **Scale (R$ 1.497/mês):** copiloto habilitado, com observabilidade e governança maiores.
- **Enterprise (sob consulta):** copiloto habilitado, sem limites.
- **Plano anual:** -20% no Lite, Growth e Scale (no Enterprise o desconto anual é 10%).

Bandeiras invioláveis: zero taxa de setup, mensalidade fixa sem cobrança por conversa, trial de 14 dias sem cartão. Implementação assistida é consultoria MACHIA, nunca taxa da plataforma. Não há cobrança por sugestão gerada.

## Sugestão de prova / mini-demo para a landing

Mini-demo interativa de Inbox lado a lado, em três passos animados:

1. Chega um áudio do cliente. Um clique em "play" mostra a onda sonora; ao lado, o texto transcrito aparece em 2 segundos, com o cronômetro marcando o tempo economizado.
2. O painel do CRM à direita se preenche sozinho: nome, etapa no funil, último negócio.
3. Um cartão "Sugestão da IA" desliza por baixo do campo de resposta, com o rascunho pronto e dois botões: "Usar" e "Editar". Selo discreto "beta" no cartão de sugestão, para honestidade.

Microcopy de apoio: "O cliente mandou 40 segundos de áudio. Seu atendente leu em 2 e já tinha a resposta escrita." Rodapé: "Transcrição em produção. Sugestão de resposta em beta no Growth."

## CTA

Comece o teste de 14 dias sem cartão e deixe seu atendente responder com a segurança do seu melhor vendedor. Ative o Growth e ligue o copiloto dentro de Conversas.

## Business case

Modelo de uma operação típica de PME no WhatsApp: 3 atendentes e cerca de 500 conversas por mês, boa parte com áudio e cliente sem paciência para esperar.

Três números antes (sem copiloto):

- Tempo de primeira resposta: 7 minutos em média. O atendente ouve o áudio inteiro, procura preço e política, digita do zero.
- Taxa de conversão de conversa qualificada em visita, orçamento ou pedido: 18%.
- Rampa de um atendente novo até responder com a segurança de um veterano: 6 a 8 semanas, e nesse meio-tempo ele erra preço e trava na objeção.

Três números depois (copiloto ligado no Growth):

- Tempo de primeira resposta: cerca de 3 minutos. O áudio de 40 segundos vira texto em 2 a 3 segundos e o rascunho de resposta já chega escrito. Alvo de redução de até -60% no tempo de resposta [confirmar com dados de clientes reais].
- Taxa de conversão: cerca de 23%, porque menos cliente some no vácuo e a resposta certa sai já na primeira. Uso a mesma faixa da calculadora ROI da plataforma, +30% de conversão, aplicada com desconto de honestidade [ilustrativo].
- Rampa do atendente novo: dias, não semanas. A segurança do veterano chega junto com a sugestão, então a folha rende desde a primeira semana.

Conta de padeiro do ROI [ilustrativo]: das 500 conversas por mês, cerca de 40% são qualificadas, ou seja 200 oportunidades. Subir a conversão de 18% para 23% dá aproximadamente 10 negócios a mais por mês. Se o ticket médio da PME for R$ 300, são R$ 3.000 de receita nova por mês contra R$ 497 do Growth. Se o ticket for R$ 80, são R$ 800 contra R$ 497. Nos dois casos o payback cabe dentro de ~90 dias [ilustrativo, alinhado à calculadora ROI da plataforma], antes mesmo de contar o tempo de folha economizado e o atendente novo que passa a render mais cedo.

O mecanismo, não o adjetivo: o ganho vem de três alavancas somadas. Transcrição que devolve cerca de 90% do tempo por áudio, sugestão que padroniza a resposta no nível do melhor vendedor, e o loop de corrigir e treinar que faz o erro de hoje não se repetir amanhã.

## Exemplo de aplicabilidade: imobiliária (corretor humano fechando negócio)

**O negócio.** Imobiliária Vista Nova, porte médio, 6 corretores, atua com locação e venda em uma cidade do interior. A maior parte dos leads chega pelo WhatsApp a partir de anúncios em portais e Meta Ads. Cada lead custa caro: o custo por lead dos anúncios fica em torno de R$ 45 e entram cerca de 300 leads por mês.

**A dor.** O corretor vive na rua, mostrando imóvel. O lead manda três áudios perguntando o valor do apartamento de 2 quartos, a condição de entrada e se a imobiliária aceita o carro na permuta. O corretor só ouve os áudios horas depois, quando o lead já falou com o concorrente. O dinheiro do anúncio esfria na caixa de entrada, e ninguém no plantão sabe quem já estava quente.

**O produto agindo na operação, passo a passo:**

1. O lead manda o áudio. A plataforma transcreve na hora. Entre uma visita e outra, o corretor lê em 2 segundos: "quero o apê de 2 quartos no Jardim, quanto fica de entrada e vocês aceitam meu carro na troca?". Não precisa parar a visita para ouvir 40 segundos de áudio.
2. O painel do CRM à direita já mostra a origem do lead (qual anúncio), o imóvel de interesse, a faixa de renda declarada no formulário e o histórico do contato.
3. A sugestão de resposta (beta, Growth) puxa da base treinada da própria imobiliária (Treinar IA): valor do imóvel, condição de entrada e a política de permuta atualizada. O corretor confere o número, ajusta o tom e envia. Resposta em minutos, com o corretor ainda na rua.
4. O sentimento em tempo real acende o alerta: o supervisor vê que um lead quente está esfriando (marcador negativo) e cobra o follow-up antes de perder para o concorrente.
5. A conversa vira intenção de visita. A Agenda (Agendamento pela IA) marca o horário do plantão sem o corretor sair do Inbox.
6. Se a IA respondeu a política de permuta errada, o corretor clica em "Corrigir e treinar", digita a regra certa e ela vira Q&A na base. O próximo lead com a mesma dúvida já recebe a resposta correta sozinho.

**O desfecho mensurável:**

- Antes: tempo de primeira resposta de 3 horas, conversão de lead em visita agendada de 12%.
- Depois: primeira resposta em ~10 minutos mesmo com o corretor na rua, conversão de lead em visita subindo para ~16% [ilustrativo].
- A conta: recuperar os leads que antes esfriavam por demora significa cerca de 12 visitas a mais por mês (de 36 para 48, sobre os 300 leads). A uma taxa de fechamento de 8% por visita, é aproximadamente 1 negócio a mais por mês. Com comissão média de R$ 6.000 por negócio, isso paga o Growth (R$ 497/mês) mais de dez vezes, e cada lead recuperado é dinheiro de anúncio (R$ 45 cada) que deixou de ir para o lixo.

**A tese da plataforma completa dentro do cenário.** O copiloto não trabalha sozinho: Conversas é onde o corretor vive; Treinar IA guarda a tabela de preços, as condições de financiamento e a política de permuta; o CRM traz a origem do lead, o imóvel de interesse e a faixa de renda; a Agenda marca a visita; o Analytics mostra ao gestor quais anúncios trazem lead que de fato converte; e o Zap Impulso reaquece o lead que visitou e não fechou. O corretor humano fecha o negócio, mas fecha com a imobiliária inteira sentada do lado dele.
