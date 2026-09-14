"""
Eval de recall@5 e mecanica do re-rank (services/rag/retrieval.py).

Por que um embedder FALSO: o objetivo aqui e provar a MECANICA do ranking
(corte, bonus, teto por fonte, deduplicacao) sem gastar um centavo de
embedding e sem depender de rede. O embedder falso e deterministico: joga o
hash de cada palavra num vetor esparso e normaliza. Cosseno vira, na pratica,
sobreposicao de vocabulario, que e o suficiente para ordenar candidatos.

A medida com o embedding REAL (text-embedding-3-small) e com os qa_pairs reais
de cada organizacao fica no script services/rag/scripts/recall_eval.py, que NAO
roda no CI.
"""

import hashlib
import math

import retrieval

DIM = 256


# ─────────────────────────────────────────────────────────────────────────────
# Embedder falso deterministico
# ─────────────────────────────────────────────────────────────────────────────


def fake_embed(text: str) -> list[float]:
    vec = [0.0] * DIM
    for token in retrieval.normalize_for_dedupe(text).split():
        if len(token) < 3:
            continue
        bucket = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16) % DIM
        vec[bucket] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


# ─────────────────────────────────────────────────────────────────────────────
# Corpus sintetico de uma organizacao de fixture
# ─────────────────────────────────────────────────────────────────────────────

# Pares pergunta/resposta que viram source qa-<i>.txt (um trecho so).
QA_FIXTURES = [
    (
        "qual o valor da mensalidade do curso de fotografia noturna",
        "a mensalidade do curso de fotografia noturna custa 480 reais por mes",
    ),
    (
        "voces parcelam a matricula no cartao de credito",
        "sim, a matricula pode ser parcelada em ate 6 vezes no cartao de credito",
    ),
    (
        "qual o horario das aulas praticas de sabado",
        "as aulas praticas de sabado acontecem das 9h as 13h no estudio",
    ),
    (
        "o certificado do curso tem validade nacional",
        "sim, o certificado do curso tem validade nacional e registro no MEC",
    ),
]

# Conteudo que so existe em documento do cliente (nao ha Q&A cobrindo).
DOC_FIXTURES = [
    (
        "politica-de-cancelamento.pdf",
        [
            "o cancelamento da matricula pode ser pedido ate 7 dias antes do inicio",
            "o reembolso do cancelamento sai em ate 30 dias uteis na conta informada",
        ],
    ),
    (
        "equipamentos-do-estudio.pdf",
        [
            "o estudio tem tripe, softbox e fundo infinito disponiveis para o aluno",
            "cada aluno pode reservar o estudio por 2 horas seguidas na semana",
        ],
    ),
]

DOC_QUESTIONS = [
    (
        "com quantos dias posso pedir cancelamento da matricula",
        "politica-de-cancelamento.pdf",
    ),
    (
        "quanto tempo demora o reembolso do cancelamento",
        "politica-de-cancelamento.pdf",
    ),
    ("quais equipamentos o estudio tem para o aluno", "equipamentos-do-estudio.pdf"),
    ("por quantas horas posso reservar o estudio", "equipamentos-do-estudio.pdf"),
]

# Questionario de qualificacao: muitos trechos vizinhos, vocabulario generico
# que toca preco, matricula, horario e estudio ao mesmo tempo. E exatamente o
# perfil que A024 mediu deslocando documento e Q&A do top-5.
SURVEY_CHUNKS = [
    "tom principal da ia consultivo e educativo sobre curso matricula e valor",
    "regras da ia nunca prometer desconto na matricula sem aprovacao do valor",
    "escalonamento reclamacao sobre valor da mensalidade vai para o humano",
    "politica de preco informar valor da mensalidade so depois de qualificar",
    "horario de atendimento comercial de segunda a sabado sobre aulas e estudio",
    "desqualificacao aluno que pede cancelamento e reembolso vai para o humano",
    "perguntas obrigatorias nome, interesse no curso e horario preferido",
    "palavras proibidas nunca falar garantia de certificado ou registro",
]


def build_corpus() -> list[retrieval.Candidate]:
    """Monta o corpus com id, source, chunk_hash e metadata como vem do banco."""
    rows: list[tuple[str, str, int, dict]] = []

    for idx, (question, answer) in enumerate(QA_FIXTURES):
        rows.append(
            (
                f"qa-{idx}.txt",
                f"Pergunta: {question}\n\nResposta: {answer}",
                0,
                {"kind": "qa", "priority": 0, "category": "comercial"},
            )
        )

    for source, chunks in DOC_FIXTURES:
        for chunk_idx, text in enumerate(chunks):
            rows.append((source, text, chunk_idx, {}))

    for chunk_idx, text in enumerate(SURVEY_CHUNKS):
        rows.append(("onboarding-survey-fotografia.txt", text, chunk_idx, {}))

    candidates: list[retrieval.Candidate] = []
    for n, (source, text, chunk_idx, meta) in enumerate(rows):
        candidates.append(
            retrieval.Candidate(
                id=f"id-{n}",
                text=text,
                source=source,
                chunk_idx=chunk_idx,
                similarity=0.0,
                chunk_hash=hashlib.sha256(
                    f"{source}|{chunk_idx}|{text}".encode("utf-8")
                ).hexdigest(),
                metadata=meta,
            )
        )
    return candidates


def score_corpus(
    query: str, corpus: list[retrieval.Candidate]
) -> list[retrieval.Candidate]:
    """Simula o _knn_search: cosseno contra o corpus inteiro, ordenado desc."""
    qv = fake_embed(query)
    scored = [
        retrieval.replace_similarity(c, cosine(qv, fake_embed(c.text))) for c in corpus
    ]
    scored.sort(key=lambda c: c.similarity, reverse=True)
    return scored


def legacy_rerank(
    candidates: list[retrieval.Candidate], top_k: int, min_similarity: float
) -> list[retrieval.Candidate]:
    """Re-rank como estava antes (main.py:572-583): boost multiplicativo fixo."""
    kept = [c for c in candidates if c.similarity >= min_similarity]

    def rank(c: retrieval.Candidate) -> float:
        src = c.source or ""
        if src.startswith("qa-"):
            return c.similarity * 1.20
        if src.startswith("onboarding-survey"):
            return c.similarity * 1.15
        return c.similarity

    kept.sort(key=rank, reverse=True)
    return kept[:top_k]


def eval_set() -> list[tuple[str, str]]:
    """(pergunta, source esperado): metade Q&A, metade documento do cliente."""
    pares = [(q, f"qa-{i}.txt") for i, (q, _) in enumerate(QA_FIXTURES)]
    return pares + list(DOC_QUESTIONS)


def recall_at_k(rerank_fn, top_k: int = 5) -> float:
    corpus = build_corpus()
    acertos = 0
    for pergunta, esperado in eval_set():
        candidatos = score_corpus(pergunta, corpus)
        topo = rerank_fn(candidatos, top_k)
        if any(c.source == esperado for c in topo):
            acertos += 1
    return acertos / len(eval_set())


# ─────────────────────────────────────────────────────────────────────────────
# Eval recall@5
# ─────────────────────────────────────────────────────────────────────────────

CFG = retrieval.RetrievalConfig()

# O corte ABSOLUTO de producao (0,35) e calibrado ao embedding real. O embedder
# falso vive noutra escala de cosseno (sobreposicao de vocabulario, 0,1 a 0,5),
# entao o eval sintetico roda com o piso baixo e prova o que ele consegue provar:
# ordenacao, corte relativo, bonus, teto por fonte e deduplicacao. O piso
# absoluto tem teste proprio (test_corte_absoluto_descarta_trecho_fraco) e a
# calibracao contra o embedding real e o scripts/recall_eval.py.
CFG_EVAL = retrieval.RetrievalConfig(min_similarity=0.05)


def novo_rerank(candidatos, top_k):
    return retrieval.rerank(candidatos, top_k=top_k, config=CFG_EVAL)


def test_recall_at_5_do_rerank_novo_atinge_a_meta():
    assert recall_at_k(novo_rerank, 5) >= 0.9


def test_recall_at_5_nao_piora_em_relacao_ao_boost_antigo():
    novo = recall_at_k(novo_rerank, 5)
    antigo = recall_at_k(lambda c, k: legacy_rerank(c, k, 0.05), 5)
    assert novo >= antigo, f"novo={novo} antigo={antigo}"


def test_questionario_nao_ocupa_mais_que_duas_vagas_do_top_5():
    """A024: o questionario chegava a ocupar 2,62 das 5 vagas em media."""
    corpus = build_corpus()
    for pergunta, _ in eval_set():
        topo = novo_rerank(score_corpus(pergunta, corpus), 5)
        survey = [c for c in topo if (c.source or "").startswith("onboarding-survey")]
        assert len(survey) <= 2, f"{pergunta}: {len(survey)} trechos de questionario"


def test_boost_antigo_derrubava_o_documento_do_top_5_e_o_novo_nao():
    """
    Reproducao fiel do formato medido em A024: o documento do cliente e o melhor
    resultado por similaridade (0,62), mas seis trechos vizinhos do questionario
    ficam logo abaixo (0,55 a 0,58). Com o boost multiplicativo de 1,15 todos
    passam o documento (0,632 a 0,667 contra 0,62) e ele sai do top-5.
    """
    documento = _cand(
        "doc-certo",
        "politica-de-cancelamento.pdf",
        0.62,
        text="o reembolso sai em 30 dias",
    )
    questionario = [
        _cand(
            f"survey-{i}",
            "onboarding-survey-fotografia.txt",
            0.58 - i * 0.005,
            text=f"regra generica numero {i} do questionario de qualificacao",
            chunk_idx=i,
        )
        for i in range(6)
    ]
    candidatos = [documento, *questionario]

    antigo = legacy_rerank(list(candidatos), 5, 0.05)
    assert all(c.source.startswith("onboarding-survey") for c in antigo)
    assert not any(c.id == "doc-certo" for c in antigo)

    novo = retrieval.rerank(list(candidatos), top_k=5, config=CFG_EVAL)
    assert novo[0].id == "doc-certo"
    assert len([c for c in novo if c.source.startswith("onboarding-survey")]) <= 2


# ─────────────────────────────────────────────────────────────────────────────
# Mecanica do re-rank
# ─────────────────────────────────────────────────────────────────────────────


def _cand(
    cid: str,
    source: str,
    similarity: float,
    text: str | None = None,
    chunk_hash: str | None = None,
    metadata: dict | None = None,
    chunk_idx: int = 0,
) -> retrieval.Candidate:
    # Texto distinto por padrao: dois candidatos com o MESMO texto sao
    # deduplicados de proposito, e isso mascararia os testes de ordenacao.
    return retrieval.Candidate(
        id=cid,
        text=text if text is not None else f"assunto exclusivo do candidato {cid}",
        source=source,
        chunk_idx=chunk_idx,
        similarity=similarity,
        chunk_hash=chunk_hash or f"hash-{cid}",
        metadata=metadata or {},
    )


def test_no_maximo_dois_trechos_por_fonte():
    candidatos = [
        _cand(f"c{i}", "manual.pdf", 0.90 - i * 0.01, text=f"trecho {i}", chunk_idx=i)
        for i in range(6)
    ]
    candidatos.append(_cand("outro", "faq.pdf", 0.60, text="outro assunto"))
    topo = retrieval.rerank(candidatos, top_k=5, config=CFG)
    manual = [c for c in topo if c.source == "manual.pdf"]
    assert len(manual) == 2
    assert [c.id for c in manual] == ["c0", "c1"]
    assert any(c.source == "faq.pdf" for c in topo)


def test_dedupe_por_chunk_hash_mantem_o_de_maior_similaridade():
    candidatos = [
        _cand("a", "doc-a.pdf", 0.80, text="mesmo conteudo", chunk_hash="H"),
        _cand("b", "doc-b.pdf", 0.70, text="mesmo conteudo", chunk_hash="H"),
    ]
    topo = retrieval.rerank(candidatos, top_k=5, config=CFG)
    assert [c.id for c in topo] == ["a"]


def test_dedupe_por_texto_quase_igual_em_fontes_diferentes():
    """A013: o mesmo texto colado com dois titulos ocupava duas vagas do top-5."""
    texto = "Atendemos de segunda a sexta das 9h as 18h e aos sabados ate as 12h."
    candidatos = [
        _cand("a", "DOSSIE ESTRATEGICO", 0.80, text=texto, chunk_hash="H1"),
        _cand("b", "Mapeamento", 0.79, text=texto + " ", chunk_hash="H2"),
        _cand("c", "outro.pdf", 0.60, text="assunto completamente diferente aqui"),
    ]
    topo = retrieval.rerank(candidatos, top_k=5, config=CFG)
    assert [c.id for c in topo] == ["a", "c"]


def test_prioridade_do_qa_desempata_entre_dois_qa_parecidos():
    """A009: prioridade 0 a 10 era so ordenacao de tela, nao pesava na busca."""
    baixa = _cand("baixa", "qa-1.txt", 0.70, metadata={"priority": 0})
    alta = _cand("alta", "qa-2.txt", 0.70, metadata={"priority": 10})
    topo = retrieval.rerank([baixa, alta], top_k=2, config=CFG)
    assert [c.id for c in topo] == ["alta", "baixa"]


def test_bonus_de_prioridade_tem_teto_e_nao_vira_atalho():
    """Prioridade 10 nao pode sequestrar o topo de um trecho muito melhor."""
    prioritario = _cand("qa", "qa-1.txt", 0.50, metadata={"priority": 10})
    bem_melhor = _cand("doc", "manual.pdf", 0.80)
    topo = retrieval.rerank([prioritario, bem_melhor], top_k=2, config=CFG)
    assert topo[0].id == "doc"


def test_bonus_do_qa_e_aditivo_pequeno_e_nao_multiplicativo():
    """Com 1,20 multiplicativo um Q&A de 0,60 (=0,72) passava um doc de 0,70."""
    qa = _cand("qa", "qa-1.txt", 0.60)
    doc = _cand("doc", "manual.pdf", 0.70)
    topo = retrieval.rerank([qa, doc], top_k=2, config=CFG)
    assert topo[0].id == "doc"


def test_corte_absoluto_descarta_trecho_fraco():
    cfg = retrieval.RetrievalConfig(min_similarity=0.35, relative_cutoff=0.0)
    candidatos = [_cand("ok", "a.pdf", 0.40), _cand("fraco", "b.pdf", 0.30)]
    topo = retrieval.rerank(candidatos, top_k=5, config=cfg)
    assert [c.id for c in topo] == ["ok"]


def test_corte_relativo_descarta_cauda_muito_abaixo_do_melhor():
    """A022: com o piso baixo toda mensagem levava 5 trechos, relevantes ou nao."""
    cfg = retrieval.RetrievalConfig(min_similarity=0.0, relative_cutoff=0.60)
    candidatos = [
        _cand("top", "a.pdf", 0.80),
        _cand("meio", "b.pdf", 0.50),
        _cand("cauda", "c.pdf", 0.40),
    ]
    topo = retrieval.rerank(candidatos, top_k=5, config=cfg)
    assert [c.id for c in topo] == ["top", "meio"]


def test_corte_relativo_desligado_por_env_zero():
    cfg = retrieval.RetrievalConfig(min_similarity=0.0, relative_cutoff=0.0)
    candidatos = [_cand("top", "a.pdf", 0.80), _cand("cauda", "c.pdf", 0.10)]
    topo = retrieval.rerank(candidatos, top_k=5, config=cfg)
    assert len(topo) == 2


def test_mensagem_sem_nada_acima_do_corte_devolve_lista_vazia():
    cfg = retrieval.RetrievalConfig(min_similarity=0.50)
    topo = retrieval.rerank([_cand("x", "a.pdf", 0.20)], top_k=5, config=cfg)
    assert topo == []


# ─────────────────────────────────────────────────────────────────────────────
# Q&A num trecho so (A011)
# ─────────────────────────────────────────────────────────────────────────────


def test_source_qa_pede_trecho_unico_mesmo_sem_sinalizador():
    assert retrieval.wants_single_chunk("qa-abc123.txt", False) is True


def test_sinalizador_explicito_pede_trecho_unico():
    assert retrieval.wants_single_chunk("qualquer.txt", True) is True


def test_documento_comum_continua_fatiado():
    assert retrieval.wants_single_chunk("manual.pdf", False) is False
    assert retrieval.wants_single_chunk(None, False) is False


# ─────────────────────────────────────────────────────────────────────────────
# Config por env
# ─────────────────────────────────────────────────────────────────────────────


def test_config_from_env_le_os_cortes(monkeypatch):
    monkeypatch.setenv("RAG_MIN_SIMILARITY", "0.42")
    monkeypatch.setenv("RAG_RELATIVE_CUTOFF", "0.55")
    monkeypatch.setenv("RAG_MAX_PER_SOURCE", "3")
    cfg = retrieval.config_from_env()
    assert cfg.min_similarity == 0.42
    assert cfg.relative_cutoff == 0.55
    assert cfg.max_per_source == 3


def test_resolve_min_similarity_devolve_o_maior_dos_dois():
    """
    A conta pura: a API e a dona do corte e o FLOOR do servico so aperta.
    Que o _knn_search de fato use este valor no rerank (e nao o env do proprio
    servico por cima) e provado na rota, em tests/test_query_route.py.
    """
    assert retrieval.resolve_min_similarity(requested=0.30, floor=0.0) == 0.30
    assert retrieval.resolve_min_similarity(requested=0.25, floor=0.40) == 0.40
    assert retrieval.resolve_min_similarity(requested=0.50, floor=0.40) == 0.50


def test_corte_absoluto_padrao_e_a_entrada_conservadora():
    """
    0,30 e a ENTRADA, nao a meta. A mediana medida do ruido real e 0,375, acima
    de 0,35: quem separa relevante de irrelevante e o corte RELATIVO. Entrar em
    0,30 erra para o lado de trazer um trecho a mais, que custa contexto; entrar
    alto demais custa a resposta certa do cliente com pouco conteudo.
    """
    assert retrieval.RetrievalConfig().min_similarity == 0.30
