"""
/ingest de ponta a ponta: o que a tela promete entra na base, e o que nao entra
sai com o status e a frase certos.

Complementa test_extractors.py (que testa o conversor isolado) e test_main.py
(que testa roteamento e auth): aqui o arquivo sobe pela rota de verdade.
"""

import json

import pytest
from fastapi.testclient import TestClient

import extractors
import main
from tests.fixtures import (
    CONTENT_TYPE_DOCX,
    CONTENT_TYPE_XLSX,
    docx_de,
    pdf_de,
    xlsx_de,
)

NAMESPACE = "org_11111111-2222-3333-4444-555555555555"


class FakeTokenizer:
    def encode(self, text: str) -> list[int]:
        return [ord(c) for c in text]

    def decode(self, tokens: list[int]) -> str:
        return "".join(chr(t) for t in tokens)


@pytest.fixture
def gravados(monkeypatch) -> list[dict]:
    """Devolve o que o /ingest teria gravado no pgvector."""
    registro: list[dict] = []

    async def fake_embed_batch(texts, input_type):
        registro.append({"embed_texts": list(texts)})
        return [[0.0] * main.EMBEDDING_DIM for _ in texts]

    async def fake_upsert_chunks(namespace, source, trechos, vectors, metadata):
        registro.append(
            {
                "namespace": namespace,
                "source": source,
                "trechos": trechos,
                "metadata": metadata,
            }
        )

    monkeypatch.setattr(main.state, "tokenizer", FakeTokenizer())
    monkeypatch.setattr(main, "_embed_batch", fake_embed_batch)
    monkeypatch.setattr(main, "_upsert_chunks", fake_upsert_chunks)
    return registro


@pytest.fixture
def client() -> TestClient:
    return TestClient(main.app)


def _subir(client, nome, conteudo, content_type, **campos):
    dados = {"namespace": NAMESPACE, **campos}
    return client.post(
        "/ingest", files={"file": (nome, conteudo, content_type)}, data=dados
    )


def _upsert(registro: list[dict]) -> dict:
    return next(r for r in registro if "trechos" in r)


def _textos_embedados(registro: list[dict]) -> list[str]:
    return next(r for r in registro if "embed_texts" in r)["embed_texts"]


# ─────────────────────────────────────────────────────────────────────────────
# Word e Excel entram de verdade (achado A003)
# ─────────────────────────────────────────────────────────────────────────────


def test_docx_gera_trechos(client, gravados):
    data = docx_de(["Política de trocas", "Aceitamos trocas em até 7 dias corridos."])

    resposta = _subir(client, "politica.docx", data, CONTENT_TYPE_DOCX, source="doc-1")

    assert resposta.status_code == 200
    assert resposta.json()["chunks_ingested"] >= 1
    assert "7 dias corridos" in _upsert(gravados)["trechos"][0].texto


def test_xlsx_gera_trechos_com_a_aba_como_secao(client, gravados):
    data = xlsx_de({"Preços": [["Curso", "Valor"], ["Conselho do Futuro", 1200]]})

    resposta = _subir(client, "precos.xlsx", data, CONTENT_TYPE_XLSX, source="doc-2")

    assert resposta.status_code == 200
    trecho = _upsert(gravados)["trechos"][0]
    assert "Conselho do Futuro | 1200" in trecho.texto
    assert "Seção: Planilha: Preços." in trecho.cabecalho


def test_pdf_continua_entrando_agora_pelo_pypdf(client, gravados):
    resposta = _subir(
        client,
        "tabela.pdf",
        pdf_de(["Tabela de precos 2026", "Curso A: 1200 reais"]),
        "application/pdf",
        source="doc-3",
    )

    assert resposta.status_code == 200
    assert "1200 reais" in _upsert(gravados)["trechos"][0].texto


# ─────────────────────────────────────────────────────────────────────────────
# Cabecalho de contexto (P64)
# ─────────────────────────────────────────────────────────────────────────────


def test_embedding_leva_o_cabecalho_e_o_texto_guardado_fica_original(client, gravados):
    resposta = _subir(
        client,
        "qualquer.txt",
        "Aceitamos trocas em ate 7 dias.".encode(),
        "text/plain",
        source="doc-4",
        metadata=json.dumps({"titulo": "Política_de_trocas_v2_final.pdf"}),
    )

    assert resposta.status_code == 200
    trecho = _upsert(gravados)["trechos"][0]

    # Titulo amigavel: sem extensao, sem underline, sem "v2 final".
    assert trecho.cabecalho == "Documento: Política de trocas."
    assert trecho.texto == "Aceitamos trocas em ate 7 dias."
    assert _textos_embedados(gravados)[0] == (
        "Documento: Política de trocas.\n\nAceitamos trocas em ate 7 dias."
    )


def test_sem_titulo_no_metadata_o_cabecalho_usa_o_nome_do_arquivo(client, gravados):
    _subir(client, "Tabela_de_precos.txt", b"Curso A: 1200", "text/plain", source="d")

    assert _upsert(gravados)["trechos"][0].cabecalho == "Documento: Tabela de precos."


def test_qa_curto_vira_um_trecho_so_com_a_pergunta_no_cabecalho(client, gravados):
    """
    Os dois cuidados convivem: o Q&A abaixo do teto nao e fatiado (A011, regra
    de retrieval.wants_single_chunk) e o unico trecho leva a pergunta no
    cabecalho de contexto (P64).
    """
    resposta = _subir(
        client,
        "qa-abc.txt",
        b"Damos desconto para turma fechada a partir de cinco pessoas.",
        "text/plain",
        source="qa-abc.txt",
        metadata=json.dumps({"pergunta": "Vocês dão desconto?"}),
    )

    assert resposta.status_code == 200
    trechos = _upsert(gravados)["trechos"]
    assert len(trechos) == 1
    assert "Pergunta: Vocês dão desconto?" in trechos[0].cabecalho


def test_qa_longo_repete_a_pergunta_em_todos_os_trechos(client, gravados):
    """
    Achado A011: a resposta de Q&A aceita 4.000 caracteres, o trecho cabe em 512
    tokens, e so o primeiro pedaco trazia "Pergunta:". Os demais eram resposta
    solta que nao casava com a pergunta do cliente.

    Acima de RAG_SINGLE_CHUNK_MAX_TOKENS o Q&A volta a ser fatiado, para nunca
    estourar o contexto do embedding. E ai que a pergunta em todo cabecalho
    precisa valer. O tokenizador do teste conta um token por caractere.
    """
    corpo = (
        "Damos desconto para turma fechada a partir de cinco pessoas. " * 120
    ).encode()
    assert len(corpo) > 6000

    resposta = _subir(
        client,
        "qa-abc.txt",
        corpo,
        "text/plain",
        source="qa-abc.txt",
        metadata=json.dumps({"pergunta": "Vocês dão desconto?"}),
    )

    assert resposta.status_code == 200
    trechos = _upsert(gravados)["trechos"]
    assert len(trechos) > 1
    for trecho in trechos:
        assert "Pergunta: Vocês dão desconto?" in trecho.cabecalho


def test_cabecalho_vai_para_a_metadata_do_trecho(client, gravados):
    _subir(
        client,
        "catalogo.txt",
        b"## Precos\nCurso A: 1200",
        "text/plain",
        source="doc-5",
        metadata=json.dumps({"titulo": "Catálogo"}),
    )

    trecho = _upsert(gravados)["trechos"][0]
    assert trecho.cabecalho == "Documento: Catálogo. Seção: Precos."


# ─────────────────────────────────────────────────────────────────────────────
# Recusas com a frase que o cliente le (achado A004)
# ─────────────────────────────────────────────────────────────────────────────


def test_tipo_nao_aceito_devolve_415_em_portugues(client):
    resposta = _subir(client, "backup.zip", b"PK\x03\x04", "application/zip")

    assert resposta.status_code == 415
    assert resposta.json()["detail"] == extractors.MENSAGEM_TIPO_NAO_ACEITO


def test_arquivo_corrompido_devolve_422_em_portugues(client):
    resposta = _subir(client, "quebrado.docx", b"nao e um docx", CONTENT_TYPE_DOCX)

    assert resposta.status_code == 422
    assert resposta.json()["detail"] == extractors.MENSAGEM_ARQUIVO_ILEGIVEL


def test_arquivo_grande_devolve_413_com_o_numero_do_limite(client, monkeypatch):
    monkeypatch.setattr(main, "MAX_UPLOAD_MB", 1)

    resposta = _subir(client, "grande.txt", b"x" * (2 * 1024 * 1024), "text/plain")

    assert resposta.status_code == 413
    assert "1 MB" in resposta.json()["detail"]
    assert "2.0 MB" in resposta.json()["detail"]


def test_pagina_de_rede_social_devolve_422(client):
    resposta = _subir(
        client,
        "perfil.html",
        b"<html><body><p>perfil</p></body></html>",
        "text/html",
        source_url="https://www.instagram.com/conselhomudandoojogo",
    )

    assert resposta.status_code == 422
    assert resposta.json()["detail"] == extractors.MENSAGEM_REDE_SOCIAL


def test_pagina_sem_conteudo_devolve_422(client):
    resposta = _subir(
        client,
        "pagina.html",
        b"<html><body><p>Bundled Page</p></body></html>",
        "text/html",
        source_url="https://cmj.com.br",
    )

    assert resposta.status_code == 422
    assert resposta.json()["detail"] == extractors.MENSAGEM_PAGINA_CURTA


# ─────────────────────────────────────────────────────────────────────────────
# Erro inesperado nao pode chegar como texto solto (achado A019)
# ─────────────────────────────────────────────────────────────────────────────


def test_erro_inesperado_sai_como_json(monkeypatch):
    """
    O handler global devolvia um dict cru; o Starlette nao conseguia enviar e o
    cliente recebia 500 com corpo "Internal Server Error" em texto puro, sem o
    detalhe. Quem chama (a API) espera JSON para repassar a mensagem.
    """

    def explode(*_args, **_kwargs):
        raise RuntimeError("falha inesperada no meio da ingestao")

    monkeypatch.setattr(main, "_chunk_text", explode)
    monkeypatch.setattr(main.state, "tokenizer", FakeTokenizer())
    client = TestClient(main.app, raise_server_exceptions=False)

    resposta = client.post(
        "/ingest",
        files={"file": ("n.txt", b"conteudo qualquer", "text/plain")},
        data={"namespace": NAMESPACE},
        headers={"accept": "application/json"},
    )

    assert resposta.status_code == 500
    assert resposta.headers["content-type"].startswith("application/json")
    assert resposta.json()["error"] == "internal_server_error"


# ─────────────────────────────────────────────────────────────────────────────
# Titulo detectado na pagina volta para a API (a lista mostrava a URL crua)
# ─────────────────────────────────────────────────────────────────────────────

_PAGINA_COM_TITULO = """
<html><head><title>Conselho do Futuro | CMJ</title></head><body>
<article><h1>Conselho do Futuro</h1>
<p>O programa Conselho do Futuro forma conselheiros para empresas familiares
brasileiras que precisam profissionalizar a governanca antes da sucessao.</p>
<p>Sao doze encontros mensais, com mentoria individual e um trabalho final
apresentado ao conselho da propria empresa do participante.</p>
</article></body></html>
"""


def test_ingest_de_pagina_devolve_o_titulo_detectado(client, gravados):
    resposta = _subir(
        client,
        "cmj.com.br/cursos",
        _PAGINA_COM_TITULO.encode(),
        "text/html",
        source="doc-ck1",
        source_url="https://cmj.com.br/cursos",
    )

    assert resposta.status_code == 200
    assert resposta.json()["titulo_detectado"] == "Conselho do Futuro | CMJ"


def test_arquivo_comum_nao_devolve_titulo_detectado(client, gravados):
    """Só página tem <title>. Para PDF e Word o campo sai nulo."""
    resposta = _subir(
        client, "politica.txt", b"a" * 300, "text/plain", source="doc-ck2"
    )

    assert resposta.status_code == 200
    assert resposta.json()["titulo_detectado"] is None
