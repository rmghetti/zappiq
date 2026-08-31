/* ══════════════════════════════════════════════════════════════════════════
 * webChatWidget — script embedável (vanilla JS) do chat de site por org
 * --------------------------------------------------------------------------
 * Contraparte pública do endpoint /api/web-chat/org/:organizationId/message.
 * Servido como .js estático pra que QUALQUER site de cliente (não é Next/React
 * — ex.: cmj.com.br, que é HTML estático) possa embedar com uma linha:
 *
 *   <script src="https://zappiq-api.fly.dev/widget.js"
 *           data-org="cmr4x0zmn007msdhtqn6lfkia"></script>
 *
 * Design espelha o FAB da própria ZappIQ (apps/web/components/landing/
 * WhatsAppButton.tsx), sem a opção de menu WhatsApp — aqui é só o chat.
 * Primeiro cliente: CMJ (Vera), no lugar do botão fixo que ia pro WhatsApp
 * Web. Ver LOG do projeto CMJ, 2026-08-11.
 * ══════════════════════════════════════════════════════════════════════════ */

import { Router, type Request, type Response } from 'express';

const router = Router();

const WIDGET_JS = String.raw`
(function () {
  'use strict';
  var CUR = document.currentScript;
  if (!CUR) return;
  var ORG_ID = CUR.getAttribute('data-org');
  if (!ORG_ID) {
    console.error('[zappiq-webchat] script tag precisa de data-org="<organizationId>"');
    return;
  }
  var API_BASE = CUR.getAttribute('data-api') || 'https://zappiq-api.fly.dev';
  var AGENT_NAME = CUR.getAttribute('data-name') || 'assistente';
  var GREETING = CUR.getAttribute('data-greeting') ||
    ('Oi! Sou a ' + AGENT_NAME + '. Como posso ajudar?');
  var COLOR = CUR.getAttribute('data-color') || '#050E1F';
  var ACCENT = CUR.getAttribute('data-accent') || '#C9A961';
  var MAX_HISTORY_TURNS = 20;

  var STORAGE_SESSION = 'zqwc_session_' + ORG_ID;
  var STORAGE_MSGS = 'zqwc_msgs_' + ORG_ID;

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function getSessionId() {
    try {
      var existing = localStorage.getItem(STORAGE_SESSION);
      if (existing) return existing;
      var fresh = uid();
      localStorage.setItem(STORAGE_SESSION, fresh);
      return fresh;
    } catch (e) {
      return 'anon-' + Date.now();
    }
  }

  function loadMsgs() {
    try {
      var raw = localStorage.getItem(STORAGE_MSGS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveMsgs(msgs) {
    try {
      localStorage.setItem(STORAGE_MSGS, JSON.stringify(msgs));
    } catch (e) {}
  }

  var root = document.createElement('div');
  root.id = 'zqwc-root';
  document.body.appendChild(root);

  /* ── Shadow DOM: isola o widget do CSS/JS do site hospedeiro ──
   * Sem isso, um reset global do host (ex.: button{all:unset}) ou um
   * framework que re-renderiza o body periodicamente pode zerar nosso
   * position:fixed ou apagar nossos nós sem avisar (visto na prática ao
   * testar em cima do bundle do site do CMJ). Shadow DOM bloqueia CSS de
   * fora, mas NÃO bloqueia propriedades herdadas (font, color) — por isso
   * o :host{all:initial} abaixo. */
  var shadow = root.attachShadow({ mode: 'open' });

  var style = document.createElement('style');
  style.textContent =
    ':host{all:initial;}' +
    '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}' +
    '#zqwc-fab{position:fixed;right:22px;bottom:22px;z-index:2147483000;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;background:linear-gradient(135deg,' + COLOR + ',' + ACCENT + ');box-shadow:0 12px 32px -8px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;transition:transform .2s;}' +
    '#zqwc-fab:hover{transform:scale(1.07);}' +
    '#zqwc-fab svg{width:26px;height:26px;}' +
    '#zqwc-panel{position:fixed;right:22px;bottom:94px;z-index:2147483000;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 130px);background:#fff;border-radius:16px;box-shadow:0 24px 60px -12px rgba(0,0,0,.5);display:none;flex-direction:column;overflow:hidden;border:1px solid rgba(0,0,0,.08);}' +
    '#zqwc-panel.zqwc-open{display:flex;}' +
    '#zqwc-header{padding:14px 16px;display:flex;align-items:center;gap:10px;color:#fff;background:linear-gradient(120deg,' + COLOR + ',' + ACCENT + ');}' +
    '#zqwc-header .zqwc-title{font-size:14px;font-weight:700;line-height:1.2;}' +
    '#zqwc-header .zqwc-status{font-size:11px;opacity:.85;display:flex;align-items:center;gap:5px;}' +
    '#zqwc-header .zqwc-dot{width:6px;height:6px;border-radius:50%;background:#4ADE80;}' +
    '#zqwc-close{margin-left:auto;background:rgba(255,255,255,.15);border:none;color:#fff;width:26px;height:26px;border-radius:6px;cursor:pointer;font-size:15px;line-height:1;}' +
    '#zqwc-close:hover{background:rgba(255,255,255,.28);}' +
    '#zqwc-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#F7F7F9;}' +
    '.zqwc-bubble{max-width:82%;padding:9px 12px;border-radius:14px;font-size:13px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word;}' +
    '.zqwc-bubble a{color:inherit;text-decoration:underline;}' +
    '.zqwc-me{margin-left:auto;background:' + COLOR + ';color:#fff;border-bottom-right-radius:4px;}' +
    '.zqwc-bot{margin-right:auto;background:#fff;color:#111827;border:1px solid #E5E7EB;border-bottom-left-radius:4px;}' +
    '.zqwc-typing{margin-right:auto;background:#fff;border:1px solid #E5E7EB;border-radius:14px;padding:10px 12px;display:flex;gap:4px;}' +
    '.zqwc-typing span{width:5px;height:5px;border-radius:50%;background:#9CA3AF;animation:zqwc-bounce 1.1s infinite;}' +
    '.zqwc-typing span:nth-child(2){animation-delay:.15s;}' +
    '.zqwc-typing span:nth-child(3){animation-delay:.3s;}' +
    '@keyframes zqwc-bounce{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-4px);}}' +
    '#zqwc-form{display:flex;gap:8px;padding:10px;border-top:1px solid #E5E7EB;background:#fff;}' +
    '#zqwc-input{flex:1;border:1px solid #E5E7EB;background:#F7F7F9;border-radius:20px;padding:9px 14px;font-size:13px;outline:none;}' +
    '#zqwc-input:focus{border-color:' + ACCENT + ';}' +
    '#zqwc-send{width:36px;height:36px;border-radius:50%;border:none;background:linear-gradient(135deg,' + COLOR + ',' + ACCENT + ');color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}' +
    '#zqwc-send:disabled{opacity:.4;cursor:default;}' +
    '@media (max-width:420px){#zqwc-panel{right:12px;left:12px;width:auto;bottom:86px;}#zqwc-fab{right:16px;bottom:16px;}}';
  shadow.appendChild(style);

  /* Auto-cura: alguns sites geram o HTML com um framework próprio que
   * re-renderiza o <body> periodicamente (ex.: bundles tipo "enhance()" com
   * setInterval + MutationObserver, comuns em export de page-builder). Isso
   * apaga nós que não são dele, incluindo o nosso #zqwc-root. Em vez de tentar
   * detectar cada framework, simplesmente reanexamos o MESMO nó (preserva
   * listeners e estado) sempre que ele sai do documento. Sempre lê
   * document.body ao vivo, então funciona mesmo se o body inteiro for trocado. */
  function keepRootAttached() {
    if (!document.body.contains(root)) {
      document.body.appendChild(root);
    }
  }
  new MutationObserver(keepRootAttached).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  setInterval(keepRootAttached, 500);

  var CHAT_ICON =
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var fab = document.createElement('button');
  fab.id = 'zqwc-fab';
  fab.type = 'button';
  fab.setAttribute('aria-label', 'Abrir chat com ' + AGENT_NAME);
  fab.innerHTML = CHAT_ICON;
  shadow.appendChild(fab);

  var panel = document.createElement('div');
  panel.id = 'zqwc-panel';
  panel.setAttribute('role', 'dialog');
  panel.innerHTML =
    '<div id="zqwc-header">' +
      '<div><div class="zqwc-title">' + AGENT_NAME + '</div>' +
      '<div class="zqwc-status"><span class="zqwc-dot"></span>Online agora</div></div>' +
      '<button id="zqwc-close" type="button" aria-label="Fechar">✕</button>' +
    '</div>' +
    '<div id="zqwc-msgs"></div>' +
    '<form id="zqwc-form">' +
      '<input id="zqwc-input" type="text" autocomplete="off" placeholder="Digite sua mensagem..." />' +
      '<button id="zqwc-send" type="submit" aria-label="Enviar"><svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
    '</form>';
  shadow.appendChild(panel);

  var msgsEl = panel.querySelector('#zqwc-msgs');
  var formEl = panel.querySelector('#zqwc-form');
  var inputEl = panel.querySelector('#zqwc-input');
  var sendBtn = panel.querySelector('#zqwc-send');
  var closeBtn = panel.querySelector('#zqwc-close');

  var messages = loadMsgs();
  var typing = false;

  /* Markdown link [texto](url) + URL solta -> <a>, sem innerHTML de conteúdo
   * do LLM (evita XSS: só criamos <a> via DOM, texto vai por textContent). */
  var MD_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  var URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;

  function renderText(container, text) {
    var lastIdx = 0;
    var m;
    MD_LINK_RE.lastIndex = 0;
    var segments = [];
    while ((m = MD_LINK_RE.exec(text))) {
      if (m.index > lastIdx) segments.push({ t: 'text', v: text.slice(lastIdx, m.index) });
      segments.push({ t: 'link', label: m[1], url: m[2] });
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < text.length) segments.push({ t: 'text', v: text.slice(lastIdx) });
    if (!segments.length) segments.push({ t: 'text', v: text });

    segments.forEach(function (seg) {
      if (seg.t === 'link') {
        var a = document.createElement('a');
        a.href = seg.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = seg.label;
        container.appendChild(a);
        return;
      }
      var cursor = 0;
      var mm;
      URL_RE.lastIndex = 0;
      var v = seg.v;
      while ((mm = URL_RE.exec(v))) {
        if (mm.index > cursor) container.appendChild(document.createTextNode(v.slice(cursor, mm.index)));
        var a2 = document.createElement('a');
        a2.href = mm[0];
        a2.target = '_blank';
        a2.rel = 'noopener noreferrer';
        a2.textContent = mm[0];
        container.appendChild(a2);
        cursor = mm.index + mm[0].length;
      }
      if (cursor < v.length) container.appendChild(document.createTextNode(v.slice(cursor)));
    });
  }

  function scrollBottom() {
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function paintMessages() {
    msgsEl.innerHTML = '';
    messages.forEach(function (m) {
      var b = document.createElement('div');
      b.className = 'zqwc-bubble ' + (m.role === 'me' ? 'zqwc-me' : 'zqwc-bot');
      renderText(b, m.text);
      msgsEl.appendChild(b);
    });
    if (typing) {
      var t = document.createElement('div');
      t.className = 'zqwc-typing';
      t.innerHTML = '<span></span><span></span><span></span>';
      msgsEl.appendChild(t);
    }
    scrollBottom();
  }

  function ensureGreeting() {
    if (messages.length === 0) {
      messages.push({ role: 'bot', text: GREETING });
      saveMsgs(messages);
    }
  }

  function openPanel() {
    panel.classList.add('zqwc-open');
    ensureGreeting();
    paintMessages();
    inputEl.focus();
  }

  function closePanel() {
    panel.classList.remove('zqwc-open');
  }

  fab.addEventListener('click', function () {
    if (panel.classList.contains('zqwc-open')) {
      closePanel();
    } else {
      openPanel();
    }
  });
  closeBtn.addEventListener('click', closePanel);

  async function send(text) {
    var historySnapshot = messages.slice(-MAX_HISTORY_TURNS * 2).map(function (m) {
      return { role: m.role === 'me' ? 'user' : 'assistant', content: m.text };
    });
    messages.push({ role: 'me', text: text });
    saveMsgs(messages);
    typing = true;
    paintMessages();

    var ctrl = new AbortController();
    var timeoutId = setTimeout(function () { ctrl.abort(); }, 45000);
    try {
      var res = await fetch(API_BASE + '/api/web-chat/org/' + ORG_ID + '/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: getSessionId(), message: text, history: historySnapshot }),
        signal: ctrl.signal
      });
      var body = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        throw new Error(body && body.reply ? body.reply : 'HTTP ' + res.status);
      }
      var reply = body && body.reply ? String(body.reply) : null;
      if (!reply) throw new Error('sem resposta');
      messages.push({ role: 'bot', text: reply });
    } catch (err) {
      var fallbackText = (err && err.message && /^(HTTP |sem resposta)/.test(err.message))
        ? 'Tive uma instabilidade aqui agora. Pode tentar de novo em instantes?'
        : String(err && err.message || err);
      messages.push({ role: 'bot', text: fallbackText });
    } finally {
      clearTimeout(timeoutId);
      typing = false;
      saveMsgs(messages);
      paintMessages();
    }
  }

  formEl.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var text = inputEl.value.trim();
    if (!text || typing) return;
    inputEl.value = '';
    send(text);
  });
})();
`;

router.get('/widget.js', (_req: Request, res: Response) => {
  res.type('application/javascript; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=300'); // 5min — dá pra iterar sem cache colado

  /* O helmet() global aplica Cross-Origin-Resource-Policy: same-origin, que
   * derruba este arquivo em QUALQUER site de cliente: uma tag <script src>
   * é uma requisicao no-cors, e o CORP barra antes do CORS ser considerado.
   * O navegador recusa com ERR_BLOCKED_BY_RESPONSE.NotSameOrigin, sem erro
   * de CORS visivel, e o chat simplesmente nao aparece.
   * Este e o unico arquivo publico por natureza (script embedavel), entao a
   * excecao fica aqui e nao no helmet global.
   * Achado em 14/08 testando o embed real no site do CMJ. */
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');

  res.send(WIDGET_JS);
});

export default router;
