import type { SaibaMaisContent } from './types';

/**
 * Conteúdo do Saiba mais da área Flows (Maestro / editor de fluxos).
 */
export const flowsContent: SaibaMaisContent[] = [
  {
    featureKey: 'flows.mapa-operacao.visao',
    titulo: 'Mapa da Operação',
    clientSafe: true,
    oQueE:
      'O Mapa da Operação mostra todos os fluxos que você já criou, um do lado do outro, com linhas ligando um fluxo ao outro. Cada seta é uma conexão que você desenha (ou que o Maestro sugere ao criar os fluxos), representando pra onde o atendimento deveria seguir depois daquele fluxo.',
    paraQueServe:
      'Serve para você planejar e visualizar a jornada completa do cliente de uma vez só, sem abrir fluxo por fluxo. Por exemplo: você desenha que o cliente entra pelo fluxo de Atendimento, segue pro fluxo de Vendas, e se fechar negócio vai pro fluxo de Agendamento. O mapa mostra esse desenho inteiro numa tela. Importante: hoje o mapa é um documento editável, não um roteador automático. Para o cliente realmente pular de um fluxo pro outro durante a conversa, use o nó "Enviar para outro fluxo" dentro do fluxo de origem.',
    comoImplementar: [
      'Na página inicial do Maestro, o Mapa da Operação já aparece logo abaixo do card MAESTRO INTELIGENTE.',
      'Clique em qualquer fluxo do mapa para abrir e editar aquele trecho da conversa.',
      'Clique numa seta entre dois fluxos para ver ou editar o rótulo da conexão (ex: "objeção de preço"), ou arraste pra desenhar uma conexão nova.',
      'Use o botão "Tela cheia" se quiser ver o mapa maior, com todos os fluxos e conexões em detalhe.',
    ],
    exemploResultado:
      'Numa clínica com 3 fluxos (Atendimento, Agendamento e Pós-consulta), o dono olha o Mapa da Operação e percebe visualmente que não existe nenhuma seta ligando Agendamento a Pós-consulta. Ele desenha a conexão direto no mapa e, dentro do fluxo de Agendamento, adiciona um nó "Enviar para outro fluxo" apontando pro Pós-consulta, garantindo que o cliente realmente seja encaminhado ao final da consulta.',
    relacionados: ['flows.mapa-operacao.arquitetar'],
  },
  {
    featureKey: 'flows.mapa-operacao.arquitetar',
    titulo: 'Maestro, arquitete minha operação',
    clientSafe: true,
    oQueE:
      'É um botão que pede pro Maestro (a IA que monta fluxos) criar sozinho todos os fluxos da sua operação de uma vez, do primeiro contato até o pós-venda, já interligados entre si.',
    paraQueServe:
      'Serve para você não precisar montar cada fluxo na mão. Em vez de criar Atendimento, depois Vendas, depois Agendamento um por um, você clica uma vez e o Maestro entrega tudo pronto, usando o que você já preencheu no treinamento da IA (seu negócio, serviços, perguntas frequentes).',
    comoImplementar: [
      'Na página inicial do Maestro, se você ainda não tem nenhum fluxo, vai aparecer o botão "Maestro, arquitete minha operação".',
      'Clique e aguarde. O Maestro lê o que você configurou no treinamento da IA e monta os fluxos automaticamente.',
      'Quando terminar, os fluxos aparecem no Mapa da Operação já conectados. Abra cada um para revisar e ajustar o que quiser antes de publicar.',
      'Nenhum fluxo fica ativo sozinho: você ainda precisa publicar cada um quando estiver satisfeito com o conteúdo.',
    ],
    exemploResultado:
      'Num salão de beleza que nunca usou o Maestro, um clique gera 6 fluxos prontos: Atendimento, Qualificação, Agendamento, Vendas, FAQ e Pós-venda, já ligados entre si. O dono revisa o texto de cada mensagem em 10 minutos e publica, em vez de montar tudo do zero.',
    relacionados: ['flows.mapa-operacao.visao'],
  },
  {
    featureKey: 'flows.editor.testar',
    titulo: 'Testar fluxo',
    clientSafe: true,
    oQueE:
      'O botão Testar roda uma simulação de conversa usando o mesmo motor que atende seus clientes de verdade. Antes de testar, o fluxo é salvo automaticamente, então você sempre testa a versão mais recente.',
    paraQueServe:
      'Serve para você conferir se o fluxo funciona como esperado antes de publicar, sem arriscar mandar uma mensagem errada pra um cliente real. É a forma de ganhar confiança no que você montou.',
    comoImplementar: [
      'Dentro do editor de um fluxo, clique em "Testar" no topo da tela.',
      'O fluxo é salvo sozinho e a simulação roda em cima dessa versão.',
      'Acompanhe o resultado: cada passo mostra o que a IA respondeu, se o fluxo seguiu pro próximo nó ou se a Iza assumiu a conversa.',
      'Se algo não saiu como esperado, ajuste o nó em questão e teste de novo, quantas vezes precisar, antes de publicar.',
    ],
    exemploResultado:
      'Um dono de pet shop testa o fluxo de Agendamento de banho e percebe que, ao digitar "amanhã", a IA não reconhece a data. Ele ajusta o nó de pergunta, testa de novo, confirma que agora funciona, e só então publica o fluxo pros clientes reais.',
    relacionados: ['flows.editor.simular', 'flows.editor.metricas-por-no'],
  },
  {
    featureKey: 'flows.no-ia.ferramenta-webhook',
    titulo: 'Ferramenta (webhook) no Nó-IA',
    clientSafe: true,
    oQueE:
      'Um webhook é uma forma da IA "ligar" pra um sistema seu (um site, uma planilha online, um sistema de estoque) durante a conversa, pra buscar uma informação ou avisar algo, sem você precisar copiar e colar nada na hora.',
    paraQueServe:
      'Serve para a IA responder com dados reais do seu negócio, tipo "esse produto tem 8 unidades no estoque" ou "sua consulta ficou confirmada pro dia 15", em vez de dar uma resposta genérica. É um recurso técnico: normalmente quem configura a URL e os dados é um desenvolvedor ou a equipe técnica do sistema que você quer conectar.',
    comoImplementar: [
      'Dentro do Nó-IA, marque a caixa "Usar uma ferramenta (webhook)".',
      'Preencha o nome da ferramenta (só letras, números e "_", sem espaço), a descrição de quando ela deve ser usada, e a URL do sistema que vai receber a chamada.',
      'Escolha o método HTTP (POST é o mais comum) e, se o seu sistema exigir, adicione os headers de autenticação.',
      'Use um token dedicado pra esse webhook, nunca uma senha ou chave mestre do seu sistema, porque essa configuração fica salva junto com o fluxo.',
    ],
    exemploResultado:
      'Uma loja de roupas conecta um webhook ao sistema de estoque. Quando o cliente pergunta "tem essa camisa no P?", a IA chama o webhook, recebe "sim, 3 unidades" e responde na hora, sem precisar de um vendedor humano checando o estoque.',
  },
  {
    featureKey: 'flows.editor.experimento-ab',
    titulo: 'Experimento A/B',
    clientSafe: true,
    oQueE:
      'O teste A/B divide os atendimentos entre duas versões do mesmo fluxo: a original (A) e uma variante (B), pra você comparar qual das duas converte mais clientes.',
    paraQueServe:
      'Serve para você decidir com números, não no "achismo", qual jeito de conduzir a conversa funciona melhor. Em vez de trocar o fluxo inteiro e torcer, você testa uma mudança pequena com uma parte dos clientes e mede o resultado antes de aplicar pra todo mundo.',
    comoImplementar: [
      'No editor do fluxo, clique em "A/B" no topo da tela.',
      'Ative o teste e escolha o fluxo variante (B) que vai disputar contra este (A). A variante precisa ser um fluxo ativo já criado por você.',
      'Ajuste o percentual de clientes que vai pra cada lado no controle deslizante (ex: 80% no A, 20% no B).',
      'Se quiser, escolha um nó específico como "conversão" (ex: o nó de agendamento confirmado). Sem escolher, conta como conversão qualquer cliente que chegar ao fim do fluxo.',
      'Volte no painel depois de alguns dias para ver o resultado dos últimos 14 dias e decidir qual variante vencer.',
    ],
    exemploResultado:
      'Uma clínica testa duas formas de oferecer a consulta: a versão A pergunta "quer agendar?" e a B já sugere um horário direto. Depois de 14 dias, a variante B converteu 8% a mais. O dono ativa a B como fluxo principal e desliga o teste.',
  },
  {
    featureKey: 'flows.editor.simular',
    titulo: 'Simular',
    clientSafe: true,
    oQueE:
      'O Simular cria clientes fictícios, gerados pela própria IA, e faz eles "conversarem" com o seu fluxo sozinhos, sem você precisar digitar nada. É como testar o fluxo com vários tipos de cliente de uma vez.',
    paraQueServe:
      'Serve para você descobrir, antes de publicar, como o fluxo se comporta com perguntas e jeitos de falar diferentes: o cliente apressado, o que enrola, o que já chega decidido. Ajuda a pegar falha que você não pensaria em testar na mão.',
    comoImplementar: [
      'Dentro do editor do fluxo, clique em "Simular" no topo da tela.',
      'Aguarde: a IA gera algumas personas (perfis de clientes fictícios) e conduz cada uma pelo fluxo.',
      'Ao final, revise o resumo: quantas personas concluíram o fluxo com sucesso, onde alguma travou ou saiu sem resposta.',
      'Ajuste os pontos que travaram e simule de novo até o resultado ficar consistente.',
    ],
    exemploResultado:
      'Um salão de beleza roda o Simular no fluxo de Agendamento e descobre que 1 de 3 personas fictícias travou ao tentar remarcar um horário. O dono ajusta o nó de remarcação e simula de novo: dessa vez as 3 personas concluem o fluxo sem travar.',
    relacionados: ['flows.editor.testar'],
  },
  {
    featureKey: 'flows.editor.metricas-por-no',
    titulo: 'Métricas por nó',
    clientSafe: true,
    oQueE:
      'Quando você liga o botão Métricas, cada quadro (nó) do fluxo ganha dois números: quantos clientes passaram por ali (▶) e quantos o atendimento terminou naquele ponto (⏹), somando os últimos 7 dias.',
    paraQueServe:
      'Serve para você achar, olhando o desenho do fluxo, exatamente onde os clientes estão "travando" ou desistindo do atendimento. Se um nó tem muita gente entrando e pouca saindo pro próximo passo, é ali que vale a pena revisar a pergunta ou a mensagem.',
    comoImplementar: [
      'Dentro do editor do fluxo, clique no botão "Métricas" no topo da tela pra ligar os badges nos nós.',
      'O número ao lado de ▶ mostra quantos clientes entraram naquele nó nos últimos 7 dias.',
      'O número ao lado de ⏹, quando aparece, mostra quantos atendimentos terminaram ali (o cliente não seguiu adiante no fluxo).',
      'Clique no botão de novo pra esconder os números quando não precisar mais.',
    ],
    exemploResultado:
      'Numa barbearia, o fluxo de Agendamento mostra que 100 clientes entraram no nó "Escolher horário" nos últimos 7 dias, mas 30 encerraram ali sem marcar. O dono percebe que a lista de horários está confusa e simplifica a mensagem, reduzindo a desistência.',
    relacionados: ['flows.editor.testar'],
  },
  {
    featureKey: 'flows.no-mensagem.botoes-midia',
    titulo: 'Texto, Botões/Lista ou Mídia na mensagem',
    clientSafe: true,
    oQueE:
      'É a forma de escolher como a mensagem do fluxo chega pro cliente no WhatsApp: um texto simples, botões ou uma lista de opções pra ele tocar, ou uma mídia (imagem, documento ou áudio) junto com uma legenda.',
    paraQueServe:
      'Serve para deixar o atendimento mais rápido e claro pro cliente. Em vez dele digitar "quero o plano mensal", ele toca num botão. Isso reduz erro de digitação e acelera a conversa, principalmente em perguntas com poucas opções.',
    comoImplementar: [
      'No nó de Mensagem, escolha o modo: Texto, Botões/Lista ou Mídia.',
      'Em Botões, você tem até 3 opções por mensagem. Em Lista, até 10. O WhatsApp não permite mais que isso.',
      'Em Mídia, escolha o tipo (imagem, documento ou áudio) e cole a URL pública do arquivo. Imagem e documento aceitam legenda; áudio por URL ainda não é enviado nesta versão.',
      'Salve e use o "Testar" pra ver exatamente como a mensagem chega pro cliente antes de publicar.',
    ],
    exemploResultado:
      'Uma clínica troca a pergunta "qual especialidade você procura?" (texto livre) por uma Lista com as 6 especialidades da clínica. Os clientes passam a responder em 1 toque, e a IA erra menos ao entender a escolha porque a opção já vem certa.',
  },
];
