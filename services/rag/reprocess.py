"""
Reprocessamento da base que ja existe, sem pedir reenvio ao cliente.

Duas correcoes na mesma passada, porque as duas mexem nas mesmas linhas de
rag_chunks e fazer em duas vezes custaria dois embeddings:

  1. Cabecalho de contexto (P64). Os trechos entraram sem dizer de que
     documento vem: 177 de 184 nao contem o titulo. Como o texto de cada trecho
     esta gravado em rag_chunks.text, da para remontar o cabecalho e reembedar
     sem os arquivos originais, que nunca foram guardados (A198).

  2. Source estavel (A001, A017). O source de um documento e o TITULO que o
     cliente escreveu. Dois documentos com o mesmo titulo dividem o mesmo
     source, e apagar um apagava os trechos do outro. Aqui o source vira
     doc-<id do kb_document>, que e unico por definicao.

A tabela rag_chunks nao e do Prisma: ela nasce de
packages/database/prisma/rag_pgvector.sql, aplicada pelo
scripts/apply-rag-migration.sh. Por isso a migracao de dado mora aqui, numa
rota administrativa, e nao numa migracao Prisma.

Seguranca: a rota entra pela mesma porta das outras (X-Service-Secret). O
dry-run e o padrao, e so ele calcula o plano; escrever no vetor de producao
exige pedir por escrito.
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from urllib.parse import urlparse

import chunking

logger = logging.getLogger("rag")


@dataclass(frozen=True)
class Documento:
    """Linha de kb_documents, so o que interessa para casar com o source."""

    id: str
    titulo: str
    tipo: str
    url: str | None
    criado_em: datetime | None


@dataclass(frozen=True)
class Fonte:
    """Um (namespace, source) do rag_chunks, com quantos trechos tem."""

    source: str
    trechos: int


# Motivo de fonte que e a versao ANTERIOR de um documento que ja tem trechos
# no source novo. Ver _planejar_fonte e _reprocessar_fonte.
MOTIVO_LEGADO_DUPLICADO = "legado_de_doc_ja_migrado"


@dataclass
class PlanoFonte:
    source: str
    novo_source: str
    titulo: str
    trechos: int
    motivo: str
    pergunta: str | None = None
    # Documentos que dividiam este source e ficam sem trechos depois da troca.
    # Cada item traz id, titulo e criado_em: sem isso o operador nao tem como
    # saber QUAL documento vai aparecer vazio para o cliente.
    colisao: list[dict] = field(default_factory=list)

    def como_json(self) -> dict:
        return {
            "source": self.source,
            "novo_source": self.novo_source,
            "titulo": self.titulo,
            "trechos": self.trechos,
            "motivo": self.motivo,
            "pergunta": self.pergunta,
            "colisao": self.colisao,
        }


def fonte_de_url(url: str) -> str:
    """
    Mesma derivacao do urlToSource em apps/api/src/services/ragService.ts:
    hostname + caminho, sem protocolo e sem barra final. Precisa bater nos dois
    lados, senao a fonte da URL fica orfa no vetor (achado A002).
    """
    try:
        partes = urlparse(url)
    except ValueError:
        return url
    if not partes.hostname:
        return url
    juntos = f"{partes.hostname}{partes.path or ''}".rstrip("/")
    return juntos or partes.hostname


def source_legado(documento: Documento) -> str:
    """O source com que este documento foi gravado antes da migracao."""
    if documento.tipo == "url" and documento.url:
        return fonte_de_url(documento.url)
    return documento.titulo


def planejar(
    fontes: list[Fonte],
    documentos: list[Documento],
    perguntas: dict[str, str],
) -> list[PlanoFonte]:
    """
    Decide, para cada fonte do vetor, qual sera o novo source e qual titulo
    entra no cabecalho. Funcao pura: o plano e conferivel sem banco.
    """
    por_legado: dict[str, list[Documento]] = {}
    for documento in documentos:
        por_legado.setdefault(source_legado(documento), []).append(documento)
    por_id = {documento.id: documento for documento in documentos}
    # Sources que ja existem no vetor. Serve para descobrir o caso em que o
    # documento tem trechos nos DOIS lugares (ver MOTIVO_LEGADO_DUPLICADO).
    existentes = {fonte.source for fonte in fontes}

    plano: list[PlanoFonte] = []
    for fonte in sorted(fontes, key=lambda f: f.source):
        plano.append(_planejar_fonte(fonte, por_legado, por_id, perguntas, existentes))
    return plano


def _identificar(documento: Documento) -> dict:
    return {
        "id": documento.id,
        "titulo": documento.titulo,
        "criado_em": documento.criado_em.isoformat() if documento.criado_em else None,
    }


def _planejar_fonte(
    fonte: Fonte,
    por_legado: dict[str, list[Documento]],
    por_id: dict[str, Documento],
    perguntas: dict[str, str],
    existentes: set[str],
) -> PlanoFonte:
    source = fonte.source

    if source.startswith("doc-"):
        documento = por_id.get(source[4:])
        return PlanoFonte(
            source=source,
            novo_source=source,
            titulo=documento.titulo if documento else source,
            trechos=fonte.trechos,
            motivo="já migrado",
        )

    if source.startswith("qa-"):
        id_do_par = source[3:].removesuffix(".txt")
        return PlanoFonte(
            source=source,
            novo_source=source,
            titulo="Perguntas e respostas",
            trechos=fonte.trechos,
            motivo="qa",
            pergunta=perguntas.get(id_do_par),
        )

    candidatos = por_legado.get(source, [])
    if not candidatos:
        return PlanoFonte(
            source=source,
            novo_source=source,
            titulo=chunking.titulo_amigavel(source),
            trechos=fonte.trechos,
            motivo="sem documento",
        )

    # Os trechos que sobraram sao os da ultima ingestao, porque a ingestao
    # apaga o source antes de gravar. Logo, pertencem ao documento mais novo.
    ordenados = sorted(
        candidatos,
        key=lambda d: (d.criado_em or datetime.min, d.id),
        reverse=True,
    )
    vencedor = ordenados[0]
    novo_source = f"doc-{vencedor.id}"

    # O documento ja tem trechos no source novo E ainda tem os trechos da
    # versao anterior gravados sob o titulo. Acontece quando o cliente reenviou
    # o documento depois do deploy da API e antes do reprocessamento. Renomear
    # o legado para doc-<id> esbarraria na chave unica (namespace, chunk_hash)
    # ou, quando o texto mudou e o hash nao colide, deixaria DUAS versoes do
    # mesmo documento respondendo ao cliente ao mesmo tempo.
    if novo_source in existentes:
        return PlanoFonte(
            source=source,
            novo_source=novo_source,
            titulo=vencedor.titulo,
            trechos=fonte.trechos,
            motivo=MOTIVO_LEGADO_DUPLICADO,
            colisao=[_identificar(d) for d in ordenados[1:]],
        )

    return PlanoFonte(
        source=source,
        novo_source=novo_source,
        titulo=vencedor.titulo,
        trechos=fonte.trechos,
        motivo="documento",
        colisao=[_identificar(d) for d in ordenados[1:]],
    )


def montar_trechos_do_plano(
    item: PlanoFonte, textos: list[str]
) -> list[chunking.Trecho]:
    """Aplica o cabecalho de contexto aos textos ja gravados no vetor."""
    return chunking.montar_trechos(textos, item.titulo, pergunta=item.pergunta)


def _metadata_como_dict(bruto) -> dict:
    if isinstance(bruto, str):
        try:
            bruto = json.loads(bruto)
        except ValueError:
            return {}
    return bruto if isinstance(bruto, dict) else {}


def ja_reprocessada(namespace: str, item: PlanoFonte, linhas, chunk_hash) -> bool:
    """
    Diz se esta fonte ja esta do jeito que o reprocessamento a deixaria.

    Reembedar custa dinheiro por trecho, e rodar de novo (por organizacao, por
    retentativa, por susto) reembedava tudo outra vez, inclusive as fontes "ja
    migrado" e as de Q&A, que nao mudam nada. O criterio e duplo de proposito:
    o cabecalho precisa ja estar gravado no metadata E o hash recalculado
    precisa bater com o gravado. O hash inclui namespace, source, indice,
    cabecalho e texto, entao ele so bate quando as cinco coisas ja estao no
    lugar final. Basta um trecho fora para a fonte inteira ser reprocessada.
    """
    if not linhas:
        return False

    trechos = montar_trechos_do_plano(item, [linha["text"] for linha in linhas])
    for linha, trecho in zip(linhas, trechos):
        if not _metadata_como_dict(linha["metadata"]).get("header"):
            return False
        esperado = chunk_hash(
            namespace,
            item.novo_source,
            int(linha["chunk_idx"]),
            trecho.texto,
            trecho.cabecalho,
        )
        if esperado != linha["chunk_hash"]:
            return False
    return True


# ─────────────────────────────────────────────────────────────────────────────
# Leitura do estado (as tres consultas que o plano precisa)
# ─────────────────────────────────────────────────────────────────────────────

_SQL_FONTES = """
    SELECT source, count(*)::int AS trechos
      FROM rag_chunks
     WHERE namespace = $1
     GROUP BY source
"""

_SQL_DOCUMENTOS = """
    SELECT d."id", d."title", d."sourceType", d."sourceUrl", d."createdAt"
      FROM kb_documents d
      JOIN knowledge_bases k ON k."id" = d."knowledgeBaseId"
     WHERE k."organizationId" = $1
"""

_SQL_QA = """
    SELECT "id", "question" FROM qa_pairs WHERE "organizationId" = $1
"""

_SQL_TRECHOS = """
    SELECT id::text AS id, chunk_idx, text, metadata, chunk_hash
      FROM rag_chunks
     WHERE namespace = $1 AND source = $2
     ORDER BY chunk_idx
"""

_SQL_ATUALIZA = """
    UPDATE rag_chunks
       SET source = $2, chunk_hash = $3, embedding = $4, metadata = $5::jsonb
     WHERE id = $1::uuid
"""

# O UNICO apagar deste modulo, e de proposito.
#
# A regra da casa em migracao de dado e nunca apagar: o texto original dos
# trechos nao existe em lugar nenhum fora do vetor, e um erro aqui nao tem
# desfazer. A excecao e o caso MOTIVO_LEGADO_DUPLICADO, em que as linhas
# apagadas sao a versao ANTERIOR de um documento que ja tem a versao atual
# gravada sob doc-<id>. Nada de unico se perde: o que sai e conteudo velho do
# MESMO documento, que continuaria competindo com a versao nova na busca. Sem
# isso, a alternativa seria violar a chave unica (namespace, chunk_hash) ou
# deixar as duas versoes no ar. O dry-run mostra o caso antes de qualquer
# escrita, com o motivo proprio.
_SQL_APAGA_LEGADO = """
    DELETE FROM rag_chunks
     WHERE namespace = $1 AND source = $2
"""


def organizacao_do_namespace(namespace: str) -> str:
    """O namespace e sempre org_<id da organizacao>."""
    return namespace[4:] if namespace.startswith("org_") else namespace


async def carregar_estado(
    conn, namespace: str
) -> tuple[list[Fonte], list[Documento], dict[str, str]]:
    organizacao = organizacao_do_namespace(namespace)

    # kb_documents e qa_pairs tem RLS por organizacao. A conexao do RAG e dona
    # do banco e passa direto, mas setar a variavel deixa o codigo correto se
    # um dia ela deixar de ser.
    try:
        await conn.fetchval(
            "SELECT set_config($1, $2, true)",
            "app.current_organization_id",
            organizacao,
        )
    except Exception as exc:  # pragma: no cover - depende do papel no banco
        logger.warning(f"reprocess: set_config falhou ({exc})")

    fontes = [
        Fonte(source=linha["source"], trechos=int(linha["trechos"]))
        for linha in await conn.fetch(_SQL_FONTES, namespace)
    ]
    documentos = [
        Documento(
            id=linha["id"],
            titulo=linha["title"],
            tipo=linha["sourceType"],
            url=linha["sourceUrl"],
            criado_em=linha["createdAt"],
        )
        for linha in await conn.fetch(_SQL_DOCUMENTOS, organizacao)
    ]
    perguntas = {
        linha["id"]: linha["question"]
        for linha in await conn.fetch(_SQL_QA, organizacao)
    }
    return fontes, documentos, perguntas


# ─────────────────────────────────────────────────────────────────────────────
# Execucao
# ─────────────────────────────────────────────────────────────────────────────


async def executar(
    pool,
    namespace: str,
    dry_run: bool,
    embed,
    chunk_hash,
) -> dict:
    """
    Monta o plano e, fora do dry-run, reembeda e troca o source.

    `embed` e `chunk_hash` entram por parametro para o teste nao precisar de
    provider de embedding nem de Postgres.
    """
    async with pool.acquire() as conn:
        fontes, documentos, perguntas = await carregar_estado(conn, namespace)
        plano = planejar(fontes, documentos, perguntas)

        resultado = {
            "namespace": namespace,
            "dry_run": dry_run,
            "total_fontes": len(plano),
            "total_trechos": sum(item.trechos for item in plano),
            "fontes": [item.como_json() for item in plano],
            # Documentos que perdem os trechos por dividirem titulo com outro.
            # Consolidado aqui porque e dele que sai a marcacao no kb_document.
            "perdedores": [perdedor for item in plano for perdedor in item.colisao],
            "trechos_reprocessados": 0,
            "trechos_apagados": 0,
            "pulados": [],
            "fontes_com_erro": [],
        }

        for item in plano:
            try:
                await _passar_pela_fonte(
                    conn, namespace, item, dry_run, embed, chunk_hash, resultado
                )
            except Exception as exc:
                logger.error(f"reprocess falhou em source={item.source}: {exc}")
                resultado["fontes_com_erro"].append(
                    {"source": item.source, "erro": str(exc)}
                )

    logger.info(
        f"reprocess{' (dry-run)' if dry_run else ''} ns={namespace} "
        f"fontes={len(plano)} trechos={resultado['trechos_reprocessados']} "
        f"pulados={len(resultado['pulados'])} "
        f"apagados={resultado['trechos_apagados']} "
        f"erros={len(resultado['fontes_com_erro'])}"
    )
    return resultado


async def _passar_pela_fonte(
    conn, namespace: str, item: PlanoFonte, dry_run: bool, embed, chunk_hash, resultado
) -> None:
    """
    Decide o que acontece com uma fonte e, fora do dry-run, faz.

    A leitura dos trechos acontece nos dois modos de proposito: sem ela o
    dry-run nao teria como dizer quais fontes seriam puladas, e o operador
    aprovaria um plano com custo de embedding que nao existe. Ler e barato
    perto de reembedar; escrever continua sendo so fora do dry-run.
    """
    linhas = await conn.fetch(_SQL_TRECHOS, namespace, item.source)
    if not linhas:
        return

    if item.motivo == MOTIVO_LEGADO_DUPLICADO:
        resultado["trechos_apagados"] += (
            len(linhas) if dry_run else await _apagar_legado(conn, namespace, item)
        )
        return

    if ja_reprocessada(namespace, item, linhas, chunk_hash):
        resultado["pulados"].append(item.source)
        return

    if dry_run:
        return

    resultado["trechos_reprocessados"] += await _reprocessar_fonte(
        conn, namespace, item, linhas, embed, chunk_hash
    )


async def _apagar_legado(conn, namespace: str, item: PlanoFonte) -> int:
    """Ver o comentario de _SQL_APAGA_LEGADO: e a unica escrita destrutiva."""
    async with conn.transaction():
        retorno = await conn.execute(_SQL_APAGA_LEGADO, namespace, item.source)
    apagados = (
        int(str(retorno).split()[-1]) if str(retorno).startswith("DELETE ") else 0
    )
    logger.info(
        f"reprocess apagou o legado de doc ja migrado ns={namespace} "
        f"source={item.source} destino={item.novo_source} linhas={apagados}"
    )
    return apagados


async def _reprocessar_fonte(
    conn, namespace: str, item: PlanoFonte, linhas, embed, chunk_hash
) -> int:
    textos = [linha["text"] for linha in linhas]
    trechos = montar_trechos_do_plano(item, textos)
    vetores = await embed([t.embed for t in trechos], input_type="document")

    atualizacoes = []
    for linha, trecho, vetor in zip(linhas, trechos, vetores):
        antiga = _metadata_como_dict(linha["metadata"])

        atualizacoes.append(
            (
                linha["id"],
                item.novo_source,
                chunk_hash(
                    namespace,
                    item.novo_source,
                    int(linha["chunk_idx"]),
                    trecho.texto,
                    trecho.cabecalho,
                ),
                vetor,
                json.dumps({**antiga, "header": trecho.cabecalho}),
            )
        )

    # Uma transacao por fonte: o source muda junto com o vetor e o hash, e
    # nenhuma busca ve o documento meio migrado.
    async with conn.transaction():
        for argumentos in atualizacoes:
            await conn.execute(_SQL_ATUALIZA, *argumentos)
    return len(atualizacoes)
