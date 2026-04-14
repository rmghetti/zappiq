#!/bin/bash
# ZappIQ — Configuracao SSH automatica para o GitHub
# Double-click este arquivo no Finder. Pronto.

set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

# Log visual no Terminal
echo ""
echo "═══════════════════════════════════════════════════"
echo "   ZappIQ SSH Setup — rodando sozinho"
echo "═══════════════════════════════════════════════════"
echo ""

# ─────────────────────────────────────────────
# 1. Gerar chave SSH se nao existir
# ─────────────────────────────────────────────
if [[ -f "$HOME/.ssh/id_ed25519.pub" ]]; then
  echo "✓ Chave SSH ja existe em ~/.ssh/id_ed25519"
else
  echo "→ Gerando chave SSH nova..."
  mkdir -p "$HOME/.ssh"
  chmod 700 "$HOME/.ssh"
  ssh-keygen -t ed25519 -C "rmghetti@gmail.com" -N "" -f "$HOME/.ssh/id_ed25519" >/dev/null 2>&1
  echo "✓ Chave criada em ~/.ssh/id_ed25519"
fi

# ─────────────────────────────────────────────
# 2. Copiar chave publica pra clipboard
# ─────────────────────────────────────────────
pbcopy < "$HOME/.ssh/id_ed25519.pub"
echo "✓ Chave publica copiada para a area de transferencia"

# ─────────────────────────────────────────────
# 3. Abrir GitHub no navegador padrao
# ─────────────────────────────────────────────
echo "→ Abrindo GitHub > SSH keys no navegador..."
open "https://github.com/settings/ssh/new"
sleep 1

# ─────────────────────────────────────────────
# 4. Dialog guiando a colagem
# ─────────────────────────────────────────────
osascript <<'APPLESCRIPT' || true
tell application "System Events"
    activate
    display dialog "A chave SSH JA esta na sua area de transferencia.

O GitHub abriu no navegador. Faca estes 3 passos la:

1. Campo 'Title': digite  MacBook Rodrigo
2. Campo 'Key' (grandao): pressione  Cmd + V
3. Clique o botao verde  Add SSH key

Depois volte AQUI e clique OK neste dialog." buttons {"Cancelar", "OK, salvei no GitHub"} default button 2 with title "ZappIQ SSH Setup" with icon note
end tell
APPLESCRIPT

DIALOG_RESULT=$?
if [[ $DIALOG_RESULT -ne 0 ]]; then
  echo ""
  echo "Operacao cancelada pelo usuario."
  exit 0
fi

# ─────────────────────────────────────────────
# 5. Trocar remote pra SSH
# ─────────────────────────────────────────────
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
echo ""
echo "→ Remote atual: $CURRENT_REMOTE"

if [[ "$CURRENT_REMOTE" == git@github.com:* ]]; then
  echo "✓ Remote ja esta em SSH"
elif [[ "$CURRENT_REMOTE" == https://github.com/* ]]; then
  NEW_REMOTE=$(echo "$CURRENT_REMOTE" | sed -E 's|https://github.com/([^/]+)/([^/.]+)(\.git)?|git@github.com:\1/\2.git|')
  git remote set-url origin "$NEW_REMOTE"
  echo "✓ Remote trocado para: $NEW_REMOTE"
else
  echo "⚠ Remote em formato inesperado: $CURRENT_REMOTE"
fi

# ─────────────────────────────────────────────
# 6. Testar SSH
# ─────────────────────────────────────────────
echo ""
echo "→ Testando autenticacao SSH com GitHub..."
SSH_RESULT=$(ssh -T -o StrictHostKeyChecking=accept-new -o BatchMode=yes git@github.com 2>&1 || true)
echo "$SSH_RESULT"

# ─────────────────────────────────────────────
# 7. Dialog final
# ─────────────────────────────────────────────
if echo "$SSH_RESULT" | grep -q "successfully authenticated"; then
  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "   TUDO PRONTO. Pode dormir tranquilo."
  echo "═══════════════════════════════════════════════════"
  echo ""
  echo "De manha, e so rodar:"
  echo "  cd ~/zappiq"
  echo "  git push origin main"
  echo "  git push -u origin feat/p8-ci"
  echo ""

  osascript <<'APPLESCRIPT' || true
tell application "System Events"
    activate
    display dialog "✓ SSH configurado com sucesso

De manha e so executar os comandos listados no NOTES-FOR-MORNING.md

Pode dormir tranquilo — tudo pronto." buttons {"Fechar"} default button 1 with title "ZappIQ SSH Setup — OK" with icon note
end tell
APPLESCRIPT

else
  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "   ⚠ Algo nao rolou no teste SSH"
  echo "═══════════════════════════════════════════════════"

  osascript <<APPLESCRIPT || true
tell application "System Events"
    activate
    display dialog "Teste SSH falhou. Resposta do servidor:

$SSH_RESULT

Verifique se voce colou a chave no GitHub corretamente e clicou 'Add SSH key'. Se sim, me escreva amanha." buttons {"Fechar"} default button 1 with title "ZappIQ SSH Setup — Revisar" with icon caution
end tell
APPLESCRIPT
fi

echo ""
echo "Esta janela do Terminal pode ser fechada (Cmd+W ou Cmd+Q)."
