"""
Conversores de documento: o que a tela promete tem de ser lido de verdade.

Antes deste modulo o servico so abria PDF e text/*; .docx e .xlsx passavam pelo
multer da API, morriam com 415 no Python e chegavam ao cliente como "Internal
Server Error" (achado A003). Aqui cada formato prometido tem um teste que le
um arquivo de verdade, e cada recusa tem a mensagem em portugues que o cliente
vai ver.
"""

import pytest
from fastapi import HTTPException

import extractors
from tests.fixtures import (
    CONTENT_TYPE_DOCX,
    CONTENT_TYPE_XLSX,
    docx_de,
    pdf_de,
    xlsx_de,
)


# ─────────────────────────────────────────────────────────────────────────────
# Deteccao de formato: por mime OU por extensao
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("content_type", "filename", "esperado"),
    [
        ("application/pdf", "contrato.pdf", "pdf"),
        (None, "contrato.pdf", "pdf"),
        (CONTENT_TYPE_DOCX, "politica.docx", "docx"),
        (None, "politica.docx", "docx"),
        ("application/octet-stream", "politica.DOCX", "docx"),
        (CONTENT_TYPE_XLSX, "precos.xlsx", "xlsx"),
        (None, "precos.xlsx", "xlsx"),
        ("text/plain", "notas.txt", "texto"),
        (None, "notas.md", "texto"),
        (None, "lista.csv", "texto"),
        ("text/html", "pagina.html", "html"),
        (None, "", None),
        ("application/zip", "backup.zip", None),
        # .doc e .xls sao os formatos binarios antigos: nenhuma das bibliotecas
        # le, entao tem de cair no 415 e nao num erro obscuro no meio da leitura.
        ("application/msword", "antigo.doc", None),
        ("application/vnd.ms-excel", "antigo.xls", None),
    ],
)
def test_detecta_formato_por_mime_ou_extensao(content_type, filename, esperado):
    assert extractors.detectar_formato(content_type, filename) == esperado


def test_extensao_vence_mime_generico_do_navegador():
    """
    O navegador manda application/vnd.ms-excel para .csv com frequencia. Se o
    mime mandasse, o CSV seria tratado como planilha binaria e falharia.
    """
    assert (
        extractors.detectar_formato("application/vnd.ms-excel", "lista.csv") == "texto"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Cada conversor le o conteudo de verdade
# ─────────────────────────────────────────────────────────────────────────────


def test_le_docx_com_mammoth():
    data = docx_de(["Política de trocas", "Aceitamos trocas em até 7 dias corridos."])

    texto = extractors.extrair_texto(CONTENT_TYPE_DOCX, "politica.docx", data)

    assert "Política de trocas" in texto
    assert "7 dias corridos" in texto


def test_le_xlsx_com_uma_linha_por_linha_da_planilha():
    data = xlsx_de(
        {
            "Preços": [
                ["Curso", "Valor"],
                ["Conselho do Futuro", 1200],
                [None, None],
                ["Mentoria", 3500],
            ]
        }
    )

    texto = extractors.extrair_texto(CONTENT_TYPE_XLSX, "precos.xlsx", data)
    linhas = texto.splitlines()

    # Nome da aba vira secao, para o cabecalho de trecho encontrar depois.
    assert linhas[0] == "## Planilha: Preços"
    assert "Curso | Valor" in linhas
    assert "Conselho do Futuro | 1200" in linhas
    assert "Mentoria | 3500" in linhas
    # Linha inteiramente vazia nao vira linha de texto.
    assert all(linha.strip() for linha in linhas)


def test_xlsx_com_varias_abas_separa_por_secao():
    data = xlsx_de({"Preços": [["Curso", 100]], "Horários": [["Segunda", "9h"]]})

    texto = extractors.extrair_texto(CONTENT_TYPE_XLSX, "planilha.xlsx", data)

    assert "## Planilha: Preços" in texto
    assert "## Planilha: Horários" in texto


def test_le_pdf_com_pypdf():
    data = pdf_de(["Tabela de precos 2026", "Curso A: 1200 reais"])

    texto = extractors.extrair_texto("application/pdf", "tabela.pdf", data)

    assert "Tabela de precos 2026" in texto
    assert "1200 reais" in texto


def test_le_texto_puro_e_markdown():
    assert "trocas" in extractors.extrair_texto(
        "text/plain", "n.txt", b"regras de trocas"
    )
    assert "# Titulo" in extractors.extrair_texto(
        None, "n.md", "# Titulo\n\ncorpo".encode()
    )


def test_pypdf_e_o_leitor_de_pdf_e_o_pymupdf_saiu():
    """
    O pymupdf e AGPL-3.0 (achado A235): num servico de rede multi-inquilino a
    licenca pede oferecer o codigo-fonte a quem usa o servico. A troca so vale
    se o import morrer de vez, entao o teste checa o modulo, nao o texto.
    """
    import sys

    extractors.extrair_texto("application/pdf", "t.pdf", pdf_de(["texto"]))

    assert "fitz" not in sys.modules
    assert "pypdf" in sys.modules


# ─────────────────────────────────────────────────────────────────────────────
# Recusas: status e mensagem que o cliente le
# ─────────────────────────────────────────────────────────────────────────────


def test_tipo_nao_suportado_devolve_415_em_portugues():
    with pytest.raises(HTTPException) as erro:
        extractors.extrair_texto("application/zip", "backup.zip", b"PK\x03\x04")

    assert erro.value.status_code == 415
    assert erro.value.detail == (
        "Tipo de arquivo não aceito: envie PDF, Word (.docx), Excel (.xlsx), "
        "texto, Markdown ou CSV."
    )


@pytest.mark.parametrize(
    ("content_type", "filename"),
    [
        (CONTENT_TYPE_DOCX, "quebrado.docx"),
        (CONTENT_TYPE_XLSX, "quebrada.xlsx"),
        ("application/pdf", "quebrado.pdf"),
    ],
)
def test_arquivo_que_a_biblioteca_nao_abre_devolve_422_em_portugues(
    content_type, filename
):
    """Arquivo corrompido nao pode virar 500: o cliente precisa saber o que fazer."""
    with pytest.raises(HTTPException) as erro:
        extractors.extrair_texto(
            content_type, filename, b"isto nao e um arquivo valido"
        )

    assert erro.value.status_code == 422
    assert erro.value.detail == (
        "Não consegui ler este arquivo. Salve como PDF ou texto e envie de novo."
    )


def test_pdf_sem_texto_selecionavel_explica_o_caso():
    """PDF digitalizado abre, mas nao tem texto. A dica tem de ser outra."""
    with pytest.raises(HTTPException) as erro:
        extractors.extrair_texto("application/pdf", "digitalizado.pdf", pdf_de([]))

    assert erro.value.status_code == 422
    assert "digitalizado" in erro.value.detail.lower()


def test_mensagem_de_arquivo_grande_traz_o_numero_do_limite():
    mensagem = extractors.mensagem_arquivo_grande(31.7, 20)

    assert "20" in mensagem
    assert "31.7" in mensagem or "31,7" in mensagem


# ─────────────────────────────────────────────────────────────────────────────
# URL: Readability, portao de conteudo minimo e recusa de rede social (A012)
# ─────────────────────────────────────────────────────────────────────────────

_PAGINA = """
<html><head><title>Cursos</title>
<script>var x = 'menu inteiro do site que nao e conteudo';</script>
</head><body>
<nav>Home Sobre Contato Blog Login</nav>
<article>
<h1>Conselho do Futuro</h1>
<p>O programa Conselho do Futuro forma conselheiros para empresas familiares
brasileiras que precisam profissionalizar a governanca antes da sucessao.</p>
<p>Sao doze encontros mensais, com mentoria individual e um trabalho final
apresentado ao conselho da propria empresa do participante.</p>
</article>
<footer>Todos os direitos reservados</footer>
</body></html>
"""


def test_url_extrai_conteudo_principal_e_descarta_script():
    texto = extractors.extrair_texto(
        "text/html",
        "pagina.html",
        _PAGINA.encode(),
        source_url="https://cmj.com.br/cursos",
    )

    assert "Conselho do Futuro" in texto
    assert "conselheiros para empresas familiares" in texto
    assert "var x" not in texto
    assert "<p>" not in texto


def test_pagina_curta_devolve_422_pedindo_o_texto_colado():
    """
    O site do CMJ rendeu 1 trecho de 29 caracteres e apareceu com selo verde de
    indexado. Menos de 200 caracteres uteis nao e conteudo.
    """
    curta = b"<html><body><p>Bundled Page</p></body></html>"

    with pytest.raises(HTTPException) as erro:
        extractors.extrair_texto(
            "text/html", "p.html", curta, source_url="https://cmj.com.br"
        )

    assert erro.value.status_code == 422
    assert erro.value.detail == (
        "A página não tem texto legível o suficiente. Cole o conteúdo como texto."
    )


@pytest.mark.parametrize(
    "url",
    [
        "https://www.instagram.com/conselhomudandoojogo",
        "https://facebook.com/cmj",
        "https://www.tiktok.com/@cmj",
        "https://x.com/cmj",
        "https://twitter.com/cmj",
        "https://br.linkedin.com/company/cmj",
        "https://www.youtube.com/@conselhomudandoojogo",
        "https://m.facebook.com/cmj",
    ],
)
def test_rede_social_e_recusada_com_422(url):
    with pytest.raises(HTTPException) as erro:
        extractors.verificar_rede_social(url)

    assert erro.value.status_code == 422
    assert erro.value.detail == (
        "Redes sociais não podem ser lidas automaticamente. "
        "Cole o texto do perfil ou da publicação."
    )


@pytest.mark.parametrize(
    "url",
    [
        "https://cmj.com.br/cursos",
        "https://www.zappiq.com.br",
        # Nao pode casar por substring: "meufacebook.com.br" nao e o Facebook.
        "https://meufacebook.com.br/blog",
        "https://youtubers-do-brasil.com.br",
    ],
)
def test_site_comum_passa_pelo_filtro_de_rede_social(url):
    extractors.verificar_rede_social(url)


def test_ingestao_de_html_tambem_recusa_rede_social():
    """O portao vale na extracao, nao so na API: o Python e a ultima barreira."""
    with pytest.raises(HTTPException) as erro:
        extractors.extrair_texto(
            "text/html",
            "p.html",
            _PAGINA.encode(),
            source_url="https://www.instagram.com/cmj",
        )

    assert erro.value.status_code == 422
    assert "Redes sociais" in erro.value.detail


# ─────────────────────────────────────────────────────────────────────────────
# Titulo da pagina: "https://cmj.com.br/cursos" nao diz nada na lista
# ─────────────────────────────────────────────────────────────────────────────


def test_titulo_da_pagina_sai_da_tag_title():
    assert extractors.titulo_da_pagina(_PAGINA.encode()) == "Cursos"


def test_titulo_da_pagina_decodifica_entidade_e_corta_espaco():
    pagina = b"<html><head><title>  Cursos &amp; Mentoria \n </title></head><body>x</body></html>"

    assert extractors.titulo_da_pagina(pagina) == "Cursos & Mentoria"


def test_pagina_sem_title_nao_inventa_titulo():
    assert extractors.titulo_da_pagina(b"<html><body><p>oi</p></body></html>") is None


def test_title_vazio_conta_como_ausente():
    assert (
        extractors.titulo_da_pagina(b"<html><head><title>   </title></head></html>")
        is None
    )


def test_lixo_binario_nao_derruba_a_leitura_do_titulo():
    assert extractors.titulo_da_pagina(b"\x00\x01\x02\x03") is None


def test_titulo_muito_longo_e_cortado():
    longo = "A" * 400
    pagina = f"<html><head><title>{longo}</title></head></html>".encode()

    detectado = extractors.titulo_da_pagina(pagina)

    assert detectado is not None
    assert len(detectado) <= extractors.TITULO_MAX_CARACTERES


def test_formatos_suportados_e_a_lista_que_o_ready_anuncia():
    """Contrato com a API: ela decide o que enviar olhando esta lista."""
    assert extractors.FORMATOS_SUPORTADOS == ("pdf", "docx", "xlsx", "html", "texto")


def test_pagina_por_url_com_caminho_txt_servida_como_html_e_lida_como_html():
    """O mime do servidor vence a extensao do caminho quando a origem e uma URL."""
    corpo = (
        "<p>"
        + ("Politica de troca e devolucao da loja, valida em todo o site. " * 8)
        + "</p>"
    )
    html = (
        "<html><head><title>Politica</title><script>var x=1</script></head>"
        "<body><nav>menu</nav><article>" + corpo + "</article></body></html>"
    ).encode()
    texto = extractors.extrair_texto(
        "text/html", "politica.txt", html, source_url="https://exemplo.com/politica.txt"
    )
    assert "<" not in texto
    assert "var x" not in texto
    assert "Politica de troca" in texto
