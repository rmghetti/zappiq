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

for _var in ("RAG_SERVICE_SECRET", "OTEL_EXPORTER_OTLP_ENDPOINT"):
    os.environ.pop(_var, None)
