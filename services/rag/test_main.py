"""
Testes do servico RAG.

Rodam sem Postgres, sem pgvector e sem provider de embedding: o pool do asyncpg
e trocado por um fake e as rotas exercitadas param antes de chamar Voyage/OpenAI
(ou tem o _embed_batch fakeado). Nenhum teste aqui toca rede.

Lifespan: o TestClient so dispara startup/shutdown quando usado como context
manager (`with TestClient(app)`). As fixtures instanciam direto, de proposito —
o startup abriria pool no Postgres e baixaria o BPE do cl100k_base do tiktoken.
"""

from contextlib import asynccontextmanager
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient

import main

NAMESPACE = "org_11111111-2222-3333-4444-555555555555"

# Sources reais de dois tipos. Os de cima sao o caso do #269: o source de um
# documento de texto e o TITULO que o cliente escreveu no /ai-training, e titulo
# com barra e comum (data, "e/ou", "s/ nota").
SOURCES_COM_BARRA = [
    "Contrato 14/07",
    "Politica de troca s/ nota fiscal",
]
SOURCES_SEM_BARRA = [
    "qa-abc123.txt",
    "Tabela-de-precos-2026.pdf",
]

# Os testes que NAO sao sobre roteamento usam um source sem barra de proposito:
# assim, se a rota voltar pra {source}, so os testes de roteamento quebram e o
# CI aponta uma causa em vez de seis.
SOURCE_SIMPLES = "qa-abc123.txt"


def _delete_url(namespace: str, source: str) -> str:
    """
    Monta a URL do jeito que o caller real monta: apps/api/src/services/
    ragService.ts usa encodeURIComponent(source), entao "Contrato 14/07" viaja
    como "Contrato%2014%2F07". quote(safe="") e o equivalente em Python.

    Isso importa: e a barra percent-encodada, decodificada de volta pro path
    antes do roteamento, que quebrava a rota. Testar com a barra crua na URL
    exercitaria outro caminho.
    """
    return f"/ingest/{quote(namespace, safe='')}/{quote(source, safe='')}"


# ─────────────────────────────────────────────────────────────────────────────
# Fakes
# ─────────────────────────────────────────────────────────────────────────────


class FakeConnection:
    """Conexao asyncpg de mentira: grava as queries e devolve um result string."""

    def __init__(self, result: str = "DELETE 3") -> None:
        self.result = result
        self.calls: list[tuple[str, tuple]] = []

    async def execute(self, sql: str, *args) -> str:
        self.calls.append((sql, args))
        return self.result


class FakePool:
    """So precisa de acquire() como async context manager."""

    def __init__(self, conn: FakeConnection) -> None:
        self.conn = conn

    @asynccontextmanager
    async def acquire(self):
        yield self.conn


class FakeTokenizer:
    """tiktoken de mentira, 1 char = 1 token. Evita baixar o BPE cl100k_base."""

    def encode(self, text: str) -> list[int]:
        return [ord(c) for c in text]

    def decode(self, tokens: list[int]) -> str:
        return "".join(chr(t) for t in tokens)


@pytest.fixture
def conn() -> FakeConnection:
    return FakeConnection()


@pytest.fixture
def client(conn, monkeypatch) -> TestClient:
    monkeypatch.setattr(main.state, "pool", FakePool(conn))
    return TestClient(main.app)


@pytest.fixture
def upserts(monkeypatch) -> list[dict]:
    """
    Fakeia tokenizer + embed + upsert e devolve a lista do que o /ingest teria
    gravado no pgvector.
    """
    gravados: list[dict] = []

    async def fake_embed_batch(texts, input_type):
        return [[0.0] * main.EMBEDDING_DIM for _ in texts]

    async def fake_upsert_chunks(namespace, source, chunks, vectors, metadata):
        gravados.append(
            {
                "namespace": namespace,
                "source": source,
                "chunks": chunks,
                "metadata": metadata,
            }
        )

    monkeypatch.setattr(main.state, "tokenizer", FakeTokenizer())
    monkeypatch.setattr(main, "_embed_batch", fake_embed_batch)
    monkeypatch.setattr(main, "_upsert_chunks", fake_upsert_chunks)
    return gravados


def _upload(
    name: str = "doc.txt",
    content: bytes = b"conteudo do documento",
    content_type: str = "text/plain",
) -> dict:
    return {"file": (name, content, content_type)}


# ─────────────────────────────────────────────────────────────────────────────
# DELETE /ingest/{namespace}/{source} — roteamento (regressao do #269)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("source", SOURCES_COM_BARRA + SOURCES_SEM_BARRA)
def test_delete_chega_no_handler_com_o_source_intacto(client, conn, source):
    """
    Regressao do #269 (499b7ff).

    A rota era {source}, que casa so com [^/]+. O uvicorn decodifica o %2F de
    volta pra "/" antes de rotear, entao titulo com barra nao casava e a rota
    devolvia 404. O caller trata o delete como best-effort, entao falhava em
    silencio e os chunks ficavam orfaos no vector store — com peso de LGPD Art.
    18, porque o titular pede exclusao e o dado continua indexado.

    Com {source:path} o source e capturado inteiro. Este teste exige que os
    quatro sources cheguem no handler EXATAMENTE como foram enviados.
    """
    resp = client.delete(_delete_url(NAMESPACE, source))

    assert resp.status_code == 200, f"rota nao casou com source={source!r}"
    assert resp.json()["source"] == source

    # E o handler tem que ter mandado o source verbatim pro DELETE, senao a
    # rota casa mas apaga a linha errada (ou nenhuma).
    assert len(conn.calls) == 1
    _sql, args = conn.calls[0]
    assert args == (NAMESPACE, source)


def test_url_de_delete_percent_encoda_a_barra():
    """
    Guarda o teste de cima. Se a barra fosse pra URL crua, o caso com barra
    passaria por outro caminho e a regressao do #269 deixaria de ser exercitada
    sem ninguem perceber.
    """
    assert _delete_url(NAMESPACE, "Contrato 14/07").endswith("/Contrato%2014%2F07")


# ─────────────────────────────────────────────────────────────────────────────
# DELETE — comportamento do handler
# ─────────────────────────────────────────────────────────────────────────────


def test_delete_reporta_quantidade_removida(client, conn):
    """O "DELETE 7" do asyncpg vira deleted=7 — e o que prova a exclusao."""
    conn.result = "DELETE 7"

    resp = client.delete(_delete_url(NAMESPACE, SOURCE_SIMPLES))

    assert resp.status_code == 200
    assert resp.json() == {
        "namespace": NAMESPACE,
        "source": SOURCE_SIMPLES,
        "deleted": 7,
    }


def test_delete_de_source_inexistente_responde_zero(client, conn):
    conn.result = "DELETE 0"

    resp = client.delete(_delete_url(NAMESPACE, "nunca-existiu.txt"))

    assert resp.status_code == 200
    assert resp.json()["deleted"] == 0


def test_delete_sem_pool_devolve_503(monkeypatch):
    """Sem DB o delete precisa falhar alto, nao devolver 200 sem apagar nada."""
    monkeypatch.setattr(main.state, "pool", None)
    client = TestClient(main.app)

    resp = client.delete(_delete_url(NAMESPACE, SOURCE_SIMPLES))

    assert resp.status_code == 503


def test_delete_e_escopado_no_namespace(client, conn):
    """Isolamento multi-tenant: o namespace sempre entra no WHERE."""
    client.delete(_delete_url(NAMESPACE, SOURCE_SIMPLES))

    sql, args = conn.calls[0]
    assert "namespace = $1" in sql
    assert "source = $2" in sql
    assert args[0] == NAMESPACE


# ─────────────────────────────────────────────────────────────────────────────
# Auth — X-Service-Secret
# ─────────────────────────────────────────────────────────────────────────────


def test_rotas_privadas_exigem_service_secret(monkeypatch, conn):
    """
    /query le e /ingest escreve a base de qualquer namespace: exposto sem
    segredo, da pra ler e envenenar dados de cliente.
    """
    monkeypatch.setattr(main, "RAG_SERVICE_SECRET", "segredo-de-teste")
    monkeypatch.setattr(main.state, "pool", FakePool(conn))
    client = TestClient(main.app)
    url = _delete_url(NAMESPACE, SOURCE_SIMPLES)

    assert client.delete(url).status_code == 401
    assert client.delete(url, headers={"x-service-secret": "errado"}).status_code == 401
    assert not conn.calls, "requisicao nao autorizada nao pode chegar no DB"

    ok = client.delete(url, headers={"x-service-secret": "segredo-de-teste"})
    assert ok.status_code == 200


def test_health_continua_publico_com_secret_ligado(monkeypatch):
    """/health e /ready sao probe do Fly: nao podem exigir header."""
    monkeypatch.setattr(main, "RAG_SERVICE_SECRET", "segredo-de-teste")
    client = TestClient(main.app)

    assert client.get("/health").status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# /query e /embed — validacao (para antes de chamar o provider de embedding)
# ─────────────────────────────────────────────────────────────────────────────


def test_query_rejeita_query_vazia(client):
    resp = client.post("/query", json={"query": "   ", "namespace": NAMESPACE})

    assert resp.status_code == 400


def test_query_rejeita_namespace_vazio(client):
    resp = client.post("/query", json={"query": "qual o horario?", "namespace": " "})

    assert resp.status_code == 400


def test_query_valida_faixa_do_top_k(client):
    """top_k tem ge=1/le=100 no pydantic — 0 e 101 sao 422 antes de qualquer I/O."""
    for top_k in (0, 101):
        resp = client.post(
            "/query",
            json={"query": "horario", "namespace": NAMESPACE, "top_k": top_k},
        )
        assert resp.status_code == 422, f"top_k={top_k} passou"


def test_embed_rejeita_text_vazio(client):
    resp = client.post("/embed", json={"text": "", "namespace": NAMESPACE})

    assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# /ingest — validacao
# ─────────────────────────────────────────────────────────────────────────────


def test_ingest_rejeita_namespace_vazio(client):
    resp = client.post("/ingest", files=_upload(), data={"namespace": " "})

    assert resp.status_code == 400


def test_ingest_rejeita_metadata_json_invalido(client):
    resp = client.post(
        "/ingest",
        files=_upload(),
        data={"namespace": NAMESPACE, "metadata": "{nao-e-json"},
    )

    assert resp.status_code == 400


def test_ingest_rejeita_metadata_que_nao_e_objeto(client):
    resp = client.post(
        "/ingest",
        files=_upload(),
        data={"namespace": NAMESPACE, "metadata": '["lista"]'},
    )

    assert resp.status_code == 400


def test_ingest_rejeita_content_type_nao_suportado(client):
    resp = client.post(
        "/ingest",
        files=_upload("planilha.xlsx", b"PK\x03\x04", "application/vnd.ms-excel"),
        data={"namespace": NAMESPACE},
    )

    assert resp.status_code == 415


def test_ingest_rejeita_arquivo_sem_texto(client):
    resp = client.post(
        "/ingest", files=_upload(content=b"   "), data={"namespace": NAMESPACE}
    )

    assert resp.status_code == 422


def test_ingest_respeita_limite_de_tamanho(client, monkeypatch):
    """MAX_UPLOAD_MB=0 faz qualquer arquivo estourar, sem subir 20MB no teste."""
    monkeypatch.setattr(main, "MAX_UPLOAD_MB", 0)

    resp = client.post(
        "/ingest", files=_upload(content=b"x" * 1024), data={"namespace": NAMESPACE}
    )

    assert resp.status_code == 413


# ─────────────────────────────────────────────────────────────────────────────
# /ingest — o source que entra e o mesmo que o delete precisa achar
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("source", SOURCES_COM_BARRA + SOURCES_SEM_BARRA)
def test_ingest_grava_o_source_verbatim(client, upserts, source):
    """
    Fecha o ciclo com o teste de roteamento: o source vai pro pgvector exatamente
    como o cliente escreveu, incluindo a barra. E essa string que o DELETE tem
    que casar depois — se uma das pontas normalizasse a barra, o delete nao
    acharia a linha.
    """
    resp = client.post(
        "/ingest",
        files=_upload(content=b"clausula primeira do contrato"),
        data={"namespace": NAMESPACE, "source": source},
    )

    assert resp.status_code == 200
    assert resp.json()["source"] == source
    assert len(upserts) == 1
    assert upserts[0]["source"] == source
    assert upserts[0]["namespace"] == NAMESPACE


def test_ingest_sem_source_usa_o_filename(client, upserts):
    resp = client.post(
        "/ingest",
        files=_upload(name="tabela-de-precos.txt", content=b"produto A: 10 reais"),
        data={"namespace": NAMESPACE},
    )

    assert resp.status_code == 200
    assert resp.json()["source"] == "tabela-de-precos.txt"
    assert upserts[0]["source"] == "tabela-de-precos.txt"
    assert upserts[0]["metadata"]["original_filename"] == "tabela-de-precos.txt"


def test_ingest_chunka_texto_longo(client, upserts):
    """
    CHUNK_TOKENS=512 com overlap 64 (step 448). Com o FakeTokenizer (1 char =
    1 token), 2000 chars tem que virar 5 chunks: 0-512, 448-960, 896-1408,
    1344-1856, 1792-2000.
    """
    resp = client.post(
        "/ingest",
        files=_upload(content=b"a" * 2000),
        data={"namespace": NAMESPACE, "source": "doc-longo.txt"},
    )

    assert resp.status_code == 200
    assert resp.json()["chunks_ingested"] == 5
    assert len(upserts[0]["chunks"]) == 5
