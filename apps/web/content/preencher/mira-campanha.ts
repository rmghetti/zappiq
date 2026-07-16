import type { PreencherCampoContent } from './types';

/**
 * "O que preencher aqui" de cada campo digitável da Nova campanha de
 * prospecção. Voz pt-BR, /voz-humana, sem travessão.
 *
 * Regra que guia toda esta copy: o campo tem que dizer a VERDADE do motor.
 * Nada de prometer recorte que a busca não faz. Dois exemplos que moldaram os
 * textos abaixo, os dois reais:
 *  - "empresas PME" é porte, não ramo: nunca vira CNAE, então a campanha
 *    buscava errado e ninguém avisava.
 *  - a busca B2B recorta por ESTADO (a base filtra `sigla_uf`). "Campinas"
 *    sozinha não recorta nada. Prometer cidade aqui seria mentira.
 */

/** Moldura comum das ilustrações: mesma linguagem visual em todos os popups. */
function quadro(interno: string, altura = 210): string {
  return `<svg viewBox="0 0 640 ${altura}" role="img" width="100%" style="max-width:640px;margin:0 auto;display:block" xmlns="http://www.w3.org/2000/svg">
    <style>
      .rot{font:600 11px system-ui,sans-serif;fill:#6B7280;letter-spacing:.06em}
      .txt{font:13px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#111827}
      .obs{font:11px system-ui,sans-serif;fill:#6B7280}
      .ok{font:600 11px system-ui,sans-serif;fill:#0F7A50}
      .no{font:600 11px system-ui,sans-serif;fill:#B91C1C}
    </style>
    ${interno}
  </svg>`;
}

/** Linha de exemplo: caixa de campo + selo de certo/errado + observação. */
function linha(y: number, valor: string, bom: boolean, obs: string): string {
  const cor = bom ? '#2FB57A' : '#DC2626';
  const fundo = bom ? '#F0FBF6' : '#FEF2F2';
  const selo = bom
    ? `<path d="M602 ${y + 13} l4 4 8-9" fill="none" stroke="#0F7A50" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="M603 ${y + 11} l11 11 M614 ${y + 11} l-11 11" fill="none" stroke="#B91C1C" stroke-width="2.4" stroke-linecap="round"/>`;
  return `
    <rect x="16" y="${y}" width="570" height="34" rx="8" fill="${fundo}" stroke="${cor}" stroke-width="1.5"/>
    <text class="txt" x="30" y="${y + 22}">${valor}</text>
    ${selo}
    <text class="obs" x="30" y="${y + 48}">${obs}</text>`;
}

export const miraCampanhaPreencher: PreencherCampoContent[] = [
  /* ── O que procurar (B2B) ─────────────────────────────────────────── */
  {
    campoKey: 'mira.campanha.alvos.b2b',
    titulo: 'O que procurar (empresas)',
    saibaMais: 'mira.motorB',
    resumo:
      'Aqui vai a ATIVIDADE das empresas que você quer achar, ou seja, o que elas fazem. É o único campo que diz à busca o que procurar.',
    deve: [
      'A atividade escrita como você fala: "distribuidoras de TI", "clínicas odontológicas", "indústrias metalúrgicas".',
      'Ou o código de CNAE, se você já souber: "4651-6" ou só "47" para o comércio varejista inteiro.',
      'Um item por vez. Vários itens somam: a busca procura empresas de qualquer um deles.',
      'Quanto mais específico o ramo, melhor o Alvo. "Indústrias metalúrgicas" traz metalúrgicas; "indústria" traz a indústria inteira, do frigorífico à fábrica de móveis.',
    ],
    naoDeve: [
      {
        item: 'Porte ou tamanho: "empresas PME", "pequenas empresas", "grandes contas"',
        porque:
          'Porte não é ramo. A base pública separa as empresas pelo que elas fazem, não pelo tamanho, então isso nunca vira busca e a campanha procura no lugar errado.',
        ondeVai: 'No Perfil de Prospecção, campo Portes-alvo. Lá o porte filtra os Alvos depois que a busca acha.',
      },
      {
        item: 'Sinal de intenção: "empresas que estão contratando", "quem precisa de CRM", "quem está insatisfeito"',
        porque:
          'Nenhuma base pública de CNPJ sabe a intenção de compra de ninguém. Escrever isso aqui não filtra nada, só desperdiça o item.',
        ondeVai:
          'No Perfil, campo Sinais de intenção. Ele não escolhe quem procurar, mas calibra o Mira Score e a abordagem do dossiê.',
      },
      {
        item: 'Nome de empresa: "Ambev", "meus concorrentes"',
        porque: 'Esta busca acha empresas por ramo, não procura uma empresa específica pelo nome.',
        ondeVai: 'Se você já sabe quem quer, use a campanha "Mapear minha carteira" e cole o CNPJ delas.',
      },
      {
        item: 'Região: "empresas de Campinas"',
        porque: 'Misturar lugar com ramo confunde a busca. Cada coisa tem seu campo, e os dois se somam.',
        ondeVai: 'No campo "Onde", logo abaixo.',
      },
    ],
    exemplos: [
      { valor: 'indústrias metalúrgicas', bom: true, nota: 'Ramo específico. Traz metalurgia de verdade.' },
      { valor: '4651-6', bom: true, nota: 'CNAE direto na base oficial, sem margem para dúvida.' },
      { valor: 'serviços', bom: false, nota: 'Vale o setor terciário inteiro do país. Traz empresa aleatória.' },
      { valor: 'empresas PME', bom: false, nota: 'É porte. Vai para o campo Portes-alvo do Perfil.' },
    ],
    comoVira:
      'A Mira traduz o que você escreve em código de atividade (CNAE) e procura na base oficial da Receita, com 28 milhões de empresas ativas. Depois confere cada uma, mapeia os sócios como decisores e monta o dossiê. Só o Alvo verificado desconta da sua cota.',
    ilustracao: quadro(`
      <text class="rot" x="16" y="14">O QUE PROCURAR (EMPRESAS)</text>
      ${linha(26, 'indústrias metalúrgicas', true, 'Vira CNAE 24 e busca metalurgia na base oficial.')}
      ${linha(94, 'empresas PME', false, 'Porte não é ramo: não vira busca nenhuma.')}
      <g transform="translate(0,150)">
        <rect x="16" y="0" width="570" height="42" rx="8" fill="#F5F6FF" stroke="#4A52D0" stroke-width="1.2" stroke-dasharray="4 3"/>
        <path d="M40 21 l14 0 m-5 -5 l5 5 l-5 5" fill="none" stroke="#4A52D0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <text class="obs" x="66" y="18" style="fill:#3730A3;font-weight:600">"empresas PME" tem lugar certo</text>
        <text class="obs" x="66" y="33">Perfil de Prospecção, campo Portes-alvo: lá o porte filtra depois da busca.</text>
      </g>`, 200),
  },

  /* ── O que procurar (B2C) ─────────────────────────────────────────── */
  {
    campoKey: 'mira.campanha.alvos.b2c',
    titulo: 'O que procurar (negócio local)',
    saibaMais: 'mira.motorB',
    resumo:
      'Aqui vai o TIPO DE NEGÓCIO local que você quer achar no mapa: o estabelecimento, não a pessoa que compra dele.',
    deve: [
      'O tipo de negócio como aparece na placa: "clínicas de estética", "academias", "pizzarias", "pet shops".',
      'Um tipo por item. Vários itens somam.',
      'Termos que uma pessoa usaria para procurar o lugar no mapa. É exatamente assim que a busca funciona.',
    ],
    naoDeve: [
      {
        item: 'Pessoa física: "mulheres de 25 a 45 anos", "classe B", "quem tem filho pequeno"',
        porque:
          'A Mira não prospecta pessoa física, e isso é decisão nossa, não limitação: não existe fonte pública legítima de dados de consumidor, e usar lista dessas quebraria a LGPD junto com a sua reputação.',
        ondeVai:
          'Para falar com consumidor, use o Zap Impulso na SUA base, gente que já te deu contato. Para descrever seu consumidor e calibrar a abordagem, use o bloco "Quem é o seu consumidor" do Perfil.',
      },
      {
        item: 'Profissão ou vínculo: "autônomos", "CLT", "empreendedores"',
        porque:
          'Isso descreve a ocupação de uma pessoa, não um negócio que existe no mapa. "Autônomos em Moema" não encontra nada.',
        ondeVai: 'No Perfil, campo Ocupação, dentro do bloco do consumidor.',
      },
      {
        item: 'Nome de uma rede específica: "Smart Fit"',
        porque: 'A busca acha por tipo de negócio, não por marca.',
        ondeVai: 'Se você já sabe quem quer, use "Mapear minha carteira" com o CNPJ.',
      },
    ],
    exemplos: [
      { valor: 'clínicas de estética', bom: true, nota: 'Tipo de negócio que existe no mapa.' },
      { valor: 'pet shops', bom: true, nota: 'Simples e específico, do jeito que se procura.' },
      { valor: 'mulheres de 25 a 45', bom: false, nota: 'É pessoa. A Mira não prospecta pessoa física.' },
      { valor: 'autônomos', bom: false, nota: 'É vínculo de trabalho. Não existe como negócio.' },
    ],
    comoVira:
      'A Mira procura no Google Places os negócios do tipo que você pediu, na região escolhida, e traz nome, endereço, telefone e avaliações. Só o negócio com contato verificável (telefone ou site) desconta da sua cota.',
    ilustracao: quadro(`
      <text class="rot" x="16" y="14">O QUE PROCURAR (NEGÓCIO LOCAL)</text>
      ${linha(26, 'clínicas de estética', true, 'Existe no mapa, tem endereço e telefone.')}
      ${linha(94, 'mulheres de 25 a 45 anos', false, 'É pessoa: a Mira não prospecta pessoa física.')}
      <g transform="translate(0,150)">
        <rect x="16" y="0" width="570" height="42" rx="8" fill="#F5F6FF" stroke="#4A52D0" stroke-width="1.2" stroke-dasharray="4 3"/>
        <path d="M40 21 l14 0 m-5 -5 l5 5 l-5 5" fill="none" stroke="#4A52D0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <text class="obs" x="66" y="18" style="fill:#3730A3;font-weight:600">Quer falar com o consumidor?</text>
        <text class="obs" x="66" y="33">Use o Zap Impulso na sua própria base. Aqui a Mira mapeia o negócio, não a pessoa.</text>
      </g>`, 200),
  },

  /* ── Onde (B2B) ───────────────────────────────────────────────────── */
  {
    campoKey: 'mira.campanha.regiao.b2b',
    titulo: 'Onde procurar (empresas)',
    saibaMais: 'mira.motorB',
    resumo:
      'O recorte de lugar da busca. Na busca por empresas, o corte é por ESTADO: é assim que a base oficial da Receita organiza o endereço.',
    deve: [
      'A sigla do estado: "SP", "RJ", "MG".',
      'Ou o nome por extenso, que a gente entende igual: "São Paulo", "Rio Grande do Sul".',
      'Vários estados somam: "SP" e "RJ" procuram nos dois.',
      'Pode deixar vazio. Sem estado, a busca vale para o Brasil inteiro, e isso é uma escolha legítima se o seu produto atende o país todo.',
    ],
    naoDeve: [
      {
        item: 'Cidade ou bairro sozinhos: "Campinas", "zona sul", "Grande ABC"',
        porque:
          'A busca por empresas recorta por estado, então cidade sozinha não estreita nada e a campanha acaba varrendo o Brasil inteiro sem avisar. Se quiser deixar a cidade escrita para se lembrar, escreva o estado junto: "Campinas, SP" funciona.',
        ondeVai:
          'Para recortar por cidade e bairro de verdade, use a trilha Negócio local (B2C), que busca no mapa. Ou traga o estado aqui e filtre a cidade depois, na lista de Alvos.',
      },
      {
        item: 'País: "Brasil"',
        porque: 'A base é só do Brasil, então isso é o mesmo que deixar vazio, e ocupa um item à toa.',
        ondeVai: 'Deixe o campo vazio, dá no mesmo e fica mais claro.',
      },
      {
        item: 'Endereço completo ou CEP',
        porque: 'A busca não chega nesse nível de precisão. Ela recorta o estado e verifica o resto na Receita.',
        ondeVai: 'O endereço de cada empresa vem pronto no dossiê do Alvo, depois que ela é verificada.',
      },
    ],
    exemplos: [
      { valor: 'SP', bom: true, nota: 'Direto ao ponto. Recorta o estado de São Paulo.' },
      { valor: 'Campinas, SP', bom: true, nota: 'Recorta por SP. A cidade fica de lembrete para você.' },
      { valor: 'Campinas', bom: false, nota: 'Não recorta nada: a busca vai para o Brasil inteiro.' },
      { valor: 'Grande ABC', bom: false, nota: 'Não vira estado. Escreva "SP".' },
    ],
    comoVira:
      'A Mira lê o estado que você escreveu e filtra a base de 28 milhões de empresas ativas por ele antes de verificar qualquer coisa. É o recorte que faz a campanha render, porque ela para de gastar cota com empresa fora do seu alcance.',
    ilustracao: quadro(`
      <text class="rot" x="16" y="14">ONDE PROCURAR (EMPRESAS)</text>
      ${linha(26, 'SP', true, 'Recorta o estado de São Paulo na base oficial.')}
      ${linha(94, 'Campinas', false, 'Cidade não recorta: a busca varre o Brasil inteiro.')}
      <g transform="translate(0,150)">
        <rect x="16" y="0" width="570" height="42" rx="8" fill="#F0FBF6" stroke="#2FB57A" stroke-width="1.2" stroke-dasharray="4 3"/>
        <path d="M40 21 l14 0 m-5 -5 l5 5 l-5 5" fill="none" stroke="#0F7A50" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <text class="obs" x="66" y="18" style="fill:#0F7A50;font-weight:600">Quer mesmo a cidade?</text>
        <text class="obs" x="66" y="33">Escreva "Campinas, SP": recorta SP e a cidade fica anotada para você.</text>
      </g>`, 200),
  },

  /* ── Onde (B2C) ───────────────────────────────────────────────────── */
  {
    campoKey: 'mira.campanha.regiao.b2c',
    titulo: 'Onde procurar (negócio local)',
    saibaMais: 'mira.motorB',
    resumo:
      'O lugar onde a Mira vai procurar no mapa. Aqui, ao contrário da busca por empresas, cidade e bairro funcionam de verdade.',
    deve: [
      'Cidade: "Campinas", "Ribeirão Preto".',
      'Bairro ou zona, quando o negócio é de vizinhança: "Moema", "zona sul de SP".',
      'Região conhecida: "Grande ABC", "litoral norte".',
      'Quanto mais estreito, melhor o resultado: negócio local se ganha por proximidade, e um bairro por campanha rende mais que uma capital inteira.',
    ],
    naoDeve: [
      {
        item: 'O Brasil inteiro ou um estado grande: "Brasil", "SP"',
        porque:
          'A busca no mapa devolve um número limitado de lugares por consulta. Pedir um estado inteiro traz uma amostra espalhada, não os melhores vizinhos.',
        ondeVai: 'Faça uma campanha por cidade ou por bairro. Elas ficam separadas na gestão do hub e você compara qual rendeu.',
      },
      {
        item: 'O tipo de negócio: "academias de Campinas"',
        porque: 'Misturar as duas coisas confunde a busca. O tipo já está no campo de cima, e os dois se somam.',
        ondeVai: 'No campo "O que procurar".',
      },
    ],
    exemplos: [
      { valor: 'Moema, São Paulo', bom: true, nota: 'Bairro: o recorte ideal para negócio de vizinhança.' },
      { valor: 'Campinas', bom: true, nota: 'Cidade inteira. Funciona bem.' },
      { valor: 'Brasil', bom: false, nota: 'Amostra espalhada, sem os melhores vizinhos.' },
      { valor: 'academias de Campinas', bom: false, nota: 'O tipo de negócio vai no campo de cima.' },
    ],
    comoVira:
      'A Mira procura no Google Places os negócios do tipo que você pediu, dentro do lugar que você escreveu, e traz nome, endereço, telefone e avaliações de cada um.',
    ilustracao: quadro(`
      <text class="rot" x="16" y="14">ONDE PROCURAR (NEGÓCIO LOCAL)</text>
      ${linha(26, 'Moema, São Paulo', true, 'Bairro: o recorte que faz negócio local render.')}
      ${linha(94, 'Brasil', false, 'Traz amostra espalhada, não os melhores vizinhos.')}
      <g transform="translate(0,150)">
        <rect x="16" y="0" width="570" height="42" rx="8" fill="#F5F6FF" stroke="#4A52D0" stroke-width="1.2" stroke-dasharray="4 3"/>
        <path d="M40 21 l14 0 m-5 -5 l5 5 l-5 5" fill="none" stroke="#4A52D0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <text class="obs" x="66" y="18" style="fill:#3730A3;font-weight:600">Uma campanha por bairro</text>
        <text class="obs" x="66" y="33">Ficam separadas na gestão do hub, e você vê qual rendeu mais.</text>
      </g>`, 200),
  },

  /* ── Nome da campanha ─────────────────────────────────────────────── */
  {
    campoKey: 'mira.campanha.nome',
    titulo: 'Nome da campanha',
    saibaMais: 'mira.campanhas',
    resumo:
      'Só uma etiqueta para você reconhecer esta campanha depois, na gestão do hub e no filtro dos Alvos. Não muda em nada o que a busca procura.',
    deve: [
      'Um apelido que faça sentido para você daqui a um mês: "Metalúrgicas SP, teste de abordagem".',
      'Se estiver testando algo, diga o teste no nome: é assim que você compara duas campanhas depois.',
      'Pode deixar vazio. Sem nome, batizamos pela busca e pela data, tipo "Descoberta: metalúrgicas em SP (15/jul)".',
    ],
    naoDeve: [
      {
        item: 'O que procurar: "clínicas de estética"',
        porque:
          'O nome é só etiqueta, não entra na busca. Se o que você quer procurar estiver só aqui, a campanha não vai procurar isso.',
        ondeVai: 'No campo "O que procurar".',
      },
      {
        item: 'Dado de cliente: nome, telefone ou CPF de alguém',
        porque: 'O nome da campanha aparece em listas e relatórios. Dado pessoal não tem por que passear por ali.',
        ondeVai: 'Contato de pessoa vive no CRM, com o controle de acesso que ele merece.',
      },
    ],
    exemplos: [
      { valor: 'Metalúrgicas SP, 1ª rodada', bom: true, nota: 'Você reconhece daqui a um mês.' },
      { valor: 'Teste: bairro x cidade', bom: true, nota: 'Diz o teste. Fácil de comparar depois.' },
      { valor: '(vazio)', bom: true, nota: 'Batizamos pela busca e pela data.' },
      { valor: 'clínicas de estética', bom: false, nota: 'Isto é o que procurar, e o nome não busca nada.' },
    ],
    comoVira:
      'Cada disparo vira uma campanha nomeada. Na gestão do hub você vê quantos Alvos cada uma trouxe e quantos ficaram prontos, e na lista de Alvos dá para filtrar só os dela.',
  },

  /* ── CNPJs (Mapear carteira) ──────────────────────────────────────── */
  {
    campoKey: 'mira.campanha.cnpjs',
    titulo: 'CNPJs da sua carteira',
    saibaMais: 'mira.motorA',
    resumo:
      'A lista de CNPJs que você já tem e quer que a Mira enriqueça: clientes, contas paradas, indicações. Aqui ela não procura ninguém, ela investiga quem você já conhece.',
    deve: [
      'Um CNPJ por linha, até 50 por vez.',
      'Com ou sem pontuação, tanto faz: "12.345.678/0001-90" ou "12345678000190".',
      'Se seus contatos do CRM já têm CNPJ, use o botão "Importar CNPJs do meu CRM" e pule a digitação.',
    ],
    naoDeve: [
      {
        item: 'CPF (11 dígitos)',
        porque:
          'CPF é dado pessoal e a Mira trabalha com registro público de empresa. Além de não funcionar, jogar CPF aqui é risco de LGPD que você não precisa correr.',
        ondeVai: 'Contato de pessoa vive no CRM, com o controle de acesso e a base legal que ele exige.',
      },
      {
        item: 'Nome da empresa em vez do número: "Padaria do João"',
        porque: 'Esta campanha verifica pelo número na Receita. Nome não identifica ninguém com certeza.',
        ondeVai:
          'Se você não tem o CNPJ, use a campanha "Descobrir novos clientes" e procure pelo ramo. Ou ache o CNPJ no site da Receita e volte aqui.',
      },
      {
        item: 'CNPJ de filial quando você quer a matriz',
        porque:
          'Filial e matriz são CNPJs diferentes, e cada um vira um Alvo, gastando duas cotas para a mesma conta.',
        ondeVai: 'Cole a matriz (o CNPJ que termina em 0001) quando a decisão de compra estiver lá.',
      },
    ],
    exemplos: [
      { valor: '12.345.678/0001-90', bom: true, nota: 'Matriz, com pontuação. Perfeito.' },
      { valor: '12345678000190', bom: true, nota: 'Sem pontuação também vale.' },
      { valor: '123.456.789-00', bom: false, nota: 'É CPF. Dado de pessoa vive no CRM.' },
      { valor: 'Padaria do João', bom: false, nota: 'Nome não verifica. Precisa do número.' },
    ],
    comoVira:
      'A Mira confere cada CNPJ na base oficial da Receita, confirma se está ativo, traz razão social, porte e capital, mapeia os sócios como decisores e calcula o Mira Score cruzando a conta com o seu catálogo. CNPJ inativo ou não encontrado não desconta cota.',
    ilustracao: quadro(`
      <text class="rot" x="16" y="14">CNPJS DA SUA CARTEIRA</text>
      ${linha(26, '12.345.678/0001-90', true, 'CNPJ de matriz: vira Alvo com dossiê e decisores.')}
      ${linha(94, '123.456.789-00', false, 'É CPF: dado de pessoa, não entra aqui.')}
      <g transform="translate(0,150)">
        <rect x="16" y="0" width="570" height="42" rx="8" fill="#FEF2F2" stroke="#DC2626" stroke-width="1.2" stroke-dasharray="4 3"/>
        <path d="M47 12 v12 M47 29 v1.5" stroke="#B91C1C" stroke-width="2.2" stroke-linecap="round"/>
        <text class="obs" x="66" y="18" style="fill:#B91C1C;font-weight:600">CPF não entra aqui</text>
        <text class="obs" x="66" y="33">Dado pessoal vive no CRM, com controle de acesso. Aqui é registro público de empresa.</text>
      </g>`, 200),
  },
];
