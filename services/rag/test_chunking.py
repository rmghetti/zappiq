"""
Cabecalho de contexto em cada trecho (proposta P64).

O problema medido: 177 de 184 trechos de documento nao contem o titulo do
documento, e 134 deles nem sao o primeiro trecho. Um pedaco do meio de uma
tabela de precos vira numero solto no vetor, e "quanto custa o curso X" nao
encontra o documento do curso X.

A correcao e determinista e nao usa LLM: o texto que vai para o embedding leva
"Documento: <titulo>. Seção: <secao>." na frente. O texto guardado continua
sendo o original, porque e ele que o cliente le no "Respondi com base em".
"""

import chunking


# ─────────────────────────────────────────────────────────────────────────────
# Titulo amigavel: "Plano_v3_final.pdf" nao pode virar ruido no vetor
# ─────────────────────────────────────────────────────────────────────────────


def test_titulo_amigavel_tira_extensao_e_underline():
    assert chunking.titulo_amigavel("Politica_de_trocas.pdf") == "Politica de trocas"
    assert chunking.titulo_amigavel("tabela_precos_2026.xlsx") == "tabela precos 2026"


def test_titulo_amigavel_tira_sufixo_de_versao():
    assert chunking.titulo_amigavel("Plano_v3_final.pdf") == "Plano"
    assert chunking.titulo_amigavel("Contrato rev2.docx") == "Contrato"
    assert chunking.titulo_amigavel("Proposta - cópia.pdf") == "Proposta -"


def test_titulo_amigavel_nao_destroi_nome_que_ja_e_bom():
    assert chunking.titulo_amigavel("Ementa Conselho do Futuro") == (
        "Ementa Conselho do Futuro"
    )
    # Numero que faz parte do nome nao e versao.
    assert chunking.titulo_amigavel("Regimento 2026.pdf") == "Regimento 2026"


def test_titulo_amigavel_com_url_usa_o_endereco():
    assert chunking.titulo_amigavel("cmj.com.br/cursos") == "cmj.com.br/cursos"


def test_titulo_amigavel_nunca_devolve_vazio():
    # Nome feito so de versao: cortar tudo deixaria o trecho sem identidade.
    assert chunking.titulo_amigavel("v3_final.pdf") == "v3 final"
    assert chunking.titulo_amigavel("   ") == "Documento"


# ─────────────────────────────────────────────────────────────────────────────
# Deteccao de secao dentro do trecho
# ─────────────────────────────────────────────────────────────────────────────


def test_detecta_titulo_markdown():
    assert chunking.detectar_secao("## Planilha: Preços\nCurso | 1200") == (
        "Planilha: Preços"
    )
    assert chunking.detectar_secao("# Cancelamento\n\ntexto") == "Cancelamento"


def test_detecta_rotulo_de_secao_em_portugues():
    assert chunking.detectar_secao("Capítulo 3: Da rescisão\ntexto") == (
        "Capítulo 3: Da rescisão"
    )


def test_detecta_linha_toda_em_maiusculas():
    assert chunking.detectar_secao("CLAUSULA SEGUNDA\nO contratante...") == (
        "CLAUSULA SEGUNDA"
    )


def test_texto_corrido_nao_inventa_secao():
    assert chunking.detectar_secao("Aceitamos trocas em ate 7 dias corridos.") is None


def test_pega_o_primeiro_titulo_do_trecho():
    trecho = "texto solto\n## Preços\nlinha\n## Horários\nlinha"
    assert chunking.detectar_secao(trecho) == "Preços"


# ─────────────────────────────────────────────────────────────────────────────
# Montagem do cabecalho
# ─────────────────────────────────────────────────────────────────────────────


def test_cabecalho_com_documento_e_secao():
    assert chunking.montar_cabecalho("Tabela de preços", "Preços") == (
        "Documento: Tabela de preços. Seção: Preços."
    )


def test_cabecalho_sem_secao_traz_so_o_documento():
    assert chunking.montar_cabecalho("Tabela de preços", None) == (
        "Documento: Tabela de preços."
    )


def test_cabecalho_de_qa_repete_a_pergunta():
    """
    Resposta de Q&A pode ter 4.000 caracteres e ser fatiada em 3 trechos. Sem a
    pergunta no cabecalho, os trechos 2 e 3 sao pedaco de resposta solto e nao
    casam com a pergunta do cliente (achado A011).
    """
    cabecalho = chunking.montar_cabecalho(
        "Perguntas e respostas", None, pergunta="Vocês dão desconto?"
    )

    assert cabecalho == (
        "Documento: Perguntas e respostas. Pergunta: Vocês dão desconto?"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Trechos prontos para o pgvector
# ─────────────────────────────────────────────────────────────────────────────


def test_trecho_embeda_com_cabecalho_e_guarda_o_texto_original():
    trechos = chunking.montar_trechos(["## Preços\nCurso A: 1200"], "Tabela 2026")

    assert len(trechos) == 1
    trecho = trechos[0]
    assert trecho.texto == "## Preços\nCurso A: 1200"
    assert trecho.cabecalho == "Documento: Tabela 2026. Seção: Preços."
    assert trecho.embed == (
        "Documento: Tabela 2026. Seção: Preços.\n\n## Preços\nCurso A: 1200"
    )


def test_cada_trecho_ganha_a_secao_que_ele_mesmo_carrega():
    trechos = chunking.montar_trechos(
        ["## Preços\nCurso A", "texto sem título", "## Horários\nSegunda"],
        "Catálogo",
    )

    assert [t.cabecalho for t in trechos] == [
        "Documento: Catálogo. Seção: Preços.",
        "Documento: Catálogo.",
        "Documento: Catálogo. Seção: Horários.",
    ]


def test_todos_os_trechos_de_qa_longo_levam_a_pergunta():
    trechos = chunking.montar_trechos(
        ["parte um da resposta", "parte dois da resposta", "parte tres"],
        "Perguntas e respostas",
        pergunta="Vocês dão desconto?",
    )

    assert len(trechos) == 3
    for trecho in trechos:
        assert "Pergunta: Vocês dão desconto?" in trecho.cabecalho
        assert trecho.embed.startswith("Documento: Perguntas e respostas.")


def test_titulo_gigante_e_cortado_para_nao_engolir_o_trecho():
    trechos = chunking.montar_trechos(["conteúdo"], "T" * 500)

    assert len(trechos[0].cabecalho) < 200
