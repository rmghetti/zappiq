#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# ZappIQ — WhatsApp Webhook Setup Script
# Configura ngrok + webhook no Meta Business para desenvolvimento local
# ═══════════════════════════════════════════════════════════════════

set -e

echo "🚀 ZappIQ — Configuração do Webhook WhatsApp"
echo "═══════════════════════════════════════════════"
echo ""

# Verificar ngrok
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok não encontrado. Instalando via Homebrew..."
    brew install ngrok/ngrok/ngrok
fi

# Verificar se o API server está rodando
if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "⚠️  API server não está rodando em localhost:3001"
    echo "   Execute primeiro: cd apps/api && npm run dev"
    echo ""
    read -p "Pressione Enter quando o server estiver rodando..."
fi

# Iniciar ngrok
echo ""
echo "📡 Iniciando ngrok tunnel na porta 3001..."
ngrok http 3001 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!
sleep 3

# Pegar URL do ngrok
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import sys, json; print(json.load(sys.stdin)['tunnels'][0]['public_url'])" 2>/dev/null)

if [ -z "$NGROK_URL" ]; then
    echo "❌ Não foi possível obter a URL do ngrok"
    kill $NGROK_PID 2>/dev/null
    exit 1
fi

WEBHOOK_URL="${NGROK_URL}/api/webhooks/whatsapp"

echo ""
echo "✅ Tunnel ativo!"
echo ""
echo "══════════════════════════════════════════════════════════"
echo "📋 CONFIGURE NO META FOR DEVELOPERS:"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "1. Acesse: https://developers.facebook.com/apps/"
echo "2. Selecione seu app → WhatsApp → Configuration"
echo "3. Em 'Webhook':"
echo ""
echo "   Callback URL:    ${WEBHOOK_URL}"
echo "   Verify Token:    zappiq-webhook-secret-2026"
echo ""
echo "4. Clique 'Verify and Save'"
echo "5. Subscribe nos campos: messages, messaging_postbacks"
echo ""
echo "══════════════════════════════════════════════════════════"
echo "📱 TESTE RÁPIDO:"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "   Envie uma mensagem para o número de teste do WhatsApp"
echo "   e veja os logs em: http://localhost:3001/health"
echo ""
echo "   curl ${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=zappiq-webhook-secret-2026&hub.challenge=OK"
echo ""
echo "══════════════════════════════════════════════════════════"
echo ""
echo "🔴 Para encerrar o tunnel, pressione Ctrl+C"
echo ""

# Manter rodando
wait $NGROK_PID
