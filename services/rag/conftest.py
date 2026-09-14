"""
Setup da suite do RAG. Roda antes de test_main.py importar main.py.

main.py le estas duas variaveis no import e nunca mais, entao a limpeza
precisa acontecer aqui e nao numa fixture:

  RAG_SERVICE_SECRET        — se o shell tiver o segredo exportado, o middleware
                              passa a exigir o header e a suite inteira vira 401.
  OTEL_EXPORTER_OTLP_ENDPOINT — com endpoint setado o SDK sobe exporters OTLP
                              que tentam falar com o gateway durante os testes.
"""

import os

import pytest

for _var in ("RAG_SERVICE_SECRET", "OTEL_EXPORTER_OTLP_ENDPOINT"):
    os.environ.pop(_var, None)


@pytest.fixture(autouse=True)
def _limpa_cache_da_coluna():
    """
    A dimensao da coluna embedding e lida uma vez e fica em memoria (o /ready
    do Fly bate a cada 15 segundos; consultar o catalogo toda vez e desperdicio
    de conexao do pool). Em teste o cache precisa comecar limpo, senao o
    resultado de um teste vaza para o proximo.
    """
    import main

    main.state.dimensao_da_coluna = None
    yield
    main.state.dimensao_da_coluna = None
