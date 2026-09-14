#!/usr/bin/env python3
"""
Mede recall@5 real de uma organizacao a partir dos Q&A cadastrados por ela.

Como funciona: para cada par ativo em qa_pairs, manda a PERGUNTA para o /query
do servico RAG e verifica se a fonte `qa-<id>.txt` voltou entre os top-k. E o
mesmo caminho que o WhatsApp percorre, entao mede a busca de verdade e nao uma
simulacao.

NAO RODA NO CI e NAO deve ser apontado para producao sem intencao: cada
pergunta gera um embedding pago e o /query le a base do cliente. O eval
sintetico do pytest (services/rag/tests/test_recall.py) cobre a mecanica do
ranking de graca; este script existe para a calibracao periodica.

Uso:

    export DATABASE_URL='postgresql://...'        # usuario de LEITURA
    export RAG_SERVICE_URL='http://localhost:8001'
    export RAG_SERVICE_SECRET='...'               # se o servico exigir
    python services/rag/scripts/recall_eval.py --namespace org_cmr4x0zmn007msdhtqn6lfkia

Metas combinadas no plano: 90% ou mais no CMJ (org_cmr4x0zmn007msdhtqn6lfkia) e
na MACHIA (org_cmrktle9g002epphvb02qbe1r). Sai com codigo 1 se ficar abaixo da
meta, para poder virar passo de um runbook.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys

import asyncpg
import httpx

DEFAULT_TOP_K = 5
DEFAULT_META = 0.90


def organization_id_from(namespace: str) -> str:
    return namespace[4:] if namespace.startswith("org_") else namespace


async def load_qa_pairs(database_url: str, organization_id: str, limit: int):
    conn = await asyncpg.connect(dsn=database_url, statement_cache_size=0)
    try:
        return await conn.fetch(
            """
            SELECT id, question, priority
              FROM qa_pairs
             WHERE "organizationId" = $1
               AND "isActive" = true
             ORDER BY priority DESC, "updatedAt" DESC
             LIMIT $2
            """,
            organization_id,
            limit,
        )
    finally:
        await conn.close()


async def query_rag(
    client: httpx.AsyncClient,
    base_url: str,
    secret: str,
    namespace: str,
    question: str,
    top_k: int,
    min_similarity: float,
) -> list[dict]:
    headers = {"X-Service-Secret": secret} if secret else {}
    resp = await client.post(
        f"{base_url.rstrip('/')}/query",
        json={
            "query": question,
            "namespace": namespace,
            "top_k": top_k,
            "min_similarity": min_similarity,
        },
        headers=headers,
        timeout=30.0,
    )
    resp.raise_for_status()
    return resp.json().get("results", [])


def posicao_da_fonte(results: list[dict], source: str) -> int | None:
    for idx, r in enumerate(results, start=1):
        if (r.get("source") or "") == source:
            return idx
    return None


async def run(args) -> int:
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        print("DATABASE_URL nao definido (use um usuario de LEITURA).")
        return 2

    base_url = args.rag_url or os.getenv("RAG_SERVICE_URL", "http://localhost:8001")
    secret = os.getenv("RAG_SERVICE_SECRET", "")
    organization_id = organization_id_from(args.namespace)

    pares = await load_qa_pairs(database_url, organization_id, args.limit)
    if not pares:
        print(f"Nenhum Q&A ativo em {args.namespace}. Nada a medir.")
        return 1

    acertos = 0
    linhas: list[tuple[str, str, str]] = []

    async with httpx.AsyncClient() as client:
        for par in pares:
            fonte = f"qa-{par['id']}.txt"
            pergunta = par["question"]
            try:
                results = await query_rag(
                    client,
                    base_url,
                    secret,
                    args.namespace,
                    pergunta,
                    args.top_k,
                    args.min_similarity,
                )
            except Exception as exc:  # noqa: BLE001, o erro vai para a tabela
                linhas.append((pergunta, "ERRO", str(exc)[:60]))
                continue

            pos = posicao_da_fonte(results, fonte)
            if pos is not None:
                acertos += 1
                linhas.append((pergunta, f"#{pos}", f"{len(results)} trechos"))
            else:
                topo = ", ".join((r.get("source") or "?") for r in results[:3])
                linhas.append((pergunta, "FORA", topo))

    total = len(pares)
    recall = acertos / total

    largura = 68
    print(f"\nrecall@{args.top_k} para {args.namespace}")
    print("=" * (largura + 20))
    for pergunta, posicao, detalhe in linhas:
        print(f"{pergunta[:largura]:<{largura}} {posicao:>6}  {detalhe}")
    print("=" * (largura + 20))
    print(f"acertos {acertos}/{total}   recall@{args.top_k} = {recall:.1%}")
    print(f"corte usado: min_similarity={args.min_similarity}")

    if recall < args.meta:
        print(f"ABAIXO DA META ({args.meta:.0%}).")
        return 1
    print(f"meta de {args.meta:.0%} atingida.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="recall@k da busca por organizacao")
    parser.add_argument("--namespace", required=True, help="org_<id> da organizacao")
    parser.add_argument("--top-k", type=int, default=DEFAULT_TOP_K)
    parser.add_argument("--limit", type=int, default=200, help="maximo de Q&A medidos")
    parser.add_argument("--min-similarity", type=float, default=0.35)
    parser.add_argument("--meta", type=float, default=DEFAULT_META)
    parser.add_argument("--rag-url", default=None, help="default: RAG_SERVICE_URL")
    return asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    sys.exit(main())
