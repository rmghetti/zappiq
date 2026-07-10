import type { SaibaMaisContent } from './types';

/**
 * Conteúdo do Saiba mais da área Contatos (/contacts).
 */
export const contactsContent: SaibaMaisContent[] = [
  {
    featureKey: 'contacts.overview',
    titulo: 'Contatos',
    clientSafe: true,
    oQueE:
      'Contatos é a lista de todas as pessoas que já falaram com você pelo WhatsApp, Instagram ou chat do site. Você não precisa cadastrar ninguém aqui: assim que alguém manda a primeira mensagem, a ZappIQ cria o contato sozinha.',
    paraQueServe:
      'Serve para você ver, num lugar só, quem são os seus leads e clientes, em que fase da venda cada um está e o quanto a IA acredita que aquele contato está perto de comprar. É a base que alimenta o funil de vendas (CRM) e as campanhas de WhatsApp.',
    comoImplementar: [
      'Abra o menu Contatos no menu lateral.',
      'Use a busca para achar alguém por nome, telefone ou e-mail.',
      'Use o filtro de Status para ver só quem está numa fase específica do funil.',
      'Clique em qualquer linha da tabela para ver os detalhes completos e editar.',
    ],
    exemploResultado:
      'Numa clínica que recebe 60 mensagens novas por mês no WhatsApp, todos os 60 números viram contato automaticamente aqui, sem ninguém digitar nada. Em duas semanas a dona da clínica já enxerga na tabela quais desses 60 a IA marcou como "Qualificado" e liga primeiro para esses.',
    relacionados: ['contacts.lead-status', 'contacts.lead-score', 'crm.pipeline'],
  },
  {
    featureKey: 'contacts.lead-score',
    titulo: 'Score do contato',
    clientSafe: true,
    oQueE:
      'O Score é uma nota de 0 a 100 que a IA dá para cada contato, mostrando o quanto ele demonstrou interesse real de comprar durante a conversa. Quanto mais alto, mais quente é o lead.',
    paraQueServe:
      'Serve para você priorizar quem atender primeiro quando tem muito contato na base. Em vez de ligar em ordem aleatória, você olha o score e fala primeiro com quem está mais perto de fechar negócio.',
    comoImplementar: [
      'Olhe a coluna Score na tabela de Contatos: a barrinha verde cheia junto com o número mostra a nota.',
      'Ordene mentalmente pelos scores mais altos quando for decidir quem ligar ou mandar mensagem primeiro.',
      'Clique no contato para ver a conversa que gerou aquele score e entender o motivo.',
    ],
    exemploResultado:
      'Um contato que só mandou "oi, vocês fazem entrega?" fica com score baixo, tipo 6. Já um contato que perguntou preço, disse que quer fechar ainda essa semana e pediu para falar com um vendedor sobe rápido para 45 ou mais. Numa loja com 200 contatos na base, olhar primeiro os scores acima de 40 evita perder venda por demora no atendimento.',
    relacionados: ['contacts.lead-status', 'contacts.overview'],
  },
  {
    featureKey: 'contacts.lead-status',
    titulo: 'Status do lead',
    clientSafe: true,
    oQueE:
      'É a fase em que o contato está dentro do funil de vendas: Novo, Contactado, Qualificado, Não qualificado ou Convertido. A IA move o status sozinha conforme a conversa avança, mas você também pode mudar na mão a qualquer momento.',
    paraQueServe:
      'Serve para saber de relance, sem ler a conversa inteira, se aquele contato já foi atendido, se já demonstrou interesse de compra ou se já virou cliente. Isso organiza o trabalho de vendas do dia a dia.',
    comoImplementar: [
      'Use o filtro de Status no topo da tabela de Contatos para ver só uma fase por vez.',
      'Clique num contato para abrir a ficha e trocar o status manualmente pelo campo Status do lead.',
      'Combine o filtro de status com a busca por nome para achar um lead específico dentro de uma fase.',
    ],
    exemploResultado:
      'Um contato entra como Novo assim que manda a primeira mensagem. Se ele responde de novo, vira Contactado automaticamente. Se demonstra intenção clara de compra ("quero fechar", "qual o valor final?"), a IA move para Qualificado. Numa academia com 80 leads do mês, filtrar por Qualificado mostra rapidinho quem já está pronto para receber uma ligação de fechamento.',
    relacionados: ['contacts.lead-score', 'crm.pipeline'],
  },
  {
    featureKey: 'contacts.row-click-edit',
    titulo: 'Editar um contato',
    clientSafe: true,
    oQueE:
      'Cada linha da tabela de Contatos é clicável. Ao clicar em qualquer parte da linha, abre uma janela com todos os dados daquele contato, prontos para editar.',
    paraQueServe:
      'Serve para você corrigir ou completar informações de um contato, como nome, e-mail, empresa, status do lead e tags, sem precisar de nenhum botão extra na tela.',
    comoImplementar: [
      'Clique em qualquer ponto da linha do contato na tabela (não precisa acertar um ícone específico).',
      'Na janela que abre, altere os campos que quiser e clique em Salvar alterações.',
      'Se quiser remover o contato da base, use o botão Excluir dentro da mesma janela.',
    ],
    exemploResultado:
      'A dona de um salão de beleza percebe que um contato ficou sem nome, só com o telefone. Ela clica na linha, digita o nome da cliente no campo Nome e salva. Na próxima campanha de WhatsApp, a mensagem já sai personalizada com o nome certo.',
    relacionados: ['contacts.overview'],
  },
  {
    featureKey: 'contacts.empty-state',
    titulo: 'Nenhum contato encontrado',
    clientSafe: true,
    oQueE:
      'Essa mensagem aparece quando a busca ou o filtro que você aplicou não encontrou nenhum contato, ou quando a sua base ainda está totalmente vazia porque nenhuma conversa aconteceu ainda.',
    paraQueServe:
      'Serve para você saber se o problema é o filtro (basta ajustar) ou se é porque o WhatsApp da sua empresa ainda não está conectado e recebendo mensagens.',
    comoImplementar: [
      'Se você aplicou busca ou filtro de status, limpe os dois e veja se os contatos aparecem.',
      'Se a base está mesmo vazia, vá em Configurações e conecte o seu número de WhatsApp: assim que o primeiro cliente mandar mensagem, o contato aparece aqui sozinho.',
      'Se preferir, clique em Novo Contato para cadastrar alguém manualmente enquanto isso.',
    ],
    exemploResultado:
      'Um dono de pet shop acabou de assinar a ZappIQ e ainda não ligou o WhatsApp. Ele entra em Contatos e vê "Nenhum contato encontrado", sem entender o motivo. Ao ler o Saiba mais, ele vai em Configurações, conecta o número, e no dia seguinte já tem 14 contatos criados sozinhos pelas mensagens que os clientes mandaram.',
    relacionados: ['contacts.overview'],
  },
  {
    featureKey: 'contacts.export',
    titulo: 'Exportar contatos',
    clientSafe: true,
    oQueE:
      'O botão Exportar baixa um arquivo CSV (uma planilha simples) com todos os contatos da sua base: nome, telefone, e-mail, empresa, status, tags, score e data de criação.',
    paraQueServe:
      'Serve para você ter uma cópia de segurança dos seus contatos, abrir a lista no Excel ou Google Planilhas, ou levar esses dados para outra ferramenta de vendas ou de e-mail marketing.',
    comoImplementar: [
      'Clique no botão Exportar no topo da página de Contatos.',
      'Aguarde o download do arquivo contacts.csv (leva poucos segundos).',
      'Abra o arquivo no Excel, Google Planilhas ou qualquer programa de planilha.',
    ],
    exemploResultado:
      'Uma imobiliária com 500 contatos exporta a planilha toda vez que fecha o mês, para guardar um histórico fora da ZappIQ e comparar o crescimento da base de leads mês a mês.',
    relacionados: ['contacts.overview', 'contacts.tags'],
  },
  {
    featureKey: 'contacts.tags',
    titulo: 'Tags do contato',
    clientSafe: true,
    oQueE:
      'Tags são etiquetas curtas que você coloca num contato para marcar alguma característica dele, como "vip", "recorrente" ou "indicado". Hoje elas são criadas manualmente, ao editar o contato.',
    paraQueServe:
      'Serve para separar seus contatos em grupos que fazem sentido para o seu negócio, facilitando encontrar um perfil específico depois ou organizar uma lista para uma ação futura, como uma campanha de WhatsApp.',
    comoImplementar: [
      'Clique num contato para abrir a ficha de edição.',
      'No campo Tags, digite uma ou mais etiquetas separadas por vírgula, por exemplo: vip, recorrente.',
      'Salve as alterações. As tags aparecem como pequenas etiquetas na coluna Tags da tabela.',
    ],
    exemploResultado:
      'Uma barbearia marca com a tag "assinante" todo cliente do plano mensal. Com o tempo, ela consegue olhar rápido na tabela quantos contatos têm essa tag e pensar numa ação só para esse grupo.',
    relacionados: ['contacts.export', 'contacts.overview'],
  },
];
