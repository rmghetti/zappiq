import type { SaibaMaisContent } from './types';

/**
 * Conteúdo do Saiba mais da área Auditoria (Trilha de Auditoria /audit-logs
 * e Requisições do Titular / DSR /dsr).
 */
export const auditoriaContent: SaibaMaisContent[] = [
  {
    featureKey: 'audit-logs.pagina',
    titulo: 'Trilha de Auditoria',
    clientSafe: true,
    oQueE:
      'A Trilha de Auditoria é um registro automático de tudo que acontece com os dados dos seus clientes dentro da ZappIQ: quem acessou, alterou ou apagou uma informação, e quando isso aconteceu. Cada evento fica gravado numa lista que ninguém consegue editar depois, nem você.',
    paraQueServe:
      'Serve para provar, se a ANPD (o órgão que fiscaliza proteção de dados no Brasil) ou um cliente perguntar, que sua empresa trata os dados pessoais com cuidado e consegue mostrar exatamente o que foi feito com eles. É a sua defesa documentada em caso de dúvida ou reclamação.',
    comoImplementar: [
      'Abra o menu Auditoria e entre em Trilha de Auditoria.',
      'Use os filtros de Ação e Recurso para achar um evento específico, como uma exclusão de contato.',
      'Clique numa linha da tabela para ver o detalhe completo do evento.',
      'Se precisar comprovar que nada foi alterado, clique em Verificar Integridade.',
    ],
    exemploResultado:
      'Numa clínica que recebeu reclamação de um paciente dizendo que os dados dele sumiram sem aviso, o dono abre a Trilha de Auditoria, filtra por "contact.delete" e encontra o registro exato: quem apagou, quando e por qual motivo. Isso resolve a reclamação em minutos, com prova documentada.',
    relacionados: ['audit-logs.verificar-integridade', 'audit-logs.base-legal', 'dsr.pagina'],
  },
  {
    featureKey: 'audit-logs.verificar-integridade',
    titulo: 'Verificar Integridade',
    clientSafe: true,
    oQueE:
      'Esse botão confere se a lista de registros de auditoria está completa e não foi alterada por ninguém, nem por acidente nem de propósito. Cada registro guarda um código único (chamado hash) que depende do registro anterior, formando uma corrente. Se um único registro fosse mudado, a corrente quebraria e o sistema percebe.',
    paraQueServe:
      'Serve para você confirmar, antes de uma fiscalização ou de responder a um cliente, que o histórico de dados da sua empresa é confiável e não foi adulterado. É como pedir para o sistema se examinar sozinho.',
    comoImplementar: [
      'Na página Trilha de Auditoria, clique em Verificar Integridade.',
      'Aguarde alguns segundos enquanto o sistema confere todos os registros.',
      'Leia o resultado: cadeia íntegra significa que está tudo certo.',
      'Se aparecer um alerta de cadeia violada, siga a orientação da tela e avise o responsável pela proteção de dados da empresa (o DPO).',
    ],
    exemploResultado:
      'Antes de uma auditoria externa marcada pela ANPD, o dono de uma academia clica em Verificar Integridade e recebe a confirmação de que 12.400 registros estão íntegros. Ele mostra essa tela ao fiscal como prova de que os dados não foram manipulados.',
    relacionados: ['audit-logs.resultado-verificacao', 'audit-logs.pagina'],
  },
  {
    featureKey: 'audit-logs.resultado-verificacao',
    titulo: 'Resultado da verificação',
    clientSafe: true,
    oQueE:
      'É o card que aparece depois de clicar em Verificar Integridade. Ele mostra se a corrente de registros está intacta (cadeia íntegra) ou se algum registro foi alterado (cadeia violada).',
    paraQueServe:
      'Serve para você saber, sem entender de tecnologia, se pode confiar no histórico de dados da empresa. Se a cadeia estiver violada, é um sinal grave de que algo fora do normal aconteceu no sistema e precisa de atenção imediata.',
    comoImplementar: [
      'Clique em Verificar Integridade para gerar o resultado.',
      'Se o card aparecer verde, com "cadeia íntegra", está tudo certo e não precisa fazer nada.',
      'Se o card aparecer vermelho, com "cadeia violada", avise o DPO da empresa (a pessoa responsável por proteção de dados, pode ser você mesmo em empresas pequenas) e trate como um incidente de segurança.',
      'Guarde um print da tela como registro de quando a verificação foi feita.',
    ],
    exemploResultado:
      'Numa loja online, o dono roda a verificação uma vez por mês. Em um mês o resultado mostra "cadeia íntegra, 8.200 registros verificados" e ele segue tranquilo. Isso vira parte da rotina de conformidade da empresa.',
    relacionados: ['audit-logs.verificar-integridade', 'audit-logs.pagina'],
  },
  {
    featureKey: 'audit-logs.base-legal',
    titulo: 'Base legal',
    clientSafe: true,
    oQueE:
      'Base legal é o motivo, previsto na LGPD (a lei brasileira de proteção de dados), que autoriza sua empresa a usar o dado pessoal daquele cliente. Cada registro da auditoria mostra qual foi essa justificativa: por exemplo, "Contrato" quando o dado foi usado para cumprir uma venda, ou "Consentimento" quando o cliente autorizou o uso.',
    paraQueServe:
      'Serve para comprovar que cada uso de dado teve um motivo legítimo, e não foi feito de forma arbitrária. Ajuda você a responder com segurança se um cliente perguntar por que sua empresa tem o telefone ou o e-mail dele.',
    comoImplementar: [
      'Na tabela da Trilha de Auditoria, veja a coluna Base legal em cada linha.',
      'Clique num registro para abrir o detalhe e ver a base legal completa, junto com a finalidade do uso.',
      'Se um registro aparecer sem base legal preenchida, vale revisar com atenção o que gerou aquele evento.',
    ],
    exemploResultado:
      'Um cliente de uma clínica pergunta por que recebeu uma mensagem de cobrança. O dono consulta a Trilha de Auditoria, encontra o evento e vê que a base legal foi "Contrato", porque o envio está ligado ao atendimento contratado. Ele responde ao cliente com segurança.',
    relacionados: ['audit-logs.pagina', 'audit-logs.detalhe-evento'],
  },
  {
    featureKey: 'audit-logs.detalhe-evento',
    titulo: 'Detalhe do evento',
    clientSafe: true,
    oQueE:
      'É a tela que abre quando você clica num registro da Trilha de Auditoria. Além das informações do evento (quem, quando, o quê), ela mostra dois códigos técnicos: o Hash e o Hash anterior. Pense neles como um lacre de segurança: cada registro carrega o lacre do registro de antes, então se alguém tentasse mudar um evento antigo, todos os lacres seguintes deixariam de bater.',
    paraQueServe:
      'Serve como prova técnica de que aquele evento específico não foi alterado depois de criado. Você não precisa entender o código em si, só saber que ele existe para garantir a confiança do registro.',
    comoImplementar: [
      'Clique em qualquer linha da tabela de auditoria para abrir o detalhe.',
      'Veja as informações principais no topo: quando aconteceu, quem fez, qual recurso foi afetado.',
      'Role até o final para ver o Hash e o Hash anterior, os códigos de segurança do registro.',
      'Não é preciso copiar ou usar esses códigos no dia a dia; eles servem para a verificação automática de integridade.',
    ],
    exemploResultado:
      'Durante uma auditoria externa, o fiscal pede para ver o detalhe de um evento específico. O dono abre o registro, mostra o hash e explica que aquele código garante que o evento não foi editado depois de acontecer. A fiscalização segue sem ressalvas.',
    relacionados: ['audit-logs.verificar-integridade', 'audit-logs.base-legal'],
  },
  {
    featureKey: 'dsr.pagina',
    titulo: 'Requisições do Titular',
    clientSafe: true,
    oQueE:
      'Essa página reúne os pedidos que seus clientes (chamados de "titulares dos dados" pela LGPD) fazem sobre as próprias informações: ver os dados que você tem sobre eles, corrigir algo errado, pedir uma cópia ou pedir para apagar tudo. DSR é a sigla em inglês para esse tipo de pedido.',
    paraQueServe:
      'Serve para você atender, de forma organizada e dentro do prazo, um direito garantido por lei ao seu cliente. A LGPD dá 15 dias para responder. Deixar passar o prazo pode gerar multa da ANPD, o órgão fiscalizador.',
    comoImplementar: [
      'Abra o menu Auditoria e entre em Requisições do Titular.',
      'Veja a lista de pedidos, com o tipo, o status e quantos dias faltam para o prazo.',
      'Clique em Iniciar para começar a tratar um pedido pendente.',
      'Siga a ação certa para o tipo de pedido: exportar dados, eliminar dados ou apenas concluir.',
      'Fique de olho na coluna Prazo: se o número ficar vermelho, o pedido está vencido e precisa de atenção urgente.',
    ],
    exemploResultado:
      'Um cliente de uma loja de roupas manda mensagem pedindo para apagar seus dados. A recepção registra o pedido como Eliminação. O dono entra em Requisições do Titular, vê o pedido pendente com 12 dias restantes, clica em Iniciar e depois em Eliminar. Em poucos minutos o pedido é atendido dentro do prazo, sem risco de multa.',
    relacionados: ['dsr.fluxo-atendimento', 'dsr.prazo', 'dsr.tipo-solicitacao'],
  },
  {
    featureKey: 'dsr.tipo-solicitacao',
    titulo: 'Tipo de solicitação',
    clientSafe: true,
    oQueE:
      'É a coluna que mostra que tipo de pedido o cliente fez sobre os próprios dados. Os principais tipos são: Acesso (ver os dados), Correção (arrumar uma informação errada), Portabilidade (levar os dados para outro lugar), Eliminação (apagar tudo), Anonimização (remover a identificação mas manter o histórico) e Revogação de consentimento (cancelar uma autorização dada antes).',
    paraQueServe:
      'Serve para você saber, antes de agir, qual é exatamente a ação esperada, já que cada tipo pede um tratamento diferente. Eliminação e Anonimização apagam dados de verdade; Acesso e Portabilidade só entregam uma cópia.',
    comoImplementar: [
      'Veja a coluna Tipo na tabela de Requisições do Titular.',
      'Antes de clicar em qualquer botão de ação, confirme o tipo: um pedido de Acesso pede para exportar, um pedido de Eliminação pede para apagar.',
      'Em caso de dúvida entre Eliminação e Anonimização, lembre que a Eliminação remove a conversa e a Anonimização troca nome, telefone e e-mail por dado genérico.',
    ],
    exemploResultado:
      'Uma barbearia recebe dois pedidos no mesmo dia: um de Acesso e outro de Eliminação. O dono confere o tipo antes de agir e, no primeiro caso, exporta os dados em PDF para o cliente; no segundo, elimina o cadastro. Cada pedido é tratado do jeito certo, sem confundir um com o outro.',
    relacionados: ['dsr.pagina', 'dsr.fluxo-atendimento'],
  },
  {
    featureKey: 'dsr.status-badge',
    titulo: 'Status da requisição',
    clientSafe: true,
    oQueE:
      'É a etiqueta colorida que mostra em que etapa está cada pedido: Pendente (chegou e ainda não foi tratado), Em andamento (você já começou a tratar), Concluída (finalizada), Rejeitada (recusada, com motivo registrado) ou Vencida (passou do prazo de 15 dias sem resposta).',
    paraQueServe:
      'Serve para você bater o olho na lista e saber rapidamente quais pedidos precisam de ação agora, sem abrir um por um.',
    comoImplementar: [
      'Veja a etiqueta colorida na coluna Status de cada linha.',
      'Etiquetas amarelas (Pendente) e azuis (Em andamento) precisam da sua ação.',
      'Etiquetas vermelhas (Vencida) são urgentes: o prazo legal já passou.',
      'Etiquetas verdes (Concluída) e cinzas (Rejeitada) já foram resolvidas e não precisam de mais nada.',
    ],
    exemploResultado:
      'Um dono de clínica abre a tela pela manhã e vê de longe duas etiquetas vermelhas de Vencida. Ele prioriza esses dois pedidos antes de qualquer outra tarefa do dia, porque são os que já passaram do prazo legal.',
    relacionados: ['dsr.prazo', 'dsr.filtro-status'],
  },
  {
    featureKey: 'dsr.prazo',
    titulo: 'Prazo',
    clientSafe: true,
    oQueE:
      'É a coluna que conta quantos dias faltam para vencer o prazo legal de resposta ao pedido do cliente. A LGPD dá 15 dias corridos a partir da data do pedido. Quando o número fica negativo, o pedido está vencido.',
    paraQueServe:
      'Serve como alerta para você não perder o prazo. Deixar um pedido vencer é descumprimento da lei e pode gerar sanção da ANPD, o órgão que fiscaliza proteção de dados no Brasil, além de manchar a confiança do cliente na sua empresa.',
    comoImplementar: [
      'Veja o número de dias na coluna Prazo de cada linha da tabela.',
      'Números em amarelo (3 dias ou menos) merecem atenção nos próximos dias.',
      'Números em vermelho, com a palavra Vencido, precisam ser tratados imediatamente.',
      'Priorize sempre os pedidos com prazo mais curto antes dos que acabaram de chegar.',
    ],
    exemploResultado:
      'Numa academia com vários pedidos abertos, o dono olha a coluna Prazo e trata primeiro o pedido com "Vencido há 2d", depois o que mostra "1d", deixando os que têm "12d" para depois. Isso evita que algum pedido ultrapasse o limite legal sem necessidade.',
    relacionados: ['dsr.status-badge', 'dsr.pagina'],
  },
  {
    featureKey: 'dsr.filtro-status',
    titulo: 'Filtro de status',
    clientSafe: true,
    oQueE:
      'São os botões no topo da lista que permitem mostrar só os pedidos de um status específico, como só os Pendentes ou só os Vencidos, em vez de ver todos juntos.',
    paraQueServe:
      'Serve para você focar no que importa: por exemplo, filtrar só os pedidos Vencidos para tratar as urgências primeiro, sem precisar rolar a lista inteira procurando.',
    comoImplementar: [
      'No topo da página Requisições do Titular, clique no botão do status que quer ver, como Pendente ou Vencida.',
      'Clique em Todas para voltar a ver a lista completa.',
      'Combine o filtro com a coluna Prazo para organizar sua fila de trabalho do dia.',
    ],
    exemploResultado:
      'Toda segunda de manhã, o dono de uma loja filtra por Pendente para ver o que se acumulou no fim de semana, trata os mais urgentes e só depois olha os que já estão Em andamento.',
    relacionados: ['dsr.status-badge', 'dsr.pagina'],
  },
  {
    featureKey: 'dsr.concluir-exportacao',
    titulo: 'Concluir + avisar',
    clientSafe: true,
    oQueE:
      'É o botão usado para fechar um pedido de Acesso ou Portabilidade depois que você já baixou e conferiu os dados do cliente. Ao clicar, o sistema marca o pedido como concluído e manda um e-mail automático avisando o titular que a solicitação foi atendida.',
    paraQueServe:
      'Serve para formalizar o fim do atendimento e cumprir a obrigação de avisar o cliente, sem você precisar escrever esse e-mail na mão.',
    comoImplementar: [
      'Antes de clicar aqui, baixe os dados em JSON ou CSV usando os botões de exportação da mesma linha.',
      'Abra o arquivo baixado e confira se as informações fazem sentido.',
      'Só depois de conferir, clique em Concluir + avisar.',
      'O sistema muda o status para Concluída e envia o e-mail de aviso automaticamente para o titular.',
    ],
    exemploResultado:
      'Um cliente pede para ver todos os dados que uma loja tem sobre ele. O atendente baixa o CSV, confere que os dados batem com o cadastro e só então clica em Concluir + avisar. O cliente recebe um e-mail confirmando que o pedido foi atendido, sem que ninguém precise escrever a mensagem manualmente.',
    relacionados: ['dsr.tipo-solicitacao', 'dsr.pagina'],
  },
  {
    featureKey: 'dsr.fluxo-atendimento',
    titulo: 'Fluxo de atendimento de uma requisição',
    clientSafe: true,
    oQueE:
      'É a sequência de passos para tratar um pedido do cliente, do começo ao fim. A ordem certa dos botões muda de acordo com o tipo de pedido: um pedido de Acesso segue Iniciar, depois Exportar, depois Concluir + avisar; já um pedido de Eliminação segue Iniciar e depois Eliminar direto, sem passar por exportação.',
    paraQueServe:
      'Serve para você não se perder na hora de atender um pedido: cada tipo tem seu próprio caminho, e seguir a ordem errada pode gerar problema, como concluir um pedido de acesso sem ter exportado os dados antes.',
    comoImplementar: [
      'Veja o Tipo do pedido na tabela antes de agir.',
      'Clique em Iniciar para mudar o status de Pendente para Em andamento.',
      'Se o tipo for Acesso ou Portabilidade, exporte os dados em JSON ou CSV, confira o arquivo e só então clique em Concluir + avisar.',
      'Se o tipo for Eliminação ou Anonimização, clique direto em Eliminar; essa ação já anonimiza o contato e marca o pedido como concluído.',
      'Para os demais tipos, use Concluir depois de resolver o pedido manualmente, por exemplo uma Correção feita direto no cadastro.',
      'Se não for possível atender o pedido, clique em Rejeitar e escreva o motivo; o sistema pede essa justificativa antes de confirmar.',
    ],
    exemploResultado:
      'Uma clínica recebe um pedido de Eliminação. O atendente clica em Iniciar e, como é Eliminação, vai direto no botão Eliminar, confirma a ação no aviso que aparece e o pedido já fica Concluído automaticamente, com os dados anonimizados. No mesmo dia chega um pedido de Acesso: dessa vez o atendente inicia, exporta o JSON, confere os dados e só depois clica em Concluir + avisar. Dois caminhos diferentes, cada um seguido do jeito certo.',
    relacionados: ['dsr.tipo-solicitacao', 'dsr.concluir-exportacao', 'dsr.pagina'],
  },
];
