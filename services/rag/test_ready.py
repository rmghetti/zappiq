"""
/ready confere a dimensao do embedding com a coluna do banco (achado A018).

Producao embeda com OpenAI em 1536 dimensoes e a coluna rag_chunks.embedding e
vector(1536), mas o fly.toml do repositorio fixa voyage-3 em 1024. Um deploy
que fizesse valer o arquivo passaria a embedar em 1024 contra uma coluna de
1536: toda ingestao e toda busca quebrariam, e nao havia teste nem alarme.

Agora o /ready diz as duas dimensoes e fica not_ready quando divergem. O smoke
do deploy (fly-deploy.yml) le esses dois campos e derruba o deploy.
"""

from contextlib import asynccontextmanager

import pytest
from fastapi.testclient import TestClient

import main


class FakeConnection:
    def __init__(self, tipo_da_coluna: str | None = "vector(1536)") -> None:
        self.tipo_da_coluna = tipo_da_coluna

    async def execute(self, _sql: str, *_args) -> str:
        return "SELECT 1"

    async def fetchval(self, _sql: str, *_args):
        if isinstance(self.tipo_da_coluna, Exception):
            raise self.tipo_da_coluna
        return self.tipo_da_coluna


class FakePool:
    def __init__(self, conn: FakeConnection) -> None:
        self.conn = conn

    @asynccontextmanager
    async def acquire(self):
        yield self.conn


@pytest.fixture
def com_coluna(monkeypatch):
    def montar(tipo):
        monkeypatch.setattr(main.state, "pool", FakePool(FakeConnection(tipo)))
        monkeypatch.setattr(main, "EMBEDDING_PROVIDER", "openai")
        monkeypatch.setattr(main, "OPENAI_API_KEY", "chave-de-teste")
        return TestClient(main.app)

    return montar


def test_ready_expoe_a_dimensao_do_provider_e_a_da_coluna(com_coluna, monkeypatch):
    monkeypatch.setattr(main, "EMBEDDING_DIM", 1536)
    client = com_coluna("vector(1536)")

    corpo = client.get("/ready").json()

    assert corpo["status"] == "ready"
    assert corpo["checks"]["embedding"]["embedding_dim"] == 1536
    assert corpo["checks"]["embedding"]["coluna_dim"] == 1536
    assert corpo["checks"]["embedding"]["ok"] is True


def test_ready_fica_not_ready_quando_a_dimensao_diverge(com_coluna, monkeypatch):
    """1024 do fly.toml contra 1536 da coluna: o servico nao pode subir calado."""
    monkeypatch.setattr(main, "EMBEDDING_DIM", 1024)
    client = com_coluna("vector(1536)")

    resposta = client.get("/ready")
    corpo = resposta.json()

    assert corpo["status"] == "not_ready"
    assert corpo["checks"]["embedding"]["ok"] is False
    assert corpo["checks"]["embedding"]["embedding_dim"] == 1024
    assert corpo["checks"]["embedding"]["coluna_dim"] == 1536


def test_coluna_ilegivel_nao_derruba_o_ready(com_coluna, monkeypatch):
    """
    Se a consulta ao catalogo falhar (tabela ainda nao criada, permissao), a
    checagem informa o erro e nao inventa divergencia: derrubar o /ready por
    isso tiraria a maquina do ar sem motivo.
    """
    monkeypatch.setattr(main, "EMBEDDING_DIM", 1536)
    client = com_coluna(RuntimeError("relation rag_chunks does not exist"))

    corpo = client.get("/ready").json()

    assert corpo["status"] == "ready"
    assert corpo["checks"]["embedding"]["coluna_dim"] is None
    assert "rag_chunks" in corpo["checks"]["embedding"]["coluna_erro"]


def test_ready_sem_pool_continua_not_ready(monkeypatch):
    monkeypatch.setattr(main.state, "pool", None)
    client = TestClient(main.app)

    assert client.get("/ready").json()["status"] == "not_ready"


# ─────────────────────────────────────────────────────────────────────────────
# Capacidades anunciadas: o que este serviço sabe extrair
# ─────────────────────────────────────────────────────────────────────────────


def test_ready_anuncia_os_extratores_que_este_servico_tem(com_coluna, monkeypatch):
    """
    A API decide o que mandar para o /ingest olhando esta lista. Sem ela, a
    API nova contra o RAG velho mandaria HTML cru, e o RAG velho gravaria a
    página inteira (script, menu e rodapé) no vetor, com selo verde na tela.
    """
    monkeypatch.setattr(main, "EMBEDDING_DIM", 1536)
    client = com_coluna("vector(1536)")

    corpo = client.get("/ready").json()

    assert corpo["extratores"] == ["pdf", "docx", "xlsx", "html", "texto"]


def test_extratores_aparecem_mesmo_com_o_servico_not_ready(monkeypatch):
    """
    A capacidade é do código, não do estado do banco. Uma máquina sem pool
    ainda sabe dizer o que sabe ler, e a API precisa dessa resposta para
    escolher o caminho.
    """
    monkeypatch.setattr(main.state, "pool", None)
    client = TestClient(main.app)

    corpo = client.get("/ready").json()

    assert corpo["status"] == "not_ready"
    assert "html" in corpo["extratores"]


# ─────────────────────────────────────────────────────────────────────────────
# Cache da dimensão da coluna
# ─────────────────────────────────────────────────────────────────────────────


class ConexaoQueConta(FakeConnection):
    def __init__(self, tipo_da_coluna: str | None = "vector(1536)") -> None:
        super().__init__(tipo_da_coluna)
        self.consultas = 0

    async def fetchval(self, sql: str, *args):
        self.consultas += 1
        return await super().fetchval(sql, *args)


def test_dimensao_da_coluna_e_lida_uma_vez_so(monkeypatch):
    """O Fly bate no /ready a cada 15s: ler o catálogo toda vez é desperdício."""
    conexao = ConexaoQueConta("vector(1536)")
    monkeypatch.setattr(main.state, "pool", FakePool(conexao))
    monkeypatch.setattr(main, "EMBEDDING_PROVIDER", "openai")
    monkeypatch.setattr(main, "OPENAI_API_KEY", "chave-de-teste")
    monkeypatch.setattr(main, "EMBEDDING_DIM", 1536)
    client = TestClient(main.app)

    primeira = client.get("/ready").json()
    segunda = client.get("/ready").json()

    assert primeira["checks"]["embedding"]["coluna_dim"] == 1536
    assert segunda["checks"]["embedding"]["coluna_dim"] == 1536
    assert conexao.consultas == 1


def test_erro_na_leitura_do_catalogo_nao_vira_cache(monkeypatch):
    """Tabela ainda não criada não pode congelar o serviço em 'não sei'."""
    conexao = ConexaoQueConta(RuntimeError("relation rag_chunks does not exist"))
    monkeypatch.setattr(main.state, "pool", FakePool(conexao))
    monkeypatch.setattr(main, "EMBEDDING_PROVIDER", "openai")
    monkeypatch.setattr(main, "OPENAI_API_KEY", "chave-de-teste")
    monkeypatch.setattr(main, "EMBEDDING_DIM", 1536)
    client = TestClient(main.app)

    client.get("/ready")
    client.get("/ready")

    assert conexao.consultas == 2


def test_ready_responde_200_mesmo_quando_nao_esta_pronto(com_coluna, monkeypatch):
    """
    Documenta a verdade, para ninguém contar com o que não acontece: o corpo
    diz not_ready, mas o status HTTP continua 200, então o health check do Fly
    considera a máquina saudável e NÃO a tira de rotação. Quem barra um deploy
    com dimensão divergente é o smoke do fly-deploy.yml, que lê este corpo.
    Mudar o status HTTP mexe na disponibilidade e é decisão à parte.
    """
    monkeypatch.setattr(main, "EMBEDDING_DIM", 1024)
    client = com_coluna("vector(1536)")

    resposta = client.get("/ready")

    assert resposta.status_code == 200
    assert resposta.json()["status"] == "not_ready"
