"""
Re-rank, cortes e deduplicacao da busca do RAG.

Modulo separado de main.py de proposito: e logica PURA (nao toca banco, nao
toca rede, nao le estado global), entao da para provar recall e ordenacao no
pytest sem gastar embedding. main.py so faz a cola: busca as linhas no
pgvector, monta Candidate e chama rerank().

O que este modulo resolve (achados da auditoria de 14/09/2026):

  A022  O piso de similaridade 0,25 nao filtrava nada: medido nos vetores reais
        de producao (text-embedding-3-small), conteudo de OUTRA empresa tinha
        mediana 0,375 e so 3,7% ficava abaixo de 0,25. Toda mensagem, inclusive
        'oi', levava 5 trechos para o prompt. Agora ha piso absoluto
        (RAG_MIN_SIMILARITY, calibrado na API) e corte RELATIVO ao melhor
        resultado, que e o que separa 'achou' de 'trouxe qualquer coisa'.

  A024  O boost era multiplicativo (1,20 para qa-*, 1,15 para onboarding-survey*).
        Num trecho de similaridade 0,60 isso vale +0,12, o bastante para pular
        tres posicoes: o questionario ocupava 2,62 das 5 vagas e os documentos
        do cliente, 0,24. Agora o bonus e ADITIVO e pequeno, ou seja, desempata
        quase-empate e nao desloca resultado melhor.

  A009  A prioridade do Q&A (0 a 10) so ordenava a lista na tela. Agora vem na
        metadata da ingestao e vira bonus proporcional, com teto.

  A013  O mesmo texto colado sob dois titulos ocupava duas vagas. Agora ha
        deduplicacao por chunk_hash, por texto normalizado e por texto quase
        igual (Jaccard de palavras).

  A011  Q&A longo virava 2 ou 3 trechos e so o primeiro tinha 'Pergunta:'.
        wants_single_chunk() marca o Q&A como trecho unico na ingestao.
"""

from __future__ import annotations

import os
import re
import unicodedata
from dataclasses import dataclass, field, replace
from typing import Any, Mapping

# ─────────────────────────────────────────────────────────────────────────────
# Candidato
# ─────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Candidate:
    """Uma linha de rag_chunks ja com a similaridade calculada pelo pgvector."""

    id: str
    text: str
    source: str | None
    chunk_idx: int
    similarity: float
    chunk_hash: str | None = None
    metadata: Mapping[str, Any] | None = field(default=None)


def replace_similarity(candidate: Candidate, similarity: float) -> Candidate:
    """Copia o candidato trocando a similaridade (usado no eval sintetico)."""
    return replace(candidate, similarity=similarity)


# ─────────────────────────────────────────────────────────────────────────────
# Configuracao
# ─────────────────────────────────────────────────────────────────────────────


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass(frozen=True)
class RetrievalConfig:
    """
    Todos os numeros sao ajustaveis por env, sem deploy de codigo.

    min_similarity      Piso absoluto. Quem manda e a API (env RAG_MIN_SIMILARITY
                        do apps/api, que vai no corpo do /query); aqui fica o
                        valor usado quando o chamador nao pede nada.
    relative_cutoff     Descarta candidato abaixo de (melhor similaridade x este
                        fator). 0 desliga. E o corte que faz 'oi' voltar vazio:
                        quando nada casa, o melhor resultado tambem e fraco e a
                        cauda cai junto.
    max_per_source      Teto de trechos da MESMA fonte no resultado (A024).
    qa_bonus            Bonus aditivo para source qa-*.
    survey_bonus        Bonus aditivo para source onboarding-survey*.
    priority_bonus      Bonus por ponto de prioridade do Q&A (A009).
    priority_bonus_cap  Teto do bonus de prioridade.
    near_duplicate      Jaccard de palavras a partir do qual dois trechos sao
                        considerados o mesmo conteudo (A013).
    """

    min_similarity: float = 0.35
    relative_cutoff: float = 0.60
    max_per_source: int = 2
    qa_bonus: float = 0.03
    survey_bonus: float = 0.01
    priority_bonus: float = 0.005
    priority_bonus_cap: float = 0.05
    near_duplicate: float = 0.92


def config_from_env() -> RetrievalConfig:
    padrao = RetrievalConfig()
    return RetrievalConfig(
        min_similarity=_env_float("RAG_MIN_SIMILARITY", padrao.min_similarity),
        relative_cutoff=_env_float("RAG_RELATIVE_CUTOFF", padrao.relative_cutoff),
        max_per_source=_env_int("RAG_MAX_PER_SOURCE", padrao.max_per_source),
        qa_bonus=_env_float("RAG_QA_BONUS", padrao.qa_bonus),
        survey_bonus=_env_float("RAG_SURVEY_BONUS", padrao.survey_bonus),
        priority_bonus=_env_float("RAG_QA_PRIORITY_BONUS", padrao.priority_bonus),
        priority_bonus_cap=_env_float(
            "RAG_QA_PRIORITY_BONUS_CAP", padrao.priority_bonus_cap
        ),
        near_duplicate=_env_float("RAG_NEAR_DUPLICATE", padrao.near_duplicate),
    )


def resolve_min_similarity(requested: float, floor: float) -> float:
    """
    A API e a dona do corte: ela manda min_similarity no corpo do /query.
    O servico so tem um PISO (env RAG_MIN_SIMILARITY_FLOOR, default 0 = desligado)
    para o caso de uma API antiga ainda mandar o 0,25 de antes. O piso so aperta.
    """
    return max(float(requested or 0.0), float(floor or 0.0))


def min_similarity_floor() -> float:
    return _env_float("RAG_MIN_SIMILARITY_FLOOR", 0.0)


# ─────────────────────────────────────────────────────────────────────────────
# Trecho unico para Q&A (A011)
# ─────────────────────────────────────────────────────────────────────────────

# Q&A cabe folgado num trecho so (a resposta tem no maximo 4.000 caracteres,
# cerca de 1.200 tokens, e o modelo aceita 8k). Acima deste teto a ingestao
# volta a fatiar, para nunca estourar o contexto do embedding.
SINGLE_CHUNK_MAX_TOKENS = _env_int("RAG_SINGLE_CHUNK_MAX_TOKENS", 6000)


def wants_single_chunk(source: str | None, flag: bool) -> bool:
    """
    True quando o conteudo deve virar UM trecho so.

    Duas portas de propósito: o sinalizador explicito da API (`single_chunk`) e,
    como rede de seguranca para API antiga, o prefixo do source `qa-`.
    """
    if flag:
        return True
    return bool(source and source.startswith("qa-"))


# ─────────────────────────────────────────────────────────────────────────────
# Normalizacao e deduplicacao
# ─────────────────────────────────────────────────────────────────────────────

_NAO_PALAVRA = re.compile(r"[^a-z0-9]+")


def normalize_for_dedupe(text: str) -> str:
    """Minusculas, sem acento, sem pontuacao, espaco colapsado."""
    sem_acento = unicodedata.normalize("NFKD", text or "")
    sem_acento = "".join(c for c in sem_acento if not unicodedata.combining(c))
    limpo = _NAO_PALAVRA.sub(" ", sem_acento.lower())
    return " ".join(limpo.split())


def _word_set(text: str) -> set[str]:
    return set(normalize_for_dedupe(text).split())


def jaccard(a: str, b: str) -> float:
    sa, sb = _word_set(a), _word_set(b)
    if not sa or not sb:
        return 1.0 if sa == sb else 0.0
    return len(sa & sb) / len(sa | sb)


def is_near_duplicate(a: str, b: str, threshold: float) -> bool:
    if normalize_for_dedupe(a) == normalize_for_dedupe(b):
        return True
    if threshold <= 0:
        return False
    return jaccard(a, b) >= threshold


# ─────────────────────────────────────────────────────────────────────────────
# Pontuacao
# ─────────────────────────────────────────────────────────────────────────────


def _priority_of(candidate: Candidate) -> int:
    meta = candidate.metadata or {}
    try:
        valor = int(meta.get("priority", 0) or 0)
    except (TypeError, ValueError):
        return 0
    return max(0, min(10, valor))


def rank_score(candidate: Candidate, config: RetrievalConfig) -> float:
    """
    Similaridade + bonus ADITIVO. Bonus desempata; nunca desloca um resultado
    claramente melhor (era o defeito do boost multiplicativo, A024).
    """
    src = candidate.source or ""
    score = candidate.similarity
    if src.startswith("qa-"):
        score += config.qa_bonus
        score += min(
            _priority_of(candidate) * config.priority_bonus, config.priority_bonus_cap
        )
    elif src.startswith("onboarding-survey"):
        score += config.survey_bonus
    return score


# ─────────────────────────────────────────────────────────────────────────────
# Re-rank
# ─────────────────────────────────────────────────────────────────────────────


def rerank(
    candidates: list[Candidate],
    top_k: int,
    config: RetrievalConfig | None = None,
) -> list[Candidate]:
    """
    Ordem das operacoes (cada passo existe por um achado):

      1. corte absoluto           A022
      2. ordenacao por rank_score A009, A024
      3. corte relativo ao melhor A022
      4. deduplicacao             A013
      5. teto por fonte           A024
      6. top_k
    """
    cfg = config or config_from_env()

    vivos = [c for c in candidates if c.similarity >= cfg.min_similarity]
    if not vivos:
        return []

    vivos.sort(key=lambda c: rank_score(c, cfg), reverse=True)

    if cfg.relative_cutoff > 0:
        melhor = max(c.similarity for c in vivos)
        piso_relativo = melhor * cfg.relative_cutoff
        vivos = [c for c in vivos if c.similarity >= piso_relativo]

    selecionados: list[Candidate] = []
    hashes_vistos: set[str] = set()
    por_fonte: dict[str, int] = {}

    for candidato in vivos:
        if candidato.chunk_hash and candidato.chunk_hash in hashes_vistos:
            continue
        if any(
            is_near_duplicate(candidato.text, escolhido.text, cfg.near_duplicate)
            for escolhido in selecionados
        ):
            continue

        fonte = candidato.source or "(sem origem)"
        if cfg.max_per_source > 0 and por_fonte.get(fonte, 0) >= cfg.max_per_source:
            continue

        selecionados.append(candidato)
        if candidato.chunk_hash:
            hashes_vistos.add(candidato.chunk_hash)
        por_fonte[fonte] = por_fonte.get(fonte, 0) + 1

        if len(selecionados) >= top_k:
            break

    return selecionados
