import type { SaibaMaisContent } from './types';

/**
 * Conteúdo do Saiba mais da área Templates (Templates de WhatsApp).
 * Cobre P0, P1 e P2 do catálogo consolidado (2026-07-10).
 */
export const templatesContent: SaibaMaisContent[] = [
  {
    featureKey: 'templates.overview',
    titulo: 'Templates de WhatsApp',
    clientSafe: true,
    oQueE:
      'Template é um modelo de mensagem pré aprovado pela Meta (a empresa dona do WhatsApp). Diferente de uma mensagem livre, que só pode ser enviada dentro de uma conversa em andamento, o template pode ser usado a qualquer momento, mesmo com um contato que não fala com você há semanas.',
    paraQueServe:
      'Serve para dois casos que uma mensagem comum não resolve: disparar campanhas para uma lista de contatos e ter um texto já aprovado pela Meta pra tentar retomar contato com alguém que sumiu há mais de 24 horas. Campanhas podem rodar com ou sem template (dá pra mandar mensagem livre para quem está na janela de 24h); o template é o que permite falar com quem já passou desse prazo.',
    comoImplementar: [
      'Clique em "Novo template" no canto superior direito da página.',
      'Preencha nome, categoria, idioma e o corpo da mensagem no formulário.',
      'Salve o template e depois clique em "Enviar à Meta" para pedir a aprovação.',
      'Acompanhe o status do template na listagem: Pendente, Em análise, Aprovado ou Rejeitado.',
    ],
    exemploResultado:
      'Uma clínica odontológica cria o template "confirmacao_retorno" para lembrar pacientes que sumiram do acompanhamento. Depois de aprovado pela Meta, a clínica usa esse template numa campanha para os 40 pacientes inativos do mês, e parte deles volta a agendar consulta.',
    relacionados: ['templates.fluxo-aprovacao-meta', 'templates.status-aprovacao'],
  },
  {
    featureKey: 'templates.fluxo-aprovacao-meta',
    titulo: 'Do rascunho ao uso: o caminho de um template',
    clientSafe: true,
    oQueE:
      'É a sequência completa que todo template percorre até poder ser usado de verdade: você cria o rascunho, envia para a Meta avaliar, espera a resposta, e só depois consegue usá-lo em campanhas ou reengajamento.',
    paraQueServe:
      'Entender essa ordem evita erro caro. A Meta é rígida: nome ou categoria escolhidos errado costumam derrubar o pedido, e você só descobre isso dias depois, quando já perdeu tempo esperando. Seguir o passo a passo certo aumenta a chance de aprovação de primeira.',
    comoImplementar: [
      'Passo 1: clique em "Novo template" e preencha nome (em letras minúsculas e com underline no lugar de espaço, tipo promo_volta_aulas), categoria e corpo da mensagem com cuidado.',
      'Passo 2: salve o template. Ele nasce com status "Pendente", ainda não foi enviado para ninguém avaliar.',
      'Passo 3: clique em "Enviar à Meta". Evite editar o template a partir daqui até a Meta responder, pra não gerar inconsistência entre o que foi enviado e o que está salvo. O status muda para "Em análise".',
      'Passo 4: aguarde a resposta da Meta (normalmente algumas horas, podendo levar até 1 dia). O status muda para "Aprovado" ou "Rejeitado".',
      'Passo 5: se aprovado, o template já pode ser escolhido em campanhas ou marcado como reengajamento. Se rejeitado, corrija o texto do mesmo template com o motivo indicado e clique em "Enviar à Meta" de novo.',
    ],
    exemploResultado:
      'Uma loja de roupas cria o template "promo_fim_de_semana" com categoria Marketing, envia à Meta na segunda de manhã e recebe a aprovação na terça à tarde. Na quarta já consegue disparar a campanha para 800 contatos usando esse template.',
    relacionados: ['templates.overview', 'templates.status-aprovacao', 'templates.categoria'],
  },
  {
    featureKey: 'templates.status-aprovacao',
    titulo: 'Status do template',
    clientSafe: true,
    oQueE:
      'É a etiqueta colorida que mostra em que ponto do processo de aprovação da Meta cada template está: Pendente (ainda não foi enviado), Em análise (a Meta está avaliando), Aprovado (já pode ser usado) ou Rejeitado (a Meta recusou).',
    paraQueServe:
      'Evita que você tente usar um template que ainda não está pronto. Só o status Aprovado libera o template para campanhas e reengajamento. Sem entender o status, dá a impressão de que o sistema travou ou esqueceu do seu pedido.',
    comoImplementar: [
      'Olhe a etiqueta ao lado do nome do template na listagem.',
      'Se estiver "Em análise", só aguarde. A Meta costuma responder em algumas horas.',
      'Se estiver "Rejeitado", edite o nome, categoria ou texto do template corrigindo o motivo indicado, já que o erro mais comum é escolha errada de categoria.',
      'Você pode clicar em "Enviar à Meta" de novo quando o template estiver "Pendente" ou "Rejeitado" (depois de corrigir o texto).',
    ],
    exemploResultado:
      'Um restaurante vê o template "reserva_confirmada" com status "Em análise" na segunda-feira e, na terça, ele já aparece como "Aprovado". A partir daí o template passa a estar disponível para marcar como reengajamento.',
    relacionados: ['templates.fluxo-aprovacao-meta', 'templates.enviar-meta'],
  },
  {
    featureKey: 'templates.enviar-meta',
    titulo: 'Enviar à Meta',
    clientSafe: true,
    oQueE:
      'É o botão que manda seu template para a Meta avaliar. A partir do momento em que você clica, o ideal é não editar mais o template até a Meta responder, pra não gerar inconsistência entre o que foi enviado pra avaliação e o que está salvo no sistema.',
    paraQueServe:
      'É o passo que transforma um rascunho seu num template de verdade, aceito pelo WhatsApp Business. Sem enviar e ser aprovado, o template fica marcado como pendente e não deve ser usado pra reabrir conversas com contatos inativos.',
    comoImplementar: [
      'Revise nome, categoria e corpo da mensagem com atenção antes de clicar, porque editar depois de enviado pode deixar o texto avaliado pela Meta diferente do texto salvo no sistema.',
      'Clique em "Enviar à Meta" na linha do template.',
      'Depois de enviado, evite editar o template até a Meta responder.',
      'Acompanhe o status na listagem: depois do envio ele passa a refletir a análise da Meta, que pode aparecer como "Pendente" ou "Em análise" até a Meta responder.',
      'Se a Meta rejeitar, corrija o texto desse mesmo template com base no motivo indicado e clique em "Enviar à Meta" de novo.',
    ],
    exemploResultado:
      'Uma clínica de estética revisa o template "lembrete_retorno" três vezes antes de enviar, pra não perder tempo com uma rejeição evitável. Envia à Meta na quinta-feira e recebe aprovação na sexta, a tempo de usar no fim de semana.',
    relacionados: ['templates.status-aprovacao', 'templates.fluxo-aprovacao-meta'],
  },
  {
    featureKey: 'templates.reengajamento-24h',
    titulo: 'Template de reengajamento (janela de 24h)',
    clientSafe: true,
    oQueE:
      'A Meta só deixa a IA responder livremente a um contato durante 24 horas depois da última mensagem dele. Passado esse prazo, a conversa "fecha" e a única forma de falar com esse contato de novo é usando um template aprovado. É esse template especial que chamamos de reengajamento.',
    paraQueServe:
      'Sem um template de reengajamento, contatos que sumiram há mais de um dia ficam fora de alcance: a IA não consegue mandar mensagem nenhuma para eles, mesmo que você queira retomar o atendimento ou avisar sobre uma promoção.',
    comoImplementar: [
      'Crie um template pensado para reabrir conversa. Sem variáveis ele já funciona por completo, como "Faz um tempo que a gente não conversa por aqui. Posso te ajudar com algo?".',
      'No formulário, marque a caixa "Template de reengajamento (reabre a janela de 24h)".',
      'Envie o template à Meta e aguarde a aprovação, como qualquer outro template.',
      'Depois de aprovado, escolha esse template numa campanha para contatos inativos: ele é disparado de verdade e alcança quem já passou das 24 horas. Se usar o nome do cliente ({{1}}), aponte esse marcador para o primeiro nome do contato na seção de variáveis, e cada pessoa recebe a mensagem personalizada.',
    ],
    exemploResultado:
      'Um cliente de uma loja de móveis some do WhatsApp há 3 dias. Como a janela de 24h fechou, uma mensagem livre não chega até ele. A loja usa um template de reengajamento aprovado e sem variáveis, tipo "Faz um tempo que a gente não conversa por aqui. Posso te ajudar com algo?", numa campanha para os inativos, e a mensagem chega, reabrindo a conversa.',
    relacionados: ['templates.overview', 'templates.categoria'],
  },
  {
    featureKey: 'templates.categoria',
    titulo: 'Categoria do template',
    clientSafe: true,
    oQueE:
      'É a classificação que a Meta exige para todo template: Marketing (promoções, novidades, ofertas), Utilidade (atualização de pedido, lembrete, aviso) ou Autenticação (código de verificação). Cada categoria segue regras diferentes de aprovação.',
    paraQueServe:
      'Escolher a categoria certa evita rejeição pela Meta, que revisa Marketing com mais rigor que Utilidade.',
    comoImplementar: [
      'Leia o texto do seu template e pergunte: ele está vendendo algo ou avisando sobre uma promoção? Se sim, é Marketing.',
      'Se o texto avisa sobre algo que o próprio cliente já esperava (pedido, agendamento, cobrança), é Utilidade.',
      'Se o texto só manda um código de verificação, é Autenticação.',
      'Escolha a categoria no card correspondente ao criar o template. Na dúvida, prefira Utilidade quando o conteúdo for uma atualização, porque passa por revisão menos rígida que Marketing.',
    ],
    exemploResultado:
      'Uma farmácia cria um template avisando que o pedido está a caminho e escolhe Utilidade. Outro template, oferecendo desconto na compra do mês seguinte, é marcado como Marketing. O primeiro é aprovado em poucas horas, o segundo passa por uma revisão mais demorada da Meta.',
    relacionados: ['templates.form.categoria', 'templates.fluxo-aprovacao-meta'],
  },
  {
    featureKey: 'templates.form.categoria',
    titulo: 'Escolher a categoria certa',
    clientSafe: true,
    oQueE:
      'É o seletor com três opções (Marketing, Utilidade, Autenticação) que aparece ao criar ou editar um template. A Meta usa essa escolha para decidir com que rigor vai revisar o template.',
    paraQueServe:
      'Escolher errado é um dos motivos mais comuns de rejeição pela Meta. Marketing passa por revisão mais rígida que Utilidade, então acertar aqui evita atraso.',
    comoImplementar: [
      'Releia o hint abaixo de cada opção no formulário: "Promoções, novidades, ofertas" é Marketing; "Atualizações de pedido, lembretes, avisos" é Utilidade; "Códigos de verificação (OTP)" é Autenticação.',
      'Se o template menciona desconto, oferta ou promoção de qualquer tipo, marque Marketing, mesmo que pareça só um lembrete.',
      'Se o template só informa algo que o cliente já pediu ou já espera (status de pedido, confirmação de agendamento), marque Utilidade.',
      'Clique no card da categoria escolhida antes de salvar. O card fica destacado para confirmar a seleção.',
    ],
    exemploResultado:
      'Uma loja de roupas tenta enviar um template de "10% de desconto na próxima compra" marcado como Utilidade e a Meta rejeita, porque o conteúdo é promocional. Ao recriar o mesmo texto marcado como Marketing, o template é aprovado, ainda que a revisão demore um pouco mais.',
    relacionados: ['templates.categoria', 'templates.form.corpo-variaveis'],
  },
  {
    featureKey: 'templates.form.corpo-variaveis',
    titulo: 'Corpo da mensagem e variáveis',
    clientSafe: true,
    oQueE:
      'É o texto principal do template. Nele você pode usar marcadores como {{1}}, {{2}} para indicar pra Meta que aquele trecho da mensagem é variável.',
    paraQueServe:
      'Os marcadores {{1}}, {{2}} deixam um trecho da mensagem mudar para cada contato, tipo o nome dele. Quando você usa um marcador, aparece logo abaixo a seção "O que preenche cada variável": ali você escolhe o que entra em cada um (primeiro nome, nome completo, empresa do contato ou um texto fixo) e um valor de reserva para quando o contato não tiver aquele dado. Na campanha, cada pessoa recebe a mensagem já com o valor dela.',
    comoImplementar: [
      'Escreva a mensagem no campo "Corpo da mensagem" usando {{1}} onde quiser inserir o nome do contato, {{2}} para um segundo dado, e assim por diante.',
      'Use os marcadores em ordem, começando de {{1}}, sem pular números.',
      'Escreva um texto natural ao redor das variáveis, tipo "Oi {{1}}! Seu pedido {{2}} já está a caminho.".',
      'Abaixo do corpo, na seção "O que preenche cada variável", diga a origem de cada marcador e, se quiser, um valor de reserva. Se não precisar personalizar, é só escrever o template sem marcadores.',
    ],
    exemploResultado:
      'Uma ótica cria "Oi {{1}}! Seus óculos já estão prontos para retirada." e aponta o {{1}} para o primeiro nome do contato, com reserva "tudo bem". Numa campanha, o João recebe "Oi João! ..." e quem não tem nome cadastrado recebe "Oi tudo bem! ...", tudo automático.',
    relacionados: ['templates.form.categoria', 'templates.form.rodape'],
  },
  {
    featureKey: 'templates.form.idioma',
    titulo: 'Idioma do template',
    clientSafe: true,
    oQueE:
      'É o código que informa à Meta em que idioma o template foi escrito. Para português do Brasil, o valor correto é "pt_BR", exatamente assim, com "pt" minúsculo, underline e "BR" maiúsculo.',
    paraQueServe:
      'A Meta usa esse código para validar o template durante a aprovação. Se o valor estiver escrito errado, tipo "português" ou "pt-br" com hífen, a Meta pode rejeitar com uma mensagem de erro técnica, então prefira deixar o campo como veio preenchido.',
    comoImplementar: [
      'Deixe o campo como veio preenchido por padrão: "pt_BR".',
      'Se precisar digitar de novo, use exatamente "pt_BR": letras minúsculas em "pt", underline no meio, "BR" maiúsculo no final.',
      'Evite espaços, acentos ou o nome do idioma por extenso nesse campo.',
    ],
    exemploResultado:
      'Um salão de beleza edita o campo sem querer e digita "portugues". Ao enviar à Meta, aparece um alerta na tela com uma mensagem de erro técnica da Meta. Ao corrigir para "pt_BR" e reenviar, o template é aprovado no mesmo dia.',
    relacionados: ['templates.form.categoria'],
  },
  {
    featureKey: 'templates.form.rodape',
    titulo: 'Rodapé do template',
    clientSafe: true,
    oQueE:
      'É uma linha opcional que aparece no final da mensagem, geralmente usada para dar ao contato uma forma de sair da lista, como "Responda SAIR para não receber mais mensagens".',
    paraQueServe:
      'É uma boa prática incluir uma opção de sair em templates de Marketing, o que pode ajudar na aprovação. A política da Meta sobre isso muda com o tempo, então vale como recomendação, não como regra garantida.',
    comoImplementar: [
      'Para templates de categoria Marketing, adicione uma linha de rodapé oferecendo a opção de sair, como "Responda SAIR para parar de receber promoções".',
      'Para templates de Utilidade ou Autenticação, o rodapé costuma ser dispensável, mas pode ser usado para outra informação curta, como o nome da empresa.',
      'Mantenha o rodapé curto, numa linha só.',
    ],
    exemploResultado:
      'Uma loja de cosméticos cria um template de Marketing sem rodapé e a Meta rejeita. Ao adicionar "Responda SAIR para não receber mais promoções" no rodapé e reenviar, o template é aprovado.',
    relacionados: ['templates.form.categoria', 'templates.categoria'],
  },
];
