#!/bin/bash
# ════════════════════════════════════════════════════════════════════
#  MAESTRO v3 — Deploy do Web (Vercel, produção)
#  Roda 'vercel deploy --prod' para o app web (editor de fluxos, métricas).
#  Pré: estar logado no Vercel (vercel login) e na main já mesclada.
# ════════════════════════════════════════════════════════════════════
set -uo pipefail
REPO="/Users/rodrigoghetti/Documents/Documentos - MacBook Air de Rodrigo/Pessoal/ZappIQ/PROJETO ZAPPIQ 2026/zappiq"
cd "$REPO" || { echo "Repo não encontrado"; read -r; exit 1; }

echo "▶ Branch: $(git branch --show-current)"
read -r -p "Fazer deploy do Web no Vercel (produção) agora? (digite 's') " ok
[ "$ok" = "s" ] || { echo "Cancelado."; read -r; exit 0; }

cd "$REPO/apps/web" && npx vercel deploy --prod
echo
echo "Deploy do Web concluído (ou veja erros acima)."
echo "Confira o editor de fluxos: nó 'ask', condições por chips, botões/mídia,"
echo "toggle 'Métricas' (funil por nó) e modo 'Chamar e voltar' no goto_flow."
read -r
