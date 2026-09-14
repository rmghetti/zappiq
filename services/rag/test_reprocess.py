"""
Reprocessamento da base que ja existe, sem pedir reenvio ao cliente (P64).

Dois problemas cabem na mesma passada:
  1. Os trechos entraram sem dizer de que documento vem (177 de 184 sem o
     titulo). O cabecalho conserta isso, e da para montar a partir do proprio
     rag_chunks.text, sem os originais que nunca foram guardados (A198).
  2. O source e o TITULO do documento. Dois documentos com o mesmo titulo
     dividem o mesmo source e um apaga os trechos do outro (A001). Trocar o
     source por doc-<id> separa os dois.

O plano e calculado por funcao pura (`planejar`), entao o teste nao precisa de
Postgres. O dry-run roda pela rota com um banco falso e prova que nada e
escrito.
"""

from contextlib import asynccontextmanager
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

import main
import reprocess

NS = "org_cmo1yrbb600441jsk7yxf3vbb"


def _doc(id_, titulo, tipo="application/pdf", url=None, dia=1):
    return reprocess.Documento(
        id=id_,
        titulo=titulo,
        tipo=tipo,
        url=url,
        criado_em=datetime(2026, 7, dia),
    )


def _fonte(source, trechos=3):
    return reprocess.Fonte(source=source, trechos=trechos)


# ─────────────────────────────────────────────────────────────────────────────
# Plano: de titulo para doc-<id>
# ─────────────────────────────────────────────────────────────────────────────


def test_source_por_titulo_vira_doc_do_id():
    plano = reprocess.planejar(
        [_fonte("Ementa Conselho do Futuro.pdf", trechos=8)],
        [_doc("ckabc123", "Ementa Conselho do Futuro.pdf")],
        {},
    )

    assert len(plano) == 1
    assert plano[0].source == "Ementa Conselho do Futuro.pdf"
    assert plano[0].novo_source == "doc-ckabc123"
    assert plano[0].titulo == "Ementa Conselho do Futuro.pdf"
    assert plano[0].trechos == 8


def test_url_casa_pela_derivacao_de_hostname_e_caminho():
    """
    O titulo do documento de URL e a URL inteira, mas o source e
    hostname+caminho (urlToSource no ragService). Sem essa derivacao a fonte
    ficaria orfa e os trechos nunca seriam migrados (achado A002).
    """
    plano = reprocess.planejar(
        [_fonte("cmj.com.br/cursos")],
        [
            _doc(
                "ckurl1",
                "https://cmj.com.br/cursos/",
                tipo="url",
                url="https://cmj.com.br/cursos/",
            )
        ],
        {},
    )

    assert plano[0].novo_source == "doc-ckurl1"


def test_titulo_repetido_fica_com_o_documento_mais_recente():
    """
    Os trechos que sobraram sao os da ultima ingestao, porque a ingestao apaga
    o source antes de gravar. Entao eles pertencem ao documento mais novo. O
    antigo passa a aparecer como nao indexado, que e a verdade.
    """
    plano = reprocess.planejar(
        [_fonte("Proposta.pdf", trechos=5)],
        [
            _doc("ckantigo", "Proposta.pdf", dia=1),
            _doc("cknovo", "Proposta.pdf", dia=20),
        ],
        {},
    )

    assert plano[0].novo_source == "doc-cknovo"
    # O perdedor sai identificado: o operador precisa saber QUAL documento vai
    # ficar sem trechos, e "ckantigo" sozinho nao diz nada a ninguem.
    assert plano[0].colisao == [
        {
            "id": "ckantigo",
            "titulo": "Proposta.pdf",
            "criado_em": "2026-07-01T00:00:00",
        }
    ]


def test_qa_mantem_o_source_e_ganha_a_pergunta_no_cabecalho():
    plano = reprocess.planejar(
        [_fonte("qa-ckqa1.txt", trechos=3)],
        [],
        {"ckqa1": "Vocês dão desconto?"},
    )

    assert plano[0].novo_source == "qa-ckqa1.txt"
    assert plano[0].pergunta == "Vocês dão desconto?"
    assert plano[0].motivo == "qa"


def test_fonte_sem_documento_mantem_o_source_e_ganha_so_o_cabecalho():
    """Questionário e agendamento não têm kb_document: não há id para migrar."""
    plano = reprocess.planejar([_fonte("onboarding-survey-clinica.txt")], [], {})

    assert plano[0].novo_source == "onboarding-survey-clinica.txt"
    assert plano[0].motivo == "sem documento"
    # O hifen fica: em "onboarding-survey" ele faz parte do nome.
    assert plano[0].titulo == "onboarding-survey-clinica"


def test_fonte_ja_migrada_nao_muda_de_nome():
    plano = reprocess.planejar(
        [_fonte("doc-ckabc123")], [_doc("ckabc123", "Ementa.pdf")], {}
    )

    assert plano[0].novo_source == "doc-ckabc123"
    assert plano[0].motivo == "já migrado"
    assert plano[0].titulo == "Ementa.pdf"


def test_plano_e_estavel_na_ordem():
    plano = reprocess.planejar(
        [_fonte("b.pdf"), _fonte("a.pdf")],
        [_doc("id-b", "b.pdf"), _doc("id-a", "a.pdf")],
        {},
    )

    assert [p.source for p in plano] == ["a.pdf", "b.pdf"]


# ─────────────────────────────────────────────────────────────────────────────
# Trechos reprocessados
# ─────────────────────────────────────────────────────────────────────────────


def test_monta_cabecalho_por_trecho_e_preserva_o_texto():
    item = reprocess.PlanoFonte(
        source="Tabela_de_precos_v2.pdf",
        novo_source="doc-ck1",
        titulo="Tabela_de_precos_v2.pdf",
        trechos=2,
        motivo="documento",
    )

    trechos = reprocess.montar_trechos_do_plano(
        item, ["## Preços\nCurso A: 1200", "texto sem título"]
    )

    assert trechos[0].cabecalho == "Documento: Tabela de precos. Seção: Preços."
    assert trechos[1].cabecalho == "Documento: Tabela de precos."
    assert trechos[0].texto == "## Preços\nCurso A: 1200"


# ─────────────────────────────────────────────────────────────────────────────
# Rota administrativa, com banco falso
# ─────────────────────────────────────────────────────────────────────────────


class FakeConnection:
    """Responde as tres consultas do plano e registra tudo que foi executado."""

    def __init__(self) -> None:
        self.executados: list[str] = []
        self.fontes = [{"source": "Proposta.pdf", "trechos": 2}]
        self.documentos = [
            {
                "id": "ckantigo",
                "title": "Proposta.pdf",
                "sourceType": "application/pdf",
                "sourceUrl": None,
                "createdAt": datetime(2026, 7, 1),
            },
            {
                "id": "cknovo",
                "title": "Proposta.pdf",
                "sourceType": "application/pdf",
                "sourceUrl": None,
                "createdAt": datetime(2026, 7, 20),
            },
        ]
        self.qa = [{"id": "ckqa1", "question": "Vocês dão desconto?"}]
        self.chunks = [
            {
                "id": "uuid-1",
                "chunk_idx": 0,
                "text": "## Preços\nCurso A",
                "metadata": "{}",
                "chunk_hash": "hash-antigo-1",
            },
            {
                "id": "uuid-2",
                "chunk_idx": 1,
                "text": "continuação",
                "metadata": "{}",
                "chunk_hash": "hash-antigo-2",
            },
        ]

    async def fetch(self, sql: str, *_args):
        self.executados.append(sql)
        if "GROUP BY source" in sql:
            return self.fontes
        if "kb_documents" in sql:
            return self.documentos
        if "qa_pairs" in sql:
            return self.qa
        if "FROM rag_chunks" in sql:
            return self.chunks
        raise AssertionError(f"consulta inesperada: {sql}")

    async def execute(self, sql: str, *_args):
        self.executados.append(sql)
        return "UPDATE 1"

    async def fetchval(self, sql: str, *_args):
        self.executados.append(sql)
        return None

    def transaction(self):
        @asynccontextmanager
        async def _tx():
            yield

        return _tx()


class FakePool:
    def __init__(self, conn: FakeConnection) -> None:
        self.conn = conn

    @asynccontextmanager
    async def acquire(self):
        yield self.conn


@pytest.fixture
def conexao() -> FakeConnection:
    return FakeConnection()


@pytest.fixture
def client(conexao, monkeypatch) -> TestClient:
    monkeypatch.setattr(main.state, "pool", FakePool(conexao))

    async def embed_falso(texts, input_type):
        return [[0.0] * main.EMBEDDING_DIM for _ in texts]

    monkeypatch.setattr(main, "_embed_batch", embed_falso)
    return TestClient(main.app)


def test_dry_run_devolve_o_plano_sem_escrever(client, conexao):
    resposta = client.post("/admin/reprocess", json={"namespace": NS, "dry_run": True})

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["dry_run"] is True
    assert corpo["total_trechos"] == 2
    assert corpo["fontes"][0]["source"] == "Proposta.pdf"
    assert corpo["fontes"][0]["novo_source"] == "doc-cknovo"
    assert corpo["fontes"][0]["colisao"] == [
        {
            "id": "ckantigo",
            "titulo": "Proposta.pdf",
            "criado_em": "2026-07-01T00:00:00",
        }
    ]
    # Lista consolidada: e dela que sai o UPDATE de kb_document documentado no
    # corpo do PR, sem o operador ter que varrer fonte por fonte.
    assert corpo["perdedores"] == corpo["fontes"][0]["colisao"]
    assert corpo["trechos_reprocessados"] == 0

    assert not any("UPDATE" in sql.upper() for sql in conexao.executados), (
        "dry-run não pode escrever no vetor"
    )


def test_dry_run_e_o_padrao_quando_o_corpo_nao_diz(client, conexao):
    """Escrever no vetor de produção não pode ser o comportamento omisso."""
    resposta = client.post("/admin/reprocess", json={"namespace": NS})

    assert resposta.json()["dry_run"] is True
    assert not any("UPDATE" in sql.upper() for sql in conexao.executados)


def test_execucao_real_troca_o_source_e_grava_o_cabecalho(client, conexao):
    resposta = client.post("/admin/reprocess", json={"namespace": NS, "dry_run": False})

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["dry_run"] is False
    assert corpo["trechos_reprocessados"] == 2

    updates = [sql for sql in conexao.executados if "UPDATE rag_chunks" in sql]
    assert len(updates) == 2
    assert "source" in updates[0]
    assert "chunk_hash" in updates[0]
    assert "embedding" in updates[0]
    assert "metadata" in updates[0]


def test_namespace_vazio_e_recusado(client):
    assert client.post("/admin/reprocess", json={"namespace": "  "}).status_code == 400


def test_rota_administrativa_exige_o_segredo_de_servico(conexao, monkeypatch):
    monkeypatch.setattr(main, "RAG_SERVICE_SECRET", "segredo-de-teste")
    monkeypatch.setattr(main.state, "pool", FakePool(conexao))
    client = TestClient(main.app)

    semvel = client.post("/admin/reprocess", json={"namespace": NS})

    assert semvel.status_code == 401
    assert not conexao.executados


# ─────────────────────────────────────────────────────────────────────────────
# Não reembedar o que já está pronto (custo de embedding é dinheiro)
# ─────────────────────────────────────────────────────────────────────────────


def _linha(idx, texto, cabecalho, novo_source, namespace=NS):
    """Uma linha de rag_chunks já reprocessada, com o hash que ela teria."""
    return {
        "id": f"uuid-{idx}",
        "chunk_idx": idx,
        "text": texto,
        "metadata": {"header": cabecalho},
        "chunk_hash": main._chunk_hash(namespace, novo_source, idx, texto, cabecalho),
    }


def test_fonte_com_cabecalho_e_hash_iguais_e_pulada():
    """
    Rodar o reprocessamento duas vezes não pode custar dois embeddings. Se o
    cabeçalho já está gravado e o hash recalculado bate com o gravado, não há
    nada a fazer nesta fonte.
    """
    item = reprocess.PlanoFonte(
        source="doc-ck1",
        novo_source="doc-ck1",
        titulo="Ementa.pdf",
        trechos=1,
        motivo="já migrado",
    )
    trechos = reprocess.montar_trechos_do_plano(item, ["texto do trecho"])
    linhas = [_linha(0, "texto do trecho", trechos[0].cabecalho, "doc-ck1")]

    assert reprocess.ja_reprocessada(NS, item, linhas, main._chunk_hash) is True


def test_fonte_sem_cabecalho_no_metadata_nao_e_pulada():
    item = reprocess.PlanoFonte(
        source="doc-ck1",
        novo_source="doc-ck1",
        titulo="Ementa.pdf",
        trechos=1,
        motivo="já migrado",
    )
    linhas = [
        {
            "id": "uuid-0",
            "chunk_idx": 0,
            "text": "texto do trecho",
            "metadata": {},
            "chunk_hash": "qualquer",
        }
    ]

    assert reprocess.ja_reprocessada(NS, item, linhas, main._chunk_hash) is False


def test_fonte_que_muda_de_source_nao_e_pulada():
    """O hash inclui o source: trocar de nome muda o hash de todo trecho."""
    item = reprocess.PlanoFonte(
        source="Proposta.pdf",
        novo_source="doc-ck1",
        titulo="Proposta.pdf",
        trechos=1,
        motivo="documento",
    )
    trechos = reprocess.montar_trechos_do_plano(item, ["texto do trecho"])
    # Gravado com o source ANTIGO: o hash não bate com o novo.
    linhas = [_linha(0, "texto do trecho", trechos[0].cabecalho, "Proposta.pdf")]

    assert reprocess.ja_reprocessada(NS, item, linhas, main._chunk_hash) is False


def test_um_trecho_fora_do_lugar_reprocessa_a_fonte_inteira():
    item = reprocess.PlanoFonte(
        source="doc-ck1",
        novo_source="doc-ck1",
        titulo="Ementa.pdf",
        trechos=2,
        motivo="já migrado",
    )
    trechos = reprocess.montar_trechos_do_plano(item, ["primeiro", "segundo"])
    linhas = [
        _linha(0, "primeiro", trechos[0].cabecalho, "doc-ck1"),
        {
            "id": "uuid-1",
            "chunk_idx": 1,
            "text": "segundo",
            "metadata": {"header": "cabeçalho de outra versão"},
            "chunk_hash": "hash-que-nao-bate",
        },
    ]

    assert reprocess.ja_reprocessada(NS, item, linhas, main._chunk_hash) is False


class ConexaoJaReprocessada(FakeConnection):
    """Base em que tudo já foi migrado: nada a reembedar."""

    def __init__(self) -> None:
        super().__init__()
        self.fontes = [{"source": "doc-cknovo", "trechos": 1}]
        self.documentos = [
            {
                "id": "cknovo",
                "title": "Proposta.pdf",
                "sourceType": "application/pdf",
                "sourceUrl": None,
                "createdAt": datetime(2026, 7, 20),
            }
        ]
        self.qa = []
        item = reprocess.PlanoFonte(
            source="doc-cknovo",
            novo_source="doc-cknovo",
            titulo="Proposta.pdf",
            trechos=1,
            motivo="já migrado",
        )
        cabecalho = reprocess.montar_trechos_do_plano(item, ["texto"])[0].cabecalho
        self.chunks = [_linha(0, "texto", cabecalho, "doc-cknovo")]


def test_execucao_pula_o_que_ja_esta_pronto_e_nao_embeda(monkeypatch):
    conexao = ConexaoJaReprocessada()
    monkeypatch.setattr(main.state, "pool", FakePool(conexao))
    embeddings: list[list[str]] = []

    async def embed_falso(texts, input_type):
        embeddings.append(list(texts))
        return [[0.0] * main.EMBEDDING_DIM for _ in texts]

    monkeypatch.setattr(main, "_embed_batch", embed_falso)
    client = TestClient(main.app)

    corpo = client.post(
        "/admin/reprocess", json={"namespace": NS, "dry_run": False}
    ).json()

    assert corpo["pulados"] == ["doc-cknovo"]
    assert corpo["trechos_reprocessados"] == 0
    assert embeddings == [], "fonte pulada não pode custar embedding"
    assert not any("UPDATE rag_chunks" in sql for sql in conexao.executados)


def test_dry_run_ja_mostra_o_que_seria_pulado(monkeypatch):
    conexao = ConexaoJaReprocessada()
    monkeypatch.setattr(main.state, "pool", FakePool(conexao))

    async def embed_falso(texts, input_type):
        raise AssertionError("dry-run não embeda")

    monkeypatch.setattr(main, "_embed_batch", embed_falso)
    client = TestClient(main.app)

    corpo = client.post("/admin/reprocess", json={"namespace": NS}).json()

    assert corpo["pulados"] == ["doc-cknovo"]
    assert corpo["trechos_reprocessados"] == 0


# ─────────────────────────────────────────────────────────────────────────────
# Legado de documento JÁ migrado: a única exceção ao "nunca apaga"
# ─────────────────────────────────────────────────────────────────────────────


def test_legado_de_documento_ja_migrado_ganha_motivo_proprio():
    """
    O documento já tem trechos em doc-ck1 (reenvio depois do deploy da API) e
    ainda tem os trechos da versão anterior gravados sob o título. Renomear o
    legado para doc-ck1 esbarraria na chave única (namespace, chunk_hash) ou,
    pior, deixaria duas versões do mesmo documento respondendo ao cliente.
    """
    plano = reprocess.planejar(
        [_fonte("doc-ck1", trechos=4), _fonte("Proposta.pdf", trechos=3)],
        [_doc("ck1", "Proposta.pdf")],
        {},
    )
    por_source = {item.source: item for item in plano}

    assert por_source["doc-ck1"].motivo == "já migrado"
    assert por_source["Proposta.pdf"].motivo == "legado_de_doc_ja_migrado"
    assert por_source["Proposta.pdf"].novo_source == "doc-ck1"


def test_sem_doc_ja_migrado_o_legado_continua_sendo_renomeado():
    plano = reprocess.planejar(
        [_fonte("Proposta.pdf", trechos=3)],
        [_doc("ck1", "Proposta.pdf")],
        {},
    )

    assert plano[0].motivo == "documento"


class ConexaoComLegadoDuplicado(FakeConnection):
    def __init__(self) -> None:
        super().__init__()
        self.fontes = [
            {"source": "doc-ck1", "trechos": 1},
            {"source": "Proposta.pdf", "trechos": 2},
        ]
        self.documentos = [
            {
                "id": "ck1",
                "title": "Proposta.pdf",
                "sourceType": "application/pdf",
                "sourceUrl": None,
                "createdAt": datetime(2026, 7, 20),
            }
        ]
        self.qa = []

    async def execute(self, sql: str, *_args):
        self.executados.append(sql)
        return "DELETE 2" if sql.strip().upper().startswith("DELETE") else "UPDATE 1"


def _cliente_com(conexao, monkeypatch) -> TestClient:
    monkeypatch.setattr(main.state, "pool", FakePool(conexao))

    async def embed_falso(texts, input_type):
        return [[0.0] * main.EMBEDDING_DIM for _ in texts]

    monkeypatch.setattr(main, "_embed_batch", embed_falso)
    return TestClient(main.app)


def test_dry_run_mostra_o_legado_duplicado_antes_de_apagar(monkeypatch):
    conexao = ConexaoComLegadoDuplicado()
    client = _cliente_com(conexao, monkeypatch)

    corpo = client.post("/admin/reprocess", json={"namespace": NS}).json()

    legado = next(f for f in corpo["fontes"] if f["source"] == "Proposta.pdf")
    assert legado["motivo"] == "legado_de_doc_ja_migrado"
    assert not any("DELETE" in sql.upper() for sql in conexao.executados)


def test_execucao_apaga_so_o_legado_do_documento_ja_migrado(monkeypatch):
    conexao = ConexaoComLegadoDuplicado()
    client = _cliente_com(conexao, monkeypatch)

    corpo = client.post(
        "/admin/reprocess", json={"namespace": NS, "dry_run": False}
    ).json()

    deletes = [sql for sql in conexao.executados if "DELETE" in sql.upper()]
    assert len(deletes) == 1
    assert "namespace = $1" in deletes[0]
    assert "source = $2" in deletes[0]
    assert corpo["trechos_apagados"] == 2


# ─────────────────────────────────────────────────────────────────────────────
# Nenhum outro caminho apaga nada
# ─────────────────────────────────────────────────────────────────────────────


def test_reprocessamento_comum_nunca_executa_delete(client, conexao):
    """
    Migração de dado que apaga por engano não tem desfazer: os trechos
    originais não existem em lugar nenhum fora do vetor.
    """
    client.post("/admin/reprocess", json={"namespace": NS, "dry_run": False})

    assert not any("DELETE" in sql.upper() for sql in conexao.executados)


def test_o_unico_sql_de_delete_do_modulo_e_o_do_legado_duplicado():
    """
    Trava de leitura: qualquer DELETE novo em reprocess.py precisa passar por
    aqui e ser justificado. Mesmo padrão do test_main.py, que confere o SQL
    executado em vez de confiar na intenção.
    """
    com_delete = [
        nome
        for nome, valor in vars(reprocess).items()
        if nome.startswith("_SQL")
        and isinstance(valor, str)
        and "DELETE" in valor.upper()
    ]

    assert com_delete == ["_SQL_APAGA_LEGADO"]
