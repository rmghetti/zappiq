"""
Cabecalho de contexto por trecho (proposta P64).

Ideia emprestada do Contextual Retrieval do anthropics/claude-cookbooks (MIT),
pasta capabilities/contextual-embeddings, na versao barata: em vez de pedir a um
LLM que escreva o contexto de cada trecho, montamos um cabecalho determinista
com o titulo do documento e a secao encontrada dentro do proprio trecho.

O cabecalho entra so no texto que vai para o embedding. O `text` gravado no
pgvector continua sendo o original, porque e ele que aparece para o cliente em
"Respondi com base em" e no Raio-X.
"""

import re
from dataclasses import dataclass

TITULO_MAX = 90
SECAO_MAX = 80
PERGUNTA_MAX = 200

_EXTENSOES = re.compile(
    r"\.(pdf|docx?|xlsx?|txt|md|markdown|csv|html?|pptx?)$", re.IGNORECASE
)

# Palavra final que so diz a versao do arquivo e nao ajuda a busca.
_SUFIXO_VERSAO = re.compile(
    r"\s*\b(v\.?\d+(\.\d+)*|rev\.?\d*|final|finalizado|copia|cópia|"
    r"versao|versão|novo|nova|atualizado|atualizada|ok)\s*$",
    re.IGNORECASE,
)

_TITULO_MARKDOWN = re.compile(r"^\s{0,3}#{1,6}\s+(\S.*?)\s*#*\s*$")

_ROTULO_SECAO = re.compile(
    r"^\s*((cap[íi]tulo|se[çc][ãa]o|parte|anexo|planilha|cl[áa]usula|artigo|t[íi]tulo)"
    r"\b[^\n]{0,70})$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Trecho:
    """O que o pgvector precisa: o original para exibir, o embed para buscar."""

    texto: str
    cabecalho: str
    embed: str


def titulo_amigavel(bruto: str | None) -> str:
    """
    Converte o nome de arquivo em algo que ajude a busca.

    "Plano_v3_final.pdf" vira "Plano". Sem isso, "v3 final" entra no embedding
    de todos os trechos do documento e compete com o conteudo de verdade.
    Conservador: so tira extensao, troca underline por espaco e corta sufixo de
    versao. Nao mexe em hifen (em "Tabela-de-precos" o hifen e o nome).
    """
    nome = (bruto or "").strip()
    if not nome:
        return "Documento"

    sem_extensao = _EXTENSOES.sub("", nome)
    nome = sem_extensao if sem_extensao.strip() else nome
    nome = nome.replace("_", " ")
    nome = re.sub(r"\s+", " ", nome).strip()

    # Corta um sufixo de versao por vez: "Plano v3 final" tem dois.
    limpo = nome
    while True:
        cortado = _SUFIXO_VERSAO.sub("", nome).strip()
        if cortado == nome or not cortado:
            break
        nome = cortado

    # Nome feito so de versao ("v3_final.pdf"): cortar tudo deixaria o trecho
    # sem identidade nenhuma. Melhor devolver o nome limpo do que quase nada.
    if not nome or not _SUFIXO_VERSAO.sub("", nome).strip():
        nome = limpo

    if not nome:
        nome = re.sub(r"\s+", " ", (bruto or "").strip()) or "Documento"

    return nome[:TITULO_MAX].strip()


def detectar_secao(texto: str) -> str | None:
    """
    Primeiro titulo que aparece dentro do trecho, se houver.

    Reconhece titulo Markdown (o extrator de planilha escreve "## Planilha: X"),
    rotulo em portugues ("Capítulo 3: ...", "Cláusula segunda") e linha curta
    toda em maiusculas. Texto corrido nao vira secao: cabecalho inventado e
    pior que cabecalho ausente.
    """
    for linha_bruta in (texto or "").splitlines():
        linha = linha_bruta.strip()
        if not linha:
            continue

        markdown = _TITULO_MARKDOWN.match(linha)
        if markdown:
            return markdown.group(1).strip()[:SECAO_MAX]

        if len(linha) <= SECAO_MAX:
            rotulo = _ROTULO_SECAO.match(linha)
            if rotulo:
                return rotulo.group(1).strip()[:SECAO_MAX]

            letras = [c for c in linha if c.isalpha()]
            if letras and all(c.isupper() for c in letras) and len(letras) >= 3:
                return linha[:SECAO_MAX]

    return None


def montar_cabecalho(
    titulo: str, secao: str | None, pergunta: str | None = None
) -> str:
    """ "Documento: X. Seção: Y." mais "Pergunta: Z" quando o trecho e de Q&A."""
    partes = [f"Documento: {titulo[:TITULO_MAX].strip()}."]
    if secao:
        partes.append(f"Seção: {secao[:SECAO_MAX].strip()}.")
    if pergunta:
        partes.append(f"Pergunta: {pergunta[:PERGUNTA_MAX].strip()}")
    return " ".join(partes)


def montar_trechos(
    chunks: list[str], titulo: str, pergunta: str | None = None
) -> list[Trecho]:
    """Aplica o cabecalho a cada pedaco ja fatiado pelo tokenizador."""
    amigavel = titulo_amigavel(titulo)
    trechos: list[Trecho] = []
    for chunk in chunks:
        secao = None if pergunta else detectar_secao(chunk)
        cabecalho = montar_cabecalho(amigavel, secao, pergunta)
        trechos.append(
            Trecho(texto=chunk, cabecalho=cabecalho, embed=f"{cabecalho}\n\n{chunk}")
        )
    return trechos
