import type { SaibaMaisContent } from './types';

/**
 * Conteúdo do Saiba mais da área Settings (Configurações).
 */
export const settingsContent: SaibaMaisContent[] = [
  {
    featureKey: 'settings.general.plano-atual',
    titulo: 'Plano atual',
    clientSafe: true,
    oQueE:
      'É o campo somente leitura na aba Geral que mostra o nome do plano contratado hoje: Lite, Growth, Scale ou Enterprise.',
    paraQueServe:
      'Serve como referência rápida do que você está pagando, sem precisar abrir a tela de cobrança toda vez que quiser lembrar o nome do plano.',
    comoImplementar: [
      'Abra Configurações e fique na aba Geral.',
      'Veja o nome do plano logo abaixo do campo Nome da organização.',
      'Para ver o que está incluso, os limites de uso e comparar com outros planos, vá em Plano & Fatura na barra lateral.',
    ],
    exemploResultado:
      'Um dono de pet shop que assinou há três meses não lembra se está no Growth ou no Scale. Ele abre Configurações, aba Geral, vê "Growth" escrito ali e confirma sem precisar procurar o e-mail da assinatura.',
    relacionados: ['billing.comparativo-planos'],
  },
  {
    featureKey: 'settings.ai.segmento',
    titulo: 'Segmento do negócio',
    clientSafe: true,
    oQueE:
      'É o campo onde você escolhe o tipo do seu negócio: dentista, psicólogo, academia, advogado, salão de beleza, pet shop, imobiliária, restaurante, loja online ou genérico.',
    paraQueServe:
      'Guarda o segmento do seu negócio nas configurações. Hoje o vocabulário que a IA usa vem principalmente do que você preenche em Treinar IA (qualificação, documentos e perguntas e respostas); mantenha o segmento certo aqui para orientar os próximos ajustes do agente.',
    comoImplementar: [
      'Abra Configurações e vá até a aba IA/Agente.',
      'Escolha o segmento mais parecido com o seu negócio na lista Segmento.',
      'Se o seu ramo não estiver na lista, escolha Genérico.',
      'Clique em Salvar configurações.',
      'Para mudar de fato como a IA fala do seu ramo, atualize também o Treinar IA com o vocabulário e os exemplos do seu negócio.',
    ],
    exemploResultado:
      'Uma clínica odontológica marca o segmento Dentista nas configurações e, no Treinar IA, cadastra suas perguntas e respostas sobre clareamento e avaliação. É esse conteúdo do Treinar IA que faz a IA responder com o vocabulário certo do consultório.',
    relacionados: ['settings.ai.tom-de-voz'],
  },
  {
    featureKey: 'settings.ai.tom-de-voz',
    titulo: 'Tom de voz do agente',
    clientSafe: true,
    oQueE:
      'É o campo onde você escolhe como a IA vai soar ao conversar com seus clientes: Amigável, Formal ou Técnico.',
    paraQueServe:
      'Guarda sua preferência de tom nas configurações. Hoje o tom das respostas é definido principalmente na configuração inicial do agente e no que você ensina em Treinar IA; deixe sua preferência marcada aqui e ajuste a identidade do agente no Treinar IA para mudar como a IA soa.',
    comoImplementar: [
      'Abra Configurações e vá até a aba IA/Agente.',
      'Escolha uma opção no campo Tom de voz.',
      'Clique em Salvar configurações.',
      'Para ajustar de fato o tom das respostas, use o Treinar IA, na aba Identidade do agente.',
    ],
    exemploResultado:
      'Numa clínica de estética, o dono deixa a preferência de tom marcada como Amigável e, no Treinar IA (Identidade do agente), descreve que a marca fala de um jeito próximo e caloroso. É esse ajuste na identidade que faz a IA responder "oi, pra sua pele recomendamos a limpeza profunda, dura uma horinha" em vez de um texto seco.',
    relacionados: ['settings.ai.segmento'],
  },
  {
    featureKey: 'settings.billing.auto-overage',
    titulo: 'Auto-overage (continuar atendendo após o limite)',
    clientSafe: true,
    oQueE:
      'É o interruptor que decide o que acontece quando as mensagens de IA do mês passam do limite do seu plano. Ligado, a IA continua respondendo e você paga o excedente. Desligado, a IA para de responder assim que o limite acaba.',
    paraQueServe:
      'Te dá o controle sobre a troca entre nunca deixar cliente sem resposta e nunca levar uma cobrança extra surpresa na fatura.',
    comoImplementar: [
      'Abra Configurações e vá até a aba Cobrança & Limites.',
      'Marque o interruptor Auto-overage para ligar.',
      'Se quiser, defina logo abaixo um Teto de gasto mensal para limitar quanto esse excedente pode chegar a custar.',
      'Clique em Salvar preferências.',
    ],
    exemploResultado:
      'Numa academia que estourou o limite de mensagens do plano no dia 20, com o Auto-overage desligado a IA parou de responder no WhatsApp e os clientes ficaram sem retorno até o próximo ciclo. Depois de ligar o Auto-overage com um teto de R$150, a IA continuou atendendo normalmente e a fatura extra ficou dentro do esperado.',
    relacionados: ['settings.billing.teto-gasto'],
  },
  {
    featureKey: 'settings.billing.teto-gasto',
    titulo: 'Teto de gasto mensal em overage',
    clientSafe: true,
    oQueE:
      'É o valor em reais que define o limite máximo que você aceita pagar a mais quando as conversas passam do que está incluso no seu plano. Só funciona com o Auto-overage ligado.',
    paraQueServe:
      'Evita surpresa na fatura: quando o gasto extra bate nesse teto, a IA pausa automaticamente em vez de continuar gerando cobrança sem parar.',
    comoImplementar: [
      'Abra Configurações e vá até a aba Cobrança & Limites.',
      'Ligue o interruptor Auto-overage, o campo de teto só fica ativo com ele ligado.',
      'Preencha o valor em Teto de gasto mensal em overage. Deixe vazio se não quiser nenhum limite.',
      'Clique em Salvar preferências.',
    ],
    exemploResultado:
      'Com o teto em R$200, a IA continua atendendo até acumular R$200 em excedente e aí pausa até você fazer upgrade ou o ciclo virar.',
    relacionados: ['settings.billing.auto-overage'],
  },
  {
    featureKey: 'settings.canais.whatsapp-1-clique',
    titulo: 'Conectar WhatsApp em 1 clique',
    clientSafe: true,
    oQueE:
      'É a forma mais rápida de ligar seu WhatsApp Business à ZappIQ: você clica em Conectar com a Meta, faz login na conta que administra o negócio e autoriza. Não precisa copiar nenhum código nem token na mão. Hoje esse fluxo automático ainda depende de uma liberação da Meta, então pode não concluir a conexão para todo cliente.',
    paraQueServe:
      'Quando disponível, ativa o canal principal do produto sem exigir que você entre no Meta Business Suite para caçar IDs e tokens. Enquanto a liberação da Meta não chega para a sua conta, o caminho garantido é o formulário manual logo abaixo.',
    comoImplementar: [
      'Abra Configurações e vá até a aba Canais.',
      'Marque WhatsApp, ou WhatsApp e Instagram, em "O que você quer ativar?".',
      'Clique em Conectar com a Meta, no card verde.',
      'Faça login com a conta que administra o WhatsApp Business do seu negócio e autorize as permissões pedidas.',
      'Escolha a conta e o número que quer conectar quando o popup da Meta pedir.',
      'Se travar ou não concluir, use o formulário de conexão manual logo abaixo: hoje é o caminho que funciona para qualquer cliente.',
    ],
    exemploResultado:
      'Num salão de beleza, a dona clica em Conectar com a Meta, faz login e autoriza. Hoje esse fluxo em 1 clique ainda depende de uma liberação da Meta, então pode não concluir a conexão. Quando isso acontece, ela termina pelo formulário manual logo abaixo em poucos minutos, sem perder o que já tinha feito.',
    relacionados: ['settings.canais.whatsapp-manual', 'settings.canais.saude-qualidade'],
  },
  {
    featureKey: 'settings.canais.whatsapp-manual',
    titulo: 'Conectar WhatsApp manualmente',
    clientSafe: true,
    oQueE:
      'É o formulário onde você cola três informações do seu próprio app Meta: o Phone Number ID, o Business Account ID (WABA) e o Access Token. Hoje é o caminho mais usado, porque a conexão em 1 clique ainda depende de uma liberação da Meta.',
    paraQueServe:
      'Conecta seu número de WhatsApp Business à ZappIQ mesmo sem passar pelo fluxo automático, usando credenciais que você mesmo gera no Meta Business Suite.',
    comoImplementar: [
      'Abra o Tutorial interativo de ativação no topo da tela de Canais, ele mostra print de cada tela do Meta.',
      'No Meta Business Suite, vá em WhatsApp > API Setup e copie o Phone Number ID.',
      'Copie também o Business Account ID (WABA). É opcional, mas recomendado.',
      'Gere um token permanente de System User no Meta e cole no campo Access Token.',
      'Clique em Salvar e ativar canais.',
    ],
    exemploResultado:
      'Numa loja que ainda não conseguiu a conexão em 1 clique porque a Meta não liberou o Advanced Access para o app da ZappIQ, o dono segue o tutorial passo a passo, gera o token permanente no System User, cola os três campos e em poucos minutos o agente já responde no WhatsApp real da loja.',
    relacionados: ['settings.canais.whatsapp-1-clique', 'settings.canais.app-secret'],
  },
  {
    featureKey: 'settings.canais.saude-qualidade',
    titulo: 'Saúde dos canais',
    clientSafe: true,
    oQueE:
      'É o painel que mostra se cada canal (WhatsApp, Instagram) está conectado e a qualidade do seu número segundo a Meta: Qualidade alta, média, baixa, ou o alerta Número sinalizado.',
    paraQueServe:
      'Avisa cedo quando a Meta está prestes a limitar ou bloquear o envio de mensagens, para você agir antes que o atendimento pare de funcionar de vez.',
    comoImplementar: [
      'Abra Configurações, vá até a aba Canais e role até Saúde dos canais.',
      'Veja o selo de cada canal: Conectado ou Desconectado, e a qualidade quando disponível.',
      'Se aparecer Qualidade baixa ou Número sinalizado, reduza o volume de disparos em massa por alguns dias.',
      'Clique em Atualizar para conferir o status mais recente vindo da Meta.',
    ],
    exemploResultado:
      'Numa loja que disparou uma campanha grande demais para uma lista desatualizada, muitos números caíram e o selo virou Qualidade baixa. O dono viu o alerta no painel, pausou os disparos em massa por uma semana e a qualidade voltou ao normal, evitando que a Meta bloqueasse o número de vez.',
    relacionados: ['settings.canais.whatsapp-1-clique', 'settings.canais.whatsapp-manual'],
  },
  {
    featureKey: 'settings.canais.instagram-1-clique',
    titulo: 'Conectar Instagram em 1 clique',
    clientSafe: true,
    oQueE:
      'É a forma rápida de ligar seu Instagram Direct à ZappIQ: você clica em Conectar com a Meta, faz login na conta vinculada à sua página do Instagram Business e autoriza. Esse conector depende de uma configuração adicional feita pelo time da ZappIQ; se ainda não estiver liberado para a sua conta, o botão avisa e indica o modo manual.',
    paraQueServe:
      'Quando disponível, ativa o atendimento automático pelo Instagram Direct sem precisar copiar IDs nem tokens manualmente. Se o conector ainda não estiver liberado, o formulário manual logo abaixo é o caminho que funciona.',
    comoImplementar: [
      'Abra Configurações e vá até a aba Canais.',
      'Marque Instagram Direct, ou WhatsApp e Instagram, em "O que você quer ativar?".',
      'Confirme que sua conta do Instagram é do tipo Business e está vinculada a uma página do Facebook, é um pré-requisito da Meta.',
      'Clique em Conectar com a Meta, no card rosa, e autorize.',
      'Se aparecer um aviso de que o conector ainda está em configuração, use o formulário de conexão manual logo abaixo.',
    ],
    exemploResultado:
      'Numa loja de roupas que já vende bastante pelo Instagram, a dona clica em Conectar com a Meta e autoriza. Se o conector já estiver liberado para a conta dela, passa a receber e responder as mensagens do Direct direto pela ZappIQ, sem trocar de aplicativo. Se aparecer o aviso de que ainda está em configuração, ela segue pelo formulário manual logo abaixo. Se a conta ainda não for Business, ela precisa ajustar isso no próprio Instagram antes de tentar de novo.',
    relacionados: ['settings.canais.instagram-manual', 'settings.canais.whatsapp-1-clique'],
  },
  {
    featureKey: 'settings.canais.instagram-manual',
    titulo: 'Conectar Instagram manualmente',
    clientSafe: true,
    oQueE:
      'É o formulário onde você cola o Instagram Account ID, o Page ID da página do Facebook vinculada e o Access Token, para ligar o Instagram Direct sem passar pelo fluxo de 1 clique.',
    paraQueServe:
      'É a alternativa para quando o botão de 1 clique não está disponível ou não funciona, usando credenciais geradas direto no seu app Meta.',
    comoImplementar: [
      'Abra o Tutorial interativo de ativação para ver onde encontrar cada dado.',
      'Copie o Instagram Account ID da sua conta Business no Meta Business Suite.',
      'Copie o Page ID da página do Facebook vinculada ao Instagram.',
      'Gere um Page Access Token de longa duração e cole no campo Access Token.',
      'Clique em Salvar e ativar canais.',
    ],
    exemploResultado:
      'Numa imobiliária que preferiu configurar na mão, o dono segue o tutorial, encontra os três dados no Meta Business Suite, preenche o formulário e em poucos minutos o agente já responde as mensagens que chegam no Direct do Instagram da imobiliária.',
    relacionados: ['settings.canais.instagram-1-clique', 'settings.canais.app-secret'],
  },
  {
    featureKey: 'settings.canais.app-secret',
    titulo: 'App Secret (segurança do webhook)',
    clientSafe: true,
    oQueE:
      'É um código secreto do seu próprio app criado no Meta, usado para confirmar que as mensagens que chegam na ZappIQ realmente vieram do WhatsApp ou do Instagram, e não de alguém tentando se passar por eles.',
    paraQueServe:
      'Protege sua conta contra mensagens falsas sendo injetadas no seu atendimento. Só é necessário se você criou seu próprio app na Meta, quem passou pelo onboarding assistido da ZappIQ pode deixar em branco.',
    comoImplementar: [
      'Abra Configurações, vá até a aba Canais e role até Segurança do webhook.',
      'Se você conectou pelo onboarding assistido da ZappIQ, deixe o campo em branco.',
      'Se usa seu próprio app Meta, copie o App Secret em Configurações > Básico do painel do app e cole aqui.',
      'Clique em Salvar e ativar canais.',
    ],
    exemploResultado:
      'Numa empresa que criou o próprio app na Meta para ter mais controle técnico, o responsável colou o App Secret nesse campo. Sem isso, o webhook rejeitaria as mensagens recebidas por não conseguir confirmar que vieram mesmo da Meta.',
    relacionados: ['settings.canais.whatsapp-manual', 'settings.canais.instagram-manual'],
  },
  {
    featureKey: 'settings.flows.horario-comercial',
    titulo: 'Horário comercial',
    clientSafe: true,
    oQueE:
      'É o editor onde você define os dias e horários em que seu negócio está aberto. Esse horário alimenta a condição "Horário comercial" que pode ser usada dentro dos fluxos de automação.',
    paraQueServe:
      'Permite que a IA se comporte diferente fora do expediente, por exemplo avisando o cliente que a equipe vai responder no próximo dia útil, sem que você precise ficar de olho o tempo todo.',
    comoImplementar: [
      'Abra Configurações e vá até a aba Fluxos.',
      'Marque os dias da semana em que você atende e defina o horário de abertura e fechamento de cada um.',
      'Clique em Salvar horário.',
      'Para a IA realmente mudar o comportamento fora do horário, adicione a condição "Horário comercial" dentro do fluxo desejado, na tela de Fluxos.',
    ],
    exemploResultado:
      'Numa clínica que atende de segunda a sexta das 8h às 18h, o dono configura esse horário aqui e depois monta um fluxo que, fora desse intervalo, responde automaticamente "estamos fora do horário de atendimento, retornamos amanhã às 8h" em vez de tentar chamar um atendente humano que não está disponível.',
    relacionados: [],
  },
  {
    featureKey: 'settings.team.papeis',
    titulo: 'Papéis da equipe',
    clientSafe: true,
    oQueE:
      'Cada membro convidado para o time recebe um papel que define o que ele pode fazer dentro do sistema: Admin, Supervisor, Agente ou Auditor.',
    paraQueServe:
      'Controla o que cada pessoa da sua equipe consegue ver e mexer, para você não dar acesso demais, nem de menos, para quem vai usar o sistema no dia a dia.',
    comoImplementar: [
      'Abra Configurações e vá até a aba Equipe para ver a lista de membros e o papel de cada um.',
      'Admin tem acesso completo, inclusive convidar e remover pessoas.',
      'Supervisor acompanha e gerencia o atendimento, mas não mexe em configurações da conta.',
      'Agente atende conversas no dia a dia.',
      'Auditor só visualiza, sem poder alterar nada.',
      'Ao convidar alguém, escolha o papel certo no formulário antes de enviar o acesso.',
    ],
    exemploResultado:
      'Num escritório de advocacia, o dono é Admin, a recepcionista que atende o WhatsApp é Agente, e o contador que só precisa acompanhar os números sem risco de mexer em nada foi convidado como Auditor. Cada um vê só o que precisa para o seu trabalho.',
    relacionados: [],
  },
];
