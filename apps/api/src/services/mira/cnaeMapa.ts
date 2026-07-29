/**
 * Mira Prospects — atividade escrita → código de CNAE.
 *
 * A base de CNPJs (28M empresas ativas, espelho do BD Pro) só sabe filtrar por
 * PREFIXO NUMÉRICO de CNAE: a tabela espelho tem cnpj, nome_fantasia,
 * cnae_fiscal_principal, sigla_uf e id_municipio, sem descrição da atividade.
 * Mas o campo do Perfil convida texto ("4651-6 ou 'distribuidoras de TI'"), e
 * é assim que o cliente escreve de verdade: "serviços", "comércio varejista".
 *
 * Sem esta tradução, todo alvo escrito passava longe da base boa e sobrava só
 * a busca pública na web — que é pior (raspa CNPJ de snippet) e ainda depende
 * de provedor externo. Foi o que deixou a primeira campanha do fundador com
 * zero alvos: os 5 alvos dele eram texto, o BigQuery nem foi chamado, e a web
 * respondeu 403.
 *
 * O mapa é a estrutura oficial da CNAE 2.3 (seções e divisões, os 2 primeiros
 * dígitos). Determinístico, sem LLM: código de atividade é fato, não palpite,
 * e um palpite errado aqui vira uma campanha inteira procurando o setor errado.
 */

/** Divisões da CNAE 2.3 por termo. A chave é o termo normalizado. */
interface EntradaCnae {
  /** Prefixos de 2 dígitos (divisão) que o termo cobre. */
  divisoes: string[];
  /** Termos que apontam para a mesma divisão. */
  sinonimos: string[];
}

/**
 * Curado à mão a partir da estrutura oficial. Cobre o vocabulário que o
 * cliente usa; o que não casar continua indo para a busca pública, que é o
 * lugar certo para atividade que não vira código.
 */
const MAPA: EntradaCnae[] = [
  // ── Seções inteiras (o cliente costuma escrever assim) ──
  { divisoes: ['01', '02', '03'], sinonimos: ['agropecuaria', 'agro', 'agricultura', 'pecuaria', 'agronegocio', 'fazenda'] },
  { divisoes: ['05', '06', '07', '08', '09'], sinonimos: ['industria extrativa', 'mineracao', 'extrativismo'] },
  {
    divisoes: ['10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33'],
    sinonimos: ['industria', 'industrias', 'industria de transformacao', 'fabrica', 'fabricas', 'manufatura', 'fabricante', 'fabricantes'],
  },
  // ── Ramos da indústria (divisões específicas) ──
  // Sem estes, "indústrias metalúrgicas" casava só com "industria" e trazia as
  // divisões 10 a 33 — o setor secundário inteiro. Foi o que aconteceu na
  // primeira campanha que funcionou: pedimos metalúrgicas em SP e vieram uma
  // fábrica de móveis e uma de máquinas agrícolas. Estreitar o alvo é o
  // conselho que damos ao cliente; ele precisa valer.
  { divisoes: ['24'], sinonimos: ['metalurgia', 'metalurgica', 'metalurgicas', 'industria metalurgica', 'industrias metalurgicas', 'siderurgia', 'siderurgica', 'fundicao'] },
  { divisoes: ['25'], sinonimos: ['produtos de metal', 'metalomecanica', 'metalmecanica', 'serralheria', 'caldeiraria', 'usinagem'] },
  { divisoes: ['10'], sinonimos: ['industria de alimentos', 'alimenticia', 'alimenticio', 'frigorifico', 'frigorificos', 'laticinio', 'laticinios'] },
  { divisoes: ['11'], sinonimos: ['bebidas', 'cervejaria', 'cervejarias', 'destilaria'] },
  { divisoes: ['13', '14'], sinonimos: ['textil', 'texteis', 'confeccao', 'confeccoes', 'vestuario', 'malharia'] },
  { divisoes: ['15'], sinonimos: ['calcados', 'calcadista', 'couro', 'curtume'] },
  { divisoes: ['16', '17'], sinonimos: ['madeira', 'madeireira', 'papel', 'celulose', 'embalagens de papel'] },
  { divisoes: ['20', '21'], sinonimos: ['quimica', 'quimicas', 'industria quimica', 'farmaceutica', 'farmaceutico', 'cosmeticos'] },
  { divisoes: ['22'], sinonimos: ['plastico', 'plasticos', 'borracha', 'injecao plastica'] },
  { divisoes: ['23'], sinonimos: ['ceramica', 'cimento', 'vidro', 'minerais nao metalicos'] },
  { divisoes: ['26', '27'], sinonimos: ['eletronica', 'eletronicos', 'eletroeletronica', 'equipamentos eletricos', 'industria eletrica'] },
  { divisoes: ['28'], sinonimos: ['maquinas', 'maquinas e equipamentos', 'equipamentos industriais', 'bens de capital'] },
  { divisoes: ['29', '30'], sinonimos: ['automotiva', 'autopecas industria', 'montadora', 'montadoras', 'industria automobilistica'] },
  { divisoes: ['31'], sinonimos: ['moveis', 'moveleira', 'moveleiro', 'industria de moveis', 'marcenaria industrial'] },

  { divisoes: ['41', '42', '43'], sinonimos: ['construcao', 'construcao civil', 'obras', 'construtora', 'construtoras', 'empreiteira'] },
  { divisoes: ['45', '46', '47'], sinonimos: ['comercio'] },
  { divisoes: ['47'], sinonimos: ['comercio varejista', 'varejo', 'varejista', 'loja', 'lojas', 'lojista'] },
  { divisoes: ['46'], sinonimos: ['comercio atacadista', 'atacado', 'atacadista', 'distribuidora', 'distribuidoras', 'distribuicao'] },
  { divisoes: ['45'], sinonimos: ['concessionaria', 'veiculos', 'automotivo', 'autopecas', 'oficina', 'oficinas'] },
  { divisoes: ['49', '50', '51', '52', '53'], sinonimos: ['transporte', 'transportes', 'logistica', 'transportadora', 'transportadoras', 'armazenagem'] },
  { divisoes: ['55', '56'], sinonimos: ['alimentacao', 'restaurante', 'restaurantes', 'bar', 'bares', 'hotel', 'hoteis', 'hotelaria', 'pizzaria', 'pizzarias', 'lanchonete', 'food service'] },
  { divisoes: ['58', '59', '60', '61', '62', '63'], sinonimos: ['tecnologia', 'ti', 'tecnologia da informacao', 'software', 'informatica', 'sistemas', 'telecom', 'telecomunicacoes', 'midia', 'comunicacao'] },
  { divisoes: ['62', '63'], sinonimos: ['desenvolvimento de software', 'saas', 'startup', 'startups', 'consultoria em ti', 'dados'] },
  { divisoes: ['64', '65', '66'], sinonimos: ['financeiro', 'financeira', 'banco', 'bancos', 'seguros', 'seguradora', 'fintech', 'credito'] },
  { divisoes: ['68'], sinonimos: ['imobiliario', 'imobiliaria', 'imobiliarias', 'imoveis'] },
  { divisoes: ['69', '70', '71', '72', '73', '74', '75'], sinonimos: ['servicos profissionais', 'consultoria', 'consultorias', 'advocacia', 'escritorio de advocacia', 'contabilidade', 'contabil', 'engenharia', 'arquitetura', 'publicidade', 'marketing', 'agencia', 'agencias', 'design', 'veterinaria'] },
  { divisoes: ['77', '78', '79', '80', '81', '82'], sinonimos: ['servicos administrativos', 'terceirizacao', 'facilities', 'seguranca', 'limpeza', 'locacao', 'agencia de viagens', 'rh', 'recursos humanos'] },
  { divisoes: ['85'], sinonimos: ['educacao', 'escola', 'escolas', 'ensino', 'faculdade', 'curso', 'cursos', 'treinamento'] },
  { divisoes: ['86', '87', '88'], sinonimos: ['saude', 'clinica', 'clinicas', 'hospital', 'hospitais', 'medico', 'medicos', 'odontologia', 'dentista', 'dentistas', 'laboratorio'] },
  { divisoes: ['90', '91', '92', '93'], sinonimos: ['cultura', 'esporte', 'lazer', 'academia', 'academias', 'entretenimento'] },
  { divisoes: ['94', '95', '96'], sinonimos: ['servicos pessoais', 'salao', 'salao de beleza', 'estetica', 'barbearia', 'associacao', 'sindicato'] },

  // ── "Serviços" sem qualificar: o cliente quer o setor terciário inteiro.
  // É deliberadamente amplo; a tela avisa que alvo largo traz resultado largo.
  {
    divisoes: ['49','50','51','52','53','55','56','58','59','60','61','62','63','64','65','66','68','69','70','71','72','73','74','75','77','78','79','80','81','82','85','86','87','88','90','91','92','93','94','95','96'],
    sinonimos: ['servico', 'servicos', 'prestador de servicos', 'prestadora de servicos', 'setor de servicos', 'todas as verticais de servicos', 'todos as verticais de servicos'],
  },
];

/** Sem acento, minúsculo, espaço colapsado: o cliente escreve como fala. */
function normalizar(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface AlvoTraduzido {
  /** O texto como o cliente escreveu. */
  texto: string;
  /** Prefixos de CNAE que ele virou (vazio = não deu para traduzir). */
  divisoes: string[];
}

/**
 * Traduz uma atividade escrita em prefixos de CNAE.
 *
 * Casa por termo inteiro (igualdade ou palavra contida), do mais específico
 * para o mais amplo: "comércio varejista" vira 47, não a seção de comércio
 * inteira. Termo que não é atividade ("empresas PME" é PORTE, não ramo)
 * simplesmente não traduz, e segue para a busca pública.
 */
export function traduzirAlvo(texto: string): AlvoTraduzido {
  const alvo = normalizar(texto);
  if (!alvo) return { texto, divisoes: [] };

  // Mais específico primeiro: entre "comercio" e "comercio varejista", vence
  // o sinônimo mais longo que casar.
  let melhor: { divisoes: string[]; tamanho: number } | null = null;
  for (const entrada of MAPA) {
    for (const sin of entrada.sinonimos) {
      const casa = alvo === sin || alvo.includes(sin);
      if (!casa) continue;
      if (!melhor || sin.length > melhor.tamanho) melhor = { divisoes: entrada.divisoes, tamanho: sin.length };
    }
  }
  return { texto, divisoes: melhor?.divisoes ?? [] };
}

export interface AlvosTraduzidos {
  /** Prefixos de CNAE para a base de CNPJs (dedupe). */
  divisoes: string[];
  /** Textos que viraram código (para o cliente saber o que aconteceu). */
  traduzidos: string[];
  /** Textos que não são atividade conhecida: seguem para a busca pública. */
  naoTraduzidos: string[];
}

/** Traduz a lista de alvos escritos da campanha. */
export function traduzirAlvos(textos: string[]): AlvosTraduzidos {
  const divisoes = new Set<string>();
  const traduzidos: string[] = [];
  const naoTraduzidos: string[] = [];
  for (const t of textos ?? []) {
    const r = traduzirAlvo(t);
    if (r.divisoes.length) {
      r.divisoes.forEach((d) => divisoes.add(d));
      traduzidos.push(r.texto);
    } else {
      naoTraduzidos.push(r.texto);
    }
  }
  return { divisoes: Array.from(divisoes), traduzidos, naoTraduzidos };
}
