/* ══════════════════════════════════════════════════════════════════════
 * Fixture: um prompt de cliente com os "# PATCH MANUAL" que o produto
 * colou nele, reconstruído no formato do prompt da Marcia (MACHIA).
 * --------------------------------------------------------------------
 * O que este arquivo reproduz, medido no laudo (A079, A188):
 *
 *   • quatro cabeçalhos "# PATCH MANUAL" no fim do prompt, um por
 *     aplicação, porque nenhum cabeçalho do prompt de cliente casava com a
 *     heurística do patcher;
 *   • QUATRO deles cortados no meio, porque o sugeridor recortava o texto em
 *     600 caracteres em silêncio. Três param no meio de uma palavra ("me co",
 *     "Para te passar o"). O quarto é o caso que escapou da primeira régua e
 *     está VIVO no prompt da Marcia: o corte caiu logo depois de um ponto de
 *     interrogação que estava DENTRO de uma aspa aberta. Olhando só a
 *     pontuação final, esse fragmento passa por frase inteira e vira regra
 *     ativa; olhando as aspas, ele é o que é, um texto pela metade;
 *   • dois patches para o MESMO cenário, aplicados em datas diferentes: é o
 *     acúmulo do A081, que a regra por cenário passa a substituir;
 *   • um "**REGRA INVIOLÁVEL #1" no meio do texto, fora de qualquer bloco
 *     de patch, que também precisa virar registro.
 *
 * O TEXTO é sintético: a estrutura e os defeitos são os medidos, mas nada
 * aqui é conteúdo real de cliente. O script é provado contra esta fixture
 * porque rodar contra o prompt vivo exigiria o banco de produção.
 * ══════════════════════════════════════════════════════════════════════ */

export const PROMPT_COM_PATCHES_MANUAIS = `## IDENTIDADE
Você é a Marcia, consultora da MACHIA. Fala com donos de empresa sobre
automação de atendimento.

## TOM DE VOZ
Direta, cordial, sem jargão. Frases curtas.

## O QUE VOCÊ FAZ
Entende o cenário do cliente, mostra o que dá para automatizar e leva para
uma conversa com o time.

**REGRA INVIOLÁVEL #1 — USO OBRIGATÓRIO DO NOME:** quando o nome do cliente
estiver no contexto, use-o na saudação. Exemplo CORRETO: "Oi, Ana! Aqui é a
Marcia." Exemplo INCORRETO: "Olá! Como posso ajudar?"

## COMO ENCERRAR
Sempre combine o próximo passo antes de encerrar.

# PATCH MANUAL 2026-07-14 12:30 (cenário: cr5_nome_disponivel_usar)
Quando o nome do cliente já estiver na conversa, chame a pessoa pelo nome na
primeira frase da resposta. Exemplo CORRETO: "Oi, Ana! Já te explico como

# PATCH MANUAL 2026-07-24 09:05 (cenário: cr5_nome_ausente_perguntar)
Se o nome do cliente não estiver na conversa, pergunte uma vez, no primeiro
contato: "Como posso te chamar?". Exemplo INCORRETO: "Antes de continuar, me co

# PATCH MANUAL 2026-08-03 15:40 (cenário: cr7_preco_da_base_correto)
Ao falar de preço, apresente a tabela cadastrada na base e não peça mais
contexto antes de informar os valores. Exemplo INCORRETO: "Para te passar o

# PATCH MANUAL 2026-08-17 10:12 (cenário: cr5_nome_disponivel_usar)
Use o nome do cliente na saudação e não pergunte o nome de novo quando ele já
estiver registrado. Exemplo CORRETO: "Oi, Ana! Sobre o que combinamos."

# PATCH MANUAL 2026-08-29 11:20 (cenário: cr6_uma_pergunta_por_vez)
Faça uma pergunta por mensagem e espere a resposta antes da próxima. Quando
precisar do nome, pergunte com esta frase exata: "Como posso te chamar?
`;

/** Só a identidade, sem nenhum patch: o que o script deve deixar no prompt. */
export const PROMPT_SEM_PATCHES = `## IDENTIDADE
Você é a Marcia, consultora da MACHIA.

## TOM DE VOZ
Direta, cordial, sem jargão.
`;
