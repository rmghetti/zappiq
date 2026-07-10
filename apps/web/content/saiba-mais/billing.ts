import type { SaibaMaisContent } from './types';

/**
 * Conteúdo do Saiba mais da área Billing (Plano e Fatura).
 */
export const billingContent: SaibaMaisContent[] = [
  {
    featureKey: 'billing.pagina',
    titulo: 'Plano e Fatura',
    clientSafe: true,
    oQueE:
      'É a tela financeira da sua conta ZappIQ. Aqui você vê o plano que está pagando, o estado da sua assinatura, quando vence a próxima cobrança, quanto está usando do seu limite e pode trocar de plano. Add-ons entram junto quando você assina ou troca de plano; se já for assinante e quiser adicionar um depois, é só falar com o suporte.',
    paraQueServe:
      'Serve para você entender exatamente o que está pagando e por quê, sem surpresa no cartão. É também de onde você faz upgrade quando a operação cresce ou ajusta o plano se estiver pagando por algo que não usa.',
    comoImplementar: [
      'Veja o card no topo da página: ele mostra se sua assinatura está ativa, em teste, com pagamento pendente ou cancelada.',
      'Role até "Uso do plano atual" para saber se está perto de estourar algum limite.',
      'Compare os planos na grade de cards e escolha Mensal ou Anual no seletor acima deles.',
      'Use o botão "Portal de faturas" sempre que precisar trocar o cartão ou baixar uma nota fiscal.',
    ],
    exemploResultado:
      'Num salão de beleza que está no plano Growth, o dono entra em Plano e Fatura, vê que já usou 90% das mensagens de IA do mês e decide fazer upgrade para o Scale antes de bater o limite e travar o atendimento automático.',
    relacionados: ['billing.comparativo-planos', 'billing.uso-do-plano'],
  },
  {
    featureKey: 'billing.pagamento-pendente',
    titulo: 'Pagamento pendente',
    clientSafe: true,
    oQueE:
      'É o aviso que aparece quando a última cobrança do seu cartão não passou, por saldo insuficiente, cartão vencido ou bloqueio do banco. Sua conta continua funcionando normalmente por enquanto, mas fica marcada como inadimplente.',
    paraQueServe:
      'Serve para você agir antes que o problema piore. Enquanto o pagamento está pendente, a Iza continua atendendo. Mas o sistema tenta cobrar de novo automaticamente por alguns dias, e se todas as tentativas falharem, a assinatura é cancelada e aí sim o atendimento automático para até você escolher um plano de novo.',
    comoImplementar: [
      'Clique no botão "Portal de faturas" no topo da página.',
      'No site que abrir, atualize o cartão ou o método de pagamento.',
      'Depois de atualizar, a próxima tentativa de cobrança já usa o cartão novo, sem você precisar fazer mais nada aqui.',
    ],
    exemploResultado:
      'Numa clínica cujo cartão corporativo venceu no dia da cobrança, o badge "Pagamento pendente" aparece na tela. O dono entra no Portal de faturas, troca para o cartão novo, e na tentativa seguinte a cobrança passa normalmente, sem nenhuma interrupção na Iza.',
    relacionados: ['billing.portal-faturas'],
  },
  {
    featureKey: 'billing.assinar-checkout',
    titulo: 'Assinar um plano',
    clientSafe: true,
    oQueE:
      'É o botão que leva você para a página de pagamento segura da Stripe, a empresa que processa os cartões da ZappIQ. Lá você preenche os dados do cartão e confirma a assinatura.',
    paraQueServe:
      'Serve para você começar a pagar por um plano com o mínimo de cliques. No plano Lite, que tem 14 dias grátis, o cartão é pedido na hora mas só é cobrado depois que o teste acaba; nos demais planos, sem teste grátis, a cobrança acontece assim que você confirma.',
    comoImplementar: [
      'Escolha Mensal ou Anual no seletor acima dos cards de plano.',
      'Clique em "Assinar" (ou "Começar 14 dias grátis" no Lite) no card do plano desejado.',
      'Você será redirecionado para a Stripe: preencha os dados do cartão e confirme.',
      'Ao terminar, você volta automaticamente para o Dashboard com o plano já ativo.',
    ],
    exemploResultado:
      'Um dono de barbearia clica em "Começar 14 dias grátis" no plano Lite, cadastra o cartão na Stripe e não é cobrado nada naquele momento. No dia 15, se ele não cancelar antes, o cartão é cobrado automaticamente em R$ 247.',
    relacionados: ['billing.dias-trial', 'billing.comparativo-planos'],
  },
  {
    featureKey: 'billing.dias-trial',
    titulo: 'Dias restantes de teste',
    clientSafe: true,
    oQueE:
      'É a contagem de quantos dias ainda faltam do seu teste grátis de 14 dias, disponível só no plano Lite. Esse número só aparece enquanto sua assinatura está no status "Em período de teste".',
    paraQueServe:
      'Serve para você não ser pego de surpresa: como o cartão já foi cadastrado no início do teste, ao chegar a zero a Stripe cobra automaticamente o valor do plano Lite, sem precisar de nenhuma ação sua.',
    comoImplementar: [
      'Acompanhe o número no card de status da assinatura, no topo da página.',
      'Se quiser continuar, não precisa fazer nada: a cobrança acontece sozinha quando o teste terminar.',
      'Se quiser cancelar antes de ser cobrado, clique em "Portal de faturas" e cancele a assinatura por lá.',
    ],
    exemploResultado:
      'Numa loja de roupas testando o Lite, o card mostra "3 dias restantes". O dono decide que quer continuar, não faz nada, e no quarto dia o cartão é cobrado em R$ 247 (ou R$ 197,60 se ele tivesse travado o plano anual antes do fim do teste).',
    relacionados: ['billing.assinar-checkout', 'billing.pagamento-pendente'],
  },
  {
    featureKey: 'billing.comparativo-planos',
    titulo: 'Planos disponíveis',
    clientSafe: true,
    oQueE:
      'É a grade com os quatro planos da ZappIQ (Lite, Growth, Scale e Enterprise), cada um com um preço e uma lista do que está incluído. Alguns termos técnicos aparecem nos planos: "atendentes" é quantas pessoas da sua equipe podem ter login no sistema; "mensagens de IA/mês" é quantas respostas automáticas a Iza pode gerar no mês; "documentos na base" é quanto material (PDFs, textos, páginas do site) você pode treinar na Iza.',
    paraQueServe:
      'Serve para você escolher o plano do tamanho certo da sua operação, sem pagar por limite que não vai usar nem travar no meio do mês por escolher um plano pequeno demais.',
    comoImplementar: [
      'Escolha Mensal ou Anual no seletor acima da grade (o anual sai 20% mais barato).',
      'Compare os limites de cada card: atendentes, mensagens de IA, contatos e fluxos de automação.',
      'Veja em "Uso do plano atual", mais abaixo na página, quanto você já usa hoje, e escolha um plano confortavelmente acima disso.',
      'No Enterprise, que é sob consulta, clique em "Falar com vendas" para receber uma proposta feita para o seu volume.',
    ],
    exemploResultado:
      'Numa rede de academias com 8 pessoas atendendo pelo WhatsApp, o Lite (1 atendente) e o Growth (10 atendentes) não fecham a conta direito: o dono escolhe o Scale, que libera 75 atendentes e cobre o crescimento planejado para o ano.',
    relacionados: ['billing.uso-do-plano', 'billing.recomendacao-plano'],
  },
  {
    featureKey: 'billing.recomendacao-plano',
    titulo: 'Plano recomendado',
    clientSafe: true,
    oQueE:
      'É um bloco em destaque que aparece quando seu teste está acabando, já acabou, ou ainda está ativo mas você quer assinar antes do fim. A ZappIQ olha o quanto você usou durante o teste (conversas, atendentes, mensagens de IA) e sugere o plano que melhor cobre esse uso, sempre no ciclo anual, que sai 20% mais barato.',
    paraQueServe:
      'Serve para tirar a dúvida de "qual plano eu escolho": em vez de comparar os quatro cards sozinho, você já vê um sugerido com o motivo da escolha e pode assinar em um clique.',
    comoImplementar: [
      'Leia as razões listadas no card: elas explicam por que aquele plano foi sugerido para o seu uso.',
      'Se algum add-on aparecer sugerido ao lado, marque a caixinha se fizer sentido para sua operação.',
      'Clique no botão "Assinar [plano] anual" para ir direto ao checkout com o plano e os add-ons marcados.',
      'Se preferir outro plano ou o ciclo mensal, ignore o bloco recomendado e escolha na grade de planos logo abaixo.',
    ],
    exemploResultado:
      'Numa clínica odontológica que usou bastante o WhatsApp durante o teste do Lite, o bloco recomenda o Growth anual a R$ 397,60/mês, mostrando que ela já passou do limite de atendentes do Lite. O dono confirma e assina em um clique, sem precisar comparar os planos manualmente.',
    relacionados: ['billing.comparativo-planos', 'billing.addons-hero'],
  },
  {
    featureKey: 'billing.outcome-beta',
    titulo: 'Beta: Conversa Convertida',
    clientSafe: true,
    oQueE:
      'É um modelo de cobrança em teste, disponível só para contas convidadas para o beta, onde parte da sua fatura é calculada pelo resultado que a Iza traz, e não só pelo plano fixo. Você paga R$ 19,90 por cada lead qualificado que a Iza identifica (uma conversa com uma pontuação de interesse acima de 60, calculada automaticamente) e R$ 89 por cada oportunidade que a Iza cria no seu funil de vendas (CRM).',
    paraQueServe:
      'Serve para pagar mais quando a Iza está de fato gerando resultado, e menos nos meses mais fracos. Nos primeiros 60 dias do beta existe um teto de R$ 1.997 por mês, então a cobrança variável nunca passa desse valor enquanto o modelo está sendo calibrado.',
    comoImplementar: [
      'Acompanhe os leads qualificados e as oportunidades criadas pela Iza na tela de CRM.',
      'No fim do ciclo, confira sua fatura no Portal de faturas para ver o detalhamento do que foi cobrado.',
      'Se algo parecer errado (lead ou oportunidade que não deveria ter contado), fale com o suporte da ZappIQ antes do fechamento da fatura.',
    ],
    exemploResultado:
      'Numa clínica no beta, a Iza gerou 40 leads qualificados e ajudou a criar 3 oportunidades no CRM em um mês. A conta fica: 40 x R$ 19,90 (leads) + 3 x R$ 89 (oportunidades) = R$ 1.063, dentro do teto de R$ 1.997 daquele mês.',
    relacionados: ['billing.pagina'],
  },
  {
    featureKey: 'billing.portal-faturas',
    titulo: 'Portal de faturas',
    clientSafe: true,
    oQueE:
      'É o botão que abre o Portal de Cobrança da Stripe, a empresa que processa os pagamentos da ZappIQ. É um site oficial e seguro, fora do Dashboard da ZappIQ, mas conectado diretamente à sua assinatura.',
    paraQueServe:
      'Serve para resolver tudo relacionado a pagamento sem precisar pedir ajuda ao suporte: trocar o cartão cadastrado, baixar as notas fiscais e faturas anteriores, ver o histórico de cobranças e cancelar a assinatura, se precisar.',
    comoImplementar: [
      'Clique em "Portal de faturas" no topo da página de Plano e Fatura.',
      'Você será redirecionado para o site da Stripe, já logado na sua assinatura.',
      'Faça a alteração que precisa (cartão, fatura, cancelamento) e volte ao Dashboard pelo link no rodapé da página.',
    ],
    exemploResultado:
      'O dono de uma loja precisa da nota fiscal do mês passado para o contador. Ele clica em "Portal de faturas", encontra a fatura na lista, baixa o PDF e volta para o Dashboard em menos de um minuto.',
    relacionados: ['billing.pagamento-pendente'],
  },
  {
    featureKey: 'billing.addons-catalogo',
    titulo: 'Add-ons (serviços extras)',
    clientSafe: true,
    oQueE:
      'São serviços adicionais que você compra separadamente, além do plano, quando precisa de mais capacidade em um ponto específico sem trocar de plano inteiro. Cada add-on cobre uma necessidade: mais minutos de voz, mais mensagens de IA, mais disparos em massa, mais um atendente, mais um número de WhatsApp ou a configuração assistida da integração com o Meta.',
    paraQueServe:
      'Serve para resolver um gargalo pontual sem pagar por um upgrade de plano completo. Por exemplo, se você só precisa de mais um atendente humano mas o resto do seu uso cabe tranquilo no plano atual, o add-on de atendente extra resolve isso por R$ 89/mês em vez de subir de plano.',
    comoImplementar: [
      'Veja a lista completa na seção "Add-ons" da página, com nome, o que inclui e o preço.',
      'Se estiver assinando um plano agora pela recomendação, marque o add-on direto no checkbox do bloco recomendado.',
      'Se já é assinante e quer adicionar depois, fale com o suporte da ZappIQ pelo WhatsApp ou e-mail para incluir o add-on na sua assinatura atual.',
    ],
    exemploResultado:
      'Uma clínica no plano Growth está no limite de 2 números de WhatsApp mas quer atender uma unidade nova sem trocar de plano. Ela contrata o add-on "Número WA adicional" por R$ 147/mês e ganha uma fila própria para a unidade nova.',
    relacionados: ['billing.addon-integracao-meta', 'billing.addons-hero'],
  },
  {
    featureKey: 'billing.addon-integracao-meta',
    titulo: 'Integração Meta gerenciada',
    clientSafe: true,
    oQueE:
      '"Embedded Signup" é o nome técnico do processo de conectar seu WhatsApp Business ou Instagram à ZappIQ direto pelo site da Meta (dona do WhatsApp e Instagram), sem precisar copiar códigos técnicos manualmente. Esse add-on é a equipe da ZappIQ fazendo essa configuração toda por você.',
    paraQueServe:
      'Serve para quem tentou conectar o canal sozinho e travou nos campos técnicos (Phone Number ID, WABA ID, Access Token) ou simplesmente prefere não mexer nisso. Você paga uma vez e a equipe cuida da parte técnica da conexão.',
    comoImplementar: [
      'Contrate o add-on "Integração Meta gerenciada" na seção Add-ons da página.',
      'Após a contratação, a equipe ZappIQ entra em contato para pedir os acessos necessários da sua conta Meta Business.',
      'A equipe faz a conexão e avisa quando o canal estiver ativo e testado.',
    ],
    exemploResultado:
      'Um restaurante tentou conectar o WhatsApp Business sozinho em Configurações mas travou pedindo o "WABA ID", termo que ninguém da equipe reconhecia. Ele contrata a Integração Meta gerenciada por R$ 297 (pagamento único) e a ZappIQ termina a conexão em dois dias.',
    relacionados: ['billing.addons-catalogo'],
  },
  {
    featureKey: 'billing.addons-hero',
    titulo: 'Adicionar add-ons ao assinar',
    clientSafe: true,
    oQueE:
      'São as caixinhas de marcar que aparecem junto do plano recomendado, permitindo incluir um ou mais add-ons recorrentes na mesma assinatura, sem precisar contratar cada um depois separadamente.',
    paraQueServe:
      'Serve para fechar tudo de uma vez: plano mais os extras que sua operação precisa, numa única cobrança mensal ou anual. Cada add-on marcado é cobrado todo mês junto com o plano, então vale marcar só o que você realmente vai usar.',
    comoImplementar: [
      'Leia o nome e o preço de cada add-on na lista antes de marcar.',
      'Marque só as caixinhas dos add-ons que sua operação precisa agora.',
      'Confira o resumo no botão de assinar, que mostra quantos add-ons foram incluídos.',
      'Clique em "Assinar" para ir ao checkout com o plano e os add-ons marcados na mesma cobrança.',
    ],
    exemploResultado:
      'Um salão de beleza vai assinar o Growth pela recomendação e marca a caixinha "Mensagens IA extras" porque sabe que estourou esse limite no teste. A cobrança mensal já sai com o plano Growth mais o pacote de mensagens extras, tudo numa fatura só.',
    relacionados: ['billing.recomendacao-plano', 'billing.addons-catalogo'],
  },
  {
    featureKey: 'billing.uso-do-plano',
    titulo: 'Uso do plano atual',
    clientSafe: true,
    oQueE:
      'É o painel com quatro barras mostrando o quanto você já usou neste mês contra o limite do seu plano: Conversas (quantas conversas novas foram abertas no mês), Atendentes (quantas pessoas da sua equipe têm login no sistema), Documentos na base (quanto material você treinou na Iza) e Mensagens de IA (quantas respostas automáticas a Iza já gerou no mês).',
    paraQueServe:
      'Serve para você antecipar quando vai estourar um limite, em vez de descobrir isso só quando a Iza parar de responder ou um upload for recusado. Se uma barra estiver próxima de 100%, é hora de considerar um upgrade de plano ou um add-on específico daquele item.',
    comoImplementar: [
      'Role até a seção "Uso do plano atual", perto do fim da página.',
      'Veja o número exato ao lado de cada barra: uso atual dividido pelo limite do plano.',
      'Se alguma barra estiver quase cheia, veja no comparativo de planos qual o próximo nível resolve esse limite, ou procure o add-on correspondente na seção de Add-ons.',
    ],
    exemploResultado:
      'Numa loja de roupas no plano Lite, a barra de "Mensagens de IA" mostra 1.420 de 1.500, ou seja, 95% do limite usado faltando ainda uma semana pro fim do mês. O dono decide fazer upgrade pro Growth antes que a Iza pare de responder automaticamente.',
    relacionados: ['billing.comparativo-planos', 'billing.pagina'],
  },
];
