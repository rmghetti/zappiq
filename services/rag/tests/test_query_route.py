"""
Cola entre a rota e o retrieval.py: /query passa pelo re-rank novo e /ingest
respeita o trecho unico do Q&A (A011).

Sem banco, sem rede e sem embedding pago: o pool do asyncpg e o _embed_batch
sao fakes, igual ao test_main.py.
"""

from contextlib import asynccontextmanager

import main
import pytest
from fastapi.testclient import TestClient


class FakeFetchConnection:
    """Conexao que devolve linhas fixas no fetch (o KNN do pgvector)."""

    def __init__(self, rows: list[dict]) -> None:
        self.rows = rows
        self.fetches: list[tuple] = []

    async def fetch(self, sql: str, *args):
        self.fetches.append((sql, args))
        return self.rows

    async def execute(self, sql: str, *args) -> str:
        return "DELETE 0"


class FakePool:
    def __init__(self, conn) -> None:
        self.conn = conn

    @asynccontextmanager
    async def acquire(self):
        yield self.conn


def _row(id_, text, source, chunk_idx, similarity, chunk_hash, metadata=None):
    return {
        "id": id_,
        "text": text,
        "source": source,
        "chunk_idx": chunk_idx,
        "chunk_hash": chunk_hash,
        "metadata": metadata or {},
        "similarity": similarity,
    }


@pytest.fixture
def sem_embedding(monkeypatch):
    async def fake_embed_batch(texts, input_type):
        return [[0.0] * main.EMBEDDING_DIM for _ in texts]

    monkeypatch.setattr(main, "_embed_batch", fake_embed_batch)


def _client(monkeypatch, rows):
    conn = FakeFetchConnection(rows)
    monkeypatch.setattr(main.state, "pool", FakePool(conn))
    return TestClient(main.app), conn


def test_query_limita_a_dois_trechos_por_fonte(monkeypatch, sem_embedding):
    rows = [
        _row(
            f"id{i}",
            f"trecho numero {i} do manual",
            "manual.pdf",
            i,
            0.90 - i * 0.01,
            f"h{i}",
        )
        for i in range(5)
    ]
    rows.append(_row("outro", "assunto diferente do faq", "faq.pdf", 0, 0.70, "hf"))
    client, _ = _client(monkeypatch, rows)

    resp = client.post(
        "/query",
        json={
            "query": "manual",
            "namespace": "org_x",
            "top_k": 5,
            "min_similarity": 0.3,
        },
    )
    assert resp.status_code == 200
    fontes = [r["source"] for r in resp.json()["results"]]
    assert fontes.count("manual.pdf") == 2
    assert "faq.pdf" in fontes


def test_query_deduplica_texto_colado_sob_dois_titulos(monkeypatch, sem_embedding):
    texto = "Atendemos de segunda a sexta das 9h as 18h e no sabado ate as 12h."
    rows = [
        _row("a", texto, "DOSSIE ESTRATEGICO CMJ", 0, 0.80, "h1"),
        _row("b", texto, "Mapeamento de Oportunidades", 0, 0.79, "h2"),
        _row(
            "c",
            "outro conteudo completamente distinto do primeiro",
            "faq.pdf",
            0,
            0.60,
            "h3",
        ),
    ]
    client, _ = _client(monkeypatch, rows)

    resp = client.post(
        "/query",
        json={
            "query": "horario",
            "namespace": "org_x",
            "top_k": 5,
            "min_similarity": 0.3,
        },
    )
    ids = [r["id"] for r in resp.json()["results"]]
    assert ids == ["a", "c"]


def test_query_usa_prioridade_do_qa_como_desempate(monkeypatch, sem_embedding):
    rows = [
        _row(
            "baixa",
            "resposta comum sobre entrega",
            "qa-1.txt",
            0,
            0.70,
            "h1",
            {"priority": 0},
        ),
        _row(
            "alta",
            "resposta oficial sobre garantia",
            "qa-2.txt",
            0,
            0.70,
            "h2",
            {"priority": 10},
        ),
    ]
    client, _ = _client(monkeypatch, rows)

    resp = client.post(
        "/query",
        json={
            "query": "garantia",
            "namespace": "org_x",
            "top_k": 2,
            "min_similarity": 0.3,
        },
    )
    assert [r["id"] for r in resp.json()["results"]] == ["alta", "baixa"]


def test_query_le_chunk_hash_e_metadata_do_banco(monkeypatch, sem_embedding):
    rows = [_row("a", "texto qualquer", "manual.pdf", 0, 0.80, "h1")]
    client, conn = _client(monkeypatch, rows)
    client.post(
        "/query",
        json={"query": "x", "namespace": "org_x", "top_k": 5, "min_similarity": 0.3},
    )
    sql = conn.fetches[0][0]
    assert "chunk_hash" in sql
    assert "metadata" in sql


def test_query_sem_nada_acima_do_corte_devolve_lista_vazia(monkeypatch, sem_embedding):
    rows = [_row("a", "texto irrelevante", "manual.pdf", 0, 0.20, "h1")]
    client, _ = _client(monkeypatch, rows)
    resp = client.post(
        "/query",
        json={"query": "x", "namespace": "org_x", "top_k": 5, "min_similarity": 0.35},
    )
    assert resp.status_code == 200
    assert resp.json()["results"] == []


# ─────────────────────────────────────────────────────────────────────────────
# Quem manda no corte e a API (I1 da revisao do PR #365)
# ─────────────────────────────────────────────────────────────────────────────


def test_query_respeita_o_corte_que_a_api_pediu(monkeypatch, sem_embedding):
    """
    O _knn_search ja aplicava o corte pedido pela API, mas entregava ao rerank
    uma config lida do env do PROPRIO servico, e o rerank re-aplicava o
    cfg.min_similarity dele por cima. O piso efetivo virava o maior dos dois, e
    baixar o corte por env na API (o rollback previsto) nao tinha efeito
    nenhum. Este teste exercita a rota inteira, nao a funcao pura.
    """
    rows = [_row("a", "resposta sobre garantia estendida", "faq.pdf", 0, 0.30, "h1")]
    client, _ = _client(monkeypatch, rows)

    resp = client.post(
        "/query",
        json={
            "query": "garantia",
            "namespace": "org_x",
            "top_k": 5,
            "min_similarity": 0.25,
        },
    )
    assert resp.status_code == 200
    assert [r["id"] for r in resp.json()["results"]] == ["a"]


def test_query_o_piso_do_servico_aperta_o_corte_da_api(monkeypatch, sem_embedding):
    """O FLOOR do servico continua valendo: ele so aperta, nunca solta."""
    monkeypatch.setenv("RAG_MIN_SIMILARITY_FLOOR", "0.40")
    rows = [
        _row(
            "forte", "trecho claramente do assunto perguntado", "faq.pdf", 1, 0.50, "h2"
        ),
        _row("fraco", "trecho de similaridade media", "faq.pdf", 0, 0.30, "h1"),
    ]
    client, _ = _client(monkeypatch, rows)

    resp = client.post(
        "/query",
        json={
            "query": "garantia",
            "namespace": "org_x",
            "top_k": 5,
            "min_similarity": 0.25,
        },
    )
    assert resp.status_code == 200
    assert [r["id"] for r in resp.json()["results"]] == ["forte"]


def test_query_o_env_do_servico_nao_manda_mais_no_corte(monkeypatch, sem_embedding):
    """
    RAG_MIN_SIMILARITY no servico e so o valor de partida da config. Quem decide
    o corte e a API, pelo corpo do /query. Antes este env apertava tudo por
    dentro do rerank, sem aparecer em lugar nenhum.
    """
    monkeypatch.setenv("RAG_MIN_SIMILARITY", "0.80")
    rows = [_row("a", "resposta sobre garantia estendida", "faq.pdf", 0, 0.40, "h1")]
    client, _ = _client(monkeypatch, rows)

    resp = client.post(
        "/query",
        json={
            "query": "garantia",
            "namespace": "org_x",
            "top_k": 5,
            "min_similarity": 0.30,
        },
    )
    assert resp.status_code == 200
    assert [r["id"] for r in resp.json()["results"]] == ["a"]


# ─────────────────────────────────────────────────────────────────────────────
# /ingest com trecho unico (A011)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture
def upserts(monkeypatch):
    gravados: list[dict] = []

    class FakeTokenizer:
        def encode(self, text):
            return [ord(c) for c in text]

        def decode(self, tokens):
            return "".join(chr(t) for t in tokens)

    async def fake_embed_batch(texts, input_type):
        return [[0.0] * main.EMBEDDING_DIM for _ in texts]

    # O /ingest grava Trecho (texto original + cabecalho de contexto), nao
    # string crua: o cabecalho entra so no texto que vai para o embedding.
    async def fake_upsert_chunks(namespace, source, trechos, vectors, metadata):
        gravados.append(
            {
                "source": source,
                "chunks": [t.texto for t in trechos],
                "cabecalhos": [t.cabecalho for t in trechos],
                "metadata": metadata,
            }
        )
        return len(trechos)

    monkeypatch.setattr(main.state, "tokenizer", FakeTokenizer())
    monkeypatch.setattr(main, "_embed_batch", fake_embed_batch)
    monkeypatch.setattr(main, "_upsert_chunks", fake_upsert_chunks)
    return gravados


@pytest.fixture
def ingest_client(monkeypatch):
    monkeypatch.setattr(main.state, "pool", FakePool(FakeFetchConnection([])))
    return TestClient(main.app)


# A resposta do Q&A pode ter 4.000 caracteres e o chunk e de 512 tokens: sem o
# trecho unico o par vira 2 ou 3 pedacos e so o primeiro carrega 'Pergunta:'.
QA_LONGO = "Pergunta: voces entregam no interior?\n\nResposta: " + (
    "sim, entregamos. " * 200
)


def test_qa_longo_vira_um_trecho_so(ingest_client, upserts):
    resp = ingest_client.post(
        "/ingest",
        data={"namespace": "org_x", "source": "qa-abc123.txt", "single_chunk": "true"},
        files={"file": ("qa-abc123.txt", QA_LONGO.encode("utf-8"), "text/plain")},
    )
    assert resp.status_code == 200
    assert len(upserts[0]["chunks"]) == 1
    assert upserts[0]["chunks"][0].startswith("Pergunta:")


def test_source_qa_vira_trecho_unico_mesmo_sem_o_sinalizador(ingest_client, upserts):
    """API antiga (sem o campo single_chunk) tambem para de fatiar Q&A."""
    resp = ingest_client.post(
        "/ingest",
        data={"namespace": "org_x", "source": "qa-abc123.txt"},
        files={"file": ("qa-abc123.txt", QA_LONGO.encode("utf-8"), "text/plain")},
    )
    assert resp.status_code == 200
    assert len(upserts[0]["chunks"]) == 1


def test_documento_comum_continua_sendo_fatiado(ingest_client, upserts):
    texto = "paragrafo longo do manual. " * 400
    resp = ingest_client.post(
        "/ingest",
        data={"namespace": "org_x", "source": "manual.txt"},
        files={"file": ("manual.txt", texto.encode("utf-8"), "text/plain")},
    )
    assert resp.status_code == 200
    assert len(upserts[0]["chunks"]) > 1


def test_prioridade_e_categoria_do_qa_chegam_na_metadata(ingest_client, upserts):
    resp = ingest_client.post(
        "/ingest",
        data={
            "namespace": "org_x",
            "source": "qa-abc123.txt",
            "single_chunk": "true",
            "metadata": '{"kind":"qa","priority":7,"category":"entrega"}',
        },
        files={"file": ("qa-abc123.txt", b"Pergunta: x\n\nResposta: y", "text/plain")},
    )
    assert resp.status_code == 200
    assert upserts[0]["metadata"]["priority"] == 7
    assert upserts[0]["metadata"]["category"] == "entrega"
