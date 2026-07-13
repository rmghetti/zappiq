/* ══════════════════════════════════════════════════════════════════════════
 * Diagnóstico de Perfil ZappIQ — templates de e-mail
 * --------------------------------------------------------------------------
 * Duas funções puras que retornam { subject, html }:
 *   emailRelatorioCliente(dados, rec)             -> relatório para o cliente
 *   emailLeadComercial(dados, rec, respostas)     -> lead para o comercial
 *
 * O HTML é feito para caixa de entrada: tabelas, estilos inline, largura
 * máxima de 600px e responsivo. Sem travessão em nenhum texto (padrão da casa).
 * Consumido pela rota /api/diagnostico, que envia via Resend (mesmo padrão de
 * app/api/leads/route.ts). Nomes de produto seguem o Dash.
 * ══════════════════════════════════════════════════════════════════════════ */

import type { Recommendation } from './engine';

/* Dados de contato do formulário (gate para gerar o relatório). */
export interface DadosContato {
  empresa: string;
  contato: string;
  email: string;
  telefone?: string;
}

export interface RespostaResumo {
  pergunta: string;
  resposta: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
}

/* ── Identidade visual ── */
const BASE = 'https://zappiq.com.br';
const LOGO = 'https://zappiq.com.br/zappiq-logo.png';
const GRAD = 'linear-gradient(135deg,#2FB57A 0%,#2F7FB5 45%,#4A52D0 100%)';
const GRAD_FALLBACK = '#2F7FB5';
const INK = '#0A0A0A';
const GREEN = '#2FB57A';
const ACCENT = '#4A52D0';
const MUTED = '#5B5F66';
const LINE = '#E5E4DE';
const SOFT = '#F6F5F0';
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/* ── Escape de HTML (defesa contra conteúdo do formulário) ── */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* Monta link absoluto a partir do href do CTA (relativo ou absoluto). */
function absoluteHref(href: string): string {
  if (!href) return BASE;
  if (/^https?:\/\//i.test(href)) return href;
  return BASE + (href.startsWith('/') ? href : '/' + href);
}

/* ── Blocos reutilizáveis ────────────────────────────────────────────── */

/* Envelope do e-mail: doctype, responsividade e centralização em 600px. */
function shell(opts: { title: string; preheader: string; inner: string }): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(opts.title)}</title>
<style>
  body { margin:0; padding:0; width:100% !important; background:${SOFT}; }
  table { border-collapse:collapse; }
  img { border:0; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  a { color:${ACCENT}; }
  .zq-shadow { box-shadow:0 20px 40px -20px rgba(10,10,10,.15); }
  @media only screen and (max-width:620px) {
    .zq-container { width:100% !important; }
    .zq-pad { padding-left:22px !important; padding-right:22px !important; }
    .zq-cta a { display:block !important; }
    .zq-h1 { font-size:24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${SOFT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${SOFT};">${escapeHtml(
    opts.preheader,
  )}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};">
  <tr>
    <td align="center" style="padding:28px 16px;">
      <table role="presentation" width="600" class="zq-container zq-shadow" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#FFFFFF;border-radius:18px;overflow:hidden;">
        ${opts.inner}
      </table>
      <table role="presentation" width="600" class="zq-container" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">
        <tr>
          <td class="zq-pad" style="padding:18px 34px 6px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};text-align:center;">
            ZappIQ, A Platform MACHIA Company. <a href="${BASE}" style="color:${MUTED};text-decoration:underline;">zappiq.com.br</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/* Cabeçalho: logo em fundo branco e faixa com o gradiente da marca. */
function header(faixaTitulo: string, faixaSub: string): string {
  return `<tr>
  <td class="zq-pad" style="padding:30px 34px 22px;text-align:center;background:#FFFFFF;">
    <img src="${LOGO}" width="132" alt="ZappIQ" style="width:132px;height:auto;display:inline-block;">
  </td>
</tr>
<tr>
  <td style="padding:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GRAD_FALLBACK};background-image:${GRAD};">
      <tr>
        <td class="zq-pad" style="padding:26px 34px;text-align:center;">
          <div style="font-family:${FONT};font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.82);font-weight:700;">${escapeHtml(
            faixaSub,
          )}</div>
          <div class="zq-h1" style="font-family:${FONT};font-size:26px;line-height:1.25;color:#FFFFFF;font-weight:800;margin-top:6px;">${escapeHtml(
            faixaTitulo,
          )}</div>
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

/* Ponto gradiente + título de seção. */
function sectionTitle(texto: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:10px;height:10px;background:${GRAD_FALLBACK};background-image:${GRAD};border-radius:50%;"></td>
    <td style="padding-left:10px;font-family:${FONT};font-size:13px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;color:${INK};">${escapeHtml(
      texto,
    )}</td>
  </tr></table>`;
}

/* Lista com marcador verde. */
function checkList(items: string[]): string {
  const rows = items
    .map(
      (it) => `<tr>
      <td valign="top" style="padding:5px 10px 5px 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${GREEN};font-weight:800;">&#10003;</td>
      <td valign="top" style="padding:5px 0;font-family:${FONT};font-size:15px;line-height:1.55;color:#25282C;">${escapeHtml(
        it,
      )}</td>
    </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

/* Botão CTA grande (fundo gradiente com fallback sólido). */
function ctaButton(label: string, href: string): string {
  return `<table role="presentation" class="zq-cta" cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr>
      <td align="center" bgcolor="${GRAD_FALLBACK}" style="border-radius:14px;background:${GRAD_FALLBACK};background-image:${GRAD};">
        <a href="${escapeHtml(
          href,
        )}" style="display:inline-block;padding:17px 40px;font-family:${FONT};font-size:16px;font-weight:800;color:#FFFFFF;text-decoration:none;border-radius:14px;">${escapeHtml(
    label,
  )}</a>
      </td>
    </tr>
  </table>`;
}

/* ══════════════════════════════════════════════════════════════════════
 * 1) Relatório para o cliente
 * ════════════════════════════════════════════════════════════════════ */
export function emailRelatorioCliente(dados: DadosContato, rec: Recommendation): EmailTemplate {
  const empresa = escapeHtml(dados.empresa);
  const contato = escapeHtml(dados.contato);
  const href = absoluteHref(rec.cta.href);

  /* Perfil resumido: segmento + motivos ligados às respostas. */
  const perfil = `
    <p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.6;color:#25282C;">
      Pelo que você respondeu, seu perfil é de <strong>${escapeHtml(
        rec.segLabel,
      )}</strong>. Aqui está o caminho que faz mais sentido para a ${empresa} começar com a Iza atendendo, vendendo e organizando o CRM.
    </p>
    ${
      rec.motivos.length
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rec.motivos
            .map(
              (m) => `<tr>
        <td valign="top" style="padding:5px 10px 5px 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${ACCENT};font-weight:800;">&#8226;</td>
        <td valign="top" style="padding:5px 0;font-family:${FONT};font-size:15px;line-height:1.55;color:#25282C;">${escapeHtml(
          m,
        )}</td>
      </tr>`,
            )
            .join('')}</table>`
        : ''
    }`;

  /* Plano ideal em card destacado. */
  const planoCard = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:16px;background:${SOFT};">
      <tr>
        <td style="padding:22px 24px;">
          <div style="font-family:${FONT};font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:${GREEN};">Plano ideal</div>
          <div style="font-family:${FONT};font-size:28px;line-height:1.15;font-weight:800;color:${INK};margin-top:4px;">${escapeHtml(
            rec.planoNome,
          )}</div>
          <div style="font-family:${FONT};font-size:15px;font-weight:700;color:${ACCENT};margin-top:6px;">${escapeHtml(
            rec.planoPreco,
          )}</div>
          <p style="margin:12px 0 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:#25282C;">${escapeHtml(
            rec.planoEssencia,
          )}</p>
          <div style="border-top:1px solid ${LINE};padding-top:14px;">
            <div style="font-family:${FONT};font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;color:${MUTED};margin-bottom:8px;">O que vem incluso</div>
            ${checkList(rec.incluso)}
          </div>
        </td>
      </tr>
    </table>`;

  /* Produtos que atendem os objetivos. */
  const produtosBlocos = rec.produtos
    .map(
      (p) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:14px;margin-bottom:12px;">
      <tr>
        <td style="padding:18px 20px;">
          <div style="font-family:${FONT};font-size:16px;font-weight:800;color:${INK};">${escapeHtml(
            p.nome,
          )}</div>
          <p style="margin:8px 0 10px;font-family:${FONT};font-size:14px;line-height:1.6;color:#33373C;">${escapeHtml(
            p.caracteristica,
          )}</p>
          <div style="font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};padding-left:12px;border-left:3px solid ${GREEN};">${escapeHtml(
            p.casoUso,
          )}</div>
        </td>
      </tr>
    </table>`,
    )
    .join('');

  /* Add-ons recomendados (só se houver). */
  const addonsBloco = rec.addons.length
    ? `
    <tr>
      <td class="zq-pad" style="padding:6px 34px 8px;">
        ${sectionTitle('Add-ons recomendados para você')}
      </td>
    </tr>
    <tr>
      <td class="zq-pad" style="padding:0 34px 8px;">
        ${rec.addons
          .map(
            (ad) => `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:14px;margin-bottom:12px;background:#FFFFFF;">
          <tr>
            <td style="padding:16px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:${FONT};font-size:15px;font-weight:800;color:${INK};">${escapeHtml(
                    ad.nome,
                  )}</td>
                  <td align="right" style="font-family:${FONT};font-size:13px;font-weight:800;color:${ACCENT};white-space:nowrap;padding-left:12px;">${escapeHtml(
                    ad.preco,
                  )}</td>
                </tr>
              </table>
              <p style="margin:8px 0 8px;font-family:${FONT};font-size:14px;line-height:1.6;color:#33373C;">${escapeHtml(
                ad.motivo,
              )}</p>
              <div style="display:inline-block;font-family:${FONT};font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:800;color:${MUTED};background:${SOFT};border:1px solid ${LINE};border-radius:999px;padding:4px 10px;">Módulo: ${escapeHtml(
                ad.modulo,
              )}</div>
            </td>
          </tr>
        </table>`,
          )
          .join('')}
      </td>
    </tr>`
    : '';

  const inner = `
    ${header('Seu plano ideal na ZappIQ', 'Diagnóstico de Perfil')}

    <tr>
      <td class="zq-pad" style="padding:28px 34px 6px;">
        <p style="margin:0 0 6px;font-family:${FONT};font-size:17px;line-height:1.5;color:${INK};font-weight:700;">Olá, ${contato}.</p>
        <p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.6;color:#25282C;">Este é o relatório do seu diagnóstico para a <strong>${empresa}</strong>. Ele mostra o plano ideal, os produtos que resolvem o que você marcou e os add-ons que fazem sentido no seu momento.</p>
      </td>
    </tr>

    <tr>
      <td class="zq-pad" style="padding:20px 34px 8px;">
        ${sectionTitle('Seu perfil')}
      </td>
    </tr>
    <tr>
      <td class="zq-pad" style="padding:0 34px 6px;">
        ${perfil}
      </td>
    </tr>

    <tr>
      <td class="zq-pad" style="padding:18px 34px 8px;">
        ${sectionTitle('Plano ideal')}
      </td>
    </tr>
    <tr>
      <td class="zq-pad" style="padding:0 34px 10px;">
        ${planoCard}
      </td>
    </tr>

    <tr>
      <td class="zq-pad" style="padding:18px 34px 8px;">
        ${sectionTitle('Produtos que atendem você')}
      </td>
    </tr>
    <tr>
      <td class="zq-pad" style="padding:0 34px 4px;">
        ${produtosBlocos}
      </td>
    </tr>

    ${addonsBloco}

    <tr>
      <td class="zq-pad" style="padding:22px 34px 30px;text-align:center;">
        ${ctaButton(rec.cta.label, href)}
        <p style="margin:14px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">
          Sem cartão para começar. Você fala com a Iza no seu WhatsApp em minutos.
        </p>
      </td>
    </tr>

    <tr>
      <td class="zq-pad" style="padding:0 34px 30px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};border-radius:12px;">
          <tr>
            <td style="padding:16px 18px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
              Os números deste relatório são limites e capacidades da plataforma ZappIQ, não uma promessa de resultado. Cada operação evolui no seu ritmo. Você recebeu este e-mail porque preencheu o Diagnóstico de Perfil no site da ZappIQ.
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  return {
    subject: 'Seu plano ideal na ZappIQ, ' + dados.empresa,
    html: shell({
      title: 'Seu plano ideal na ZappIQ',
      preheader:
        'Plano ' + rec.planoNome + ' para a ' + dados.empresa + ', com produtos e add-ons do seu perfil.',
      inner,
    }),
  };
}

/* ══════════════════════════════════════════════════════════════════════
 * 2) Lead para o comercial
 * ════════════════════════════════════════════════════════════════════ */
export function emailLeadComercial(
  dados: DadosContato,
  rec: Recommendation,
  respostas: RespostaResumo[],
): EmailTemplate {
  const contatoLinhas = [
    { rotulo: 'Empresa', valor: dados.empresa },
    { rotulo: 'Contato', valor: dados.contato },
    { rotulo: 'E-mail', valor: dados.email },
    { rotulo: 'Telefone', valor: dados.telefone || 'Não informado' },
  ]
    .map(
      (l) => `<tr>
      <td style="padding:7px 14px 7px 0;font-family:${FONT};font-size:13px;color:${MUTED};font-weight:700;white-space:nowrap;vertical-align:top;">${escapeHtml(
        l.rotulo,
      )}</td>
      <td style="padding:7px 0;font-family:${FONT};font-size:14px;color:${INK};font-weight:600;">${escapeHtml(
        l.valor,
      )}</td>
    </tr>`,
    )
    .join('');

  const addonsLinha = rec.addons.length
    ? rec.addons.map((a) => escapeHtml(a.nome) + ' (' + escapeHtml(a.preco) + ')').join(', ')
    : 'Nenhum add-on sugerido';

  const respostasLinhas = respostas
    .map(
      (r, i) => `<tr style="background:${i % 2 === 0 ? '#FFFFFF' : SOFT};">
      <td valign="top" style="padding:9px 12px;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};border:1px solid ${LINE};width:46%;">${escapeHtml(
        r.pergunta,
      )}</td>
      <td valign="top" style="padding:9px 12px;font-family:${FONT};font-size:13px;line-height:1.5;color:${INK};font-weight:600;border:1px solid ${LINE};">${escapeHtml(
        r.resposta,
      )}</td>
    </tr>`,
    )
    .join('');

  const inner = `
    <tr>
      <td style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GRAD_FALLBACK};background-image:${GRAD};">
          <tr>
            <td class="zq-pad" style="padding:24px 34px;">
              <div style="font-family:${FONT};font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.82);font-weight:800;">ZappIQ</div>
              <div class="zq-h1" style="font-family:${FONT};font-size:24px;line-height:1.2;color:#FFFFFF;font-weight:800;margin-top:4px;">LEAD PELO DIAGNÓSTICO</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td class="zq-pad" style="padding:24px 34px 6px;">
        ${sectionTitle('Contato')}
      </td>
    </tr>
    <tr>
      <td class="zq-pad" style="padding:6px 34px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0">${contatoLinhas}</table>
      </td>
    </tr>

    <tr>
      <td class="zq-pad" style="padding:16px 34px 6px;">
        ${sectionTitle('Recomendação do motor')}
      </td>
    </tr>
    <tr>
      <td class="zq-pad" style="padding:6px 34px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:12px;background:${SOFT};">
          <tr>
            <td style="padding:16px 18px;font-family:${FONT};font-size:14px;line-height:1.7;color:${INK};">
              <strong>Plano sugerido:</strong> ${escapeHtml(rec.planoNome)} &nbsp;&#183;&nbsp; ${escapeHtml(
                rec.planoPreco,
              )}<br>
              <strong>Add-ons sugeridos:</strong> ${addonsLinha}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td class="zq-pad" style="padding:16px 34px 6px;">
        ${sectionTitle('Respostas do diagnóstico')}
      </td>
    </tr>
    <tr>
      <td class="zq-pad" style="padding:6px 34px 30px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding:9px 12px;font-family:${FONT};font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:800;color:${MUTED};background:${SOFT};border:1px solid ${LINE};">Pergunta</td>
            <td style="padding:9px 12px;font-family:${FONT};font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:800;color:${MUTED};background:${SOFT};border:1px solid ${LINE};">Resposta</td>
          </tr>
          ${respostasLinhas}
        </table>
      </td>
    </tr>`;

  return {
    subject: 'LEAD PELO DIAGNOSTICO - ' + dados.empresa,
    html: shell({
      title: 'Lead pelo Diagnóstico ZappIQ',
      preheader:
        dados.empresa + ' fez o diagnóstico. Plano sugerido: ' + rec.planoNome + '.',
      inner,
    }),
  };
}
