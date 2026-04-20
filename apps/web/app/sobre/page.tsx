import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicLayout } from '../../components/landing/PublicLayout';

export const metadata: Metadata = {
  title: 'Sobre a ZappIQ — Plataforma Brasileira de Inteligência Conversacional',
  description:
    'ZappIQ é a plataforma brasileira de inteligência conversacional para PMEs via WhatsApp. Conheça nossa tese, time e compromissos públicos.',
};

/* V2-033 · V2-028: página institucional /sobre obrigatória no footer. */

export default function SobrePage() {
  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-6 pb-24">
        <p className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-3">Sobre</p>
        <h1 className="font-display text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-8">
          PMEs brasileiras merecem inteligência conversacional de classe mundial — sem setup fee abusivo.
        </h1>

        <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed space-y-6">
          <p>
            ZappIQ é uma plataforma brasileira de inteligência conversacional para PMEs via WhatsApp,
            operada por <strong>Onze e Onze Consultoria Empresarial Ltda</strong> (CNPJ 46.788.145/0001-08,
            d.b.a. ZappIQ). Nossa sede fiscal e técnica está em São Paulo/SP.
          </p>

          <h2 className="font-display text-2xl font-bold text-gray-900 mt-12">Nossa tese</h2>
          <p>
            O mercado brasileiro de atendimento omnichannel consolidou três vícios estruturais: setup fee
            cobrado para tarefas que a tecnologia moderna automatiza em minutos, lock-in via APIs
            proprietárias não documentadas, e planos opacos que misturam utility e marketing em uma só
            fatura. ZappIQ nasceu para romper os três: onboarding self-service de até 47 minutos, stack
            100% padrão (BSP homologado + Postgres + OpenTelemetry), e planos com preço fixo que separam
            mensagens utility de marketing conforme a cobrança real do WhatsApp Business Platform.
          </p>

          <h2 className="font-display text-2xl font-bold text-gray-900 mt-12">O que entregamos</h2>
          <p>
            Oito módulos canônicos — ZappIQCore (engine conversacional), PulseAI (IA generativa),
            SparkCampaigns (campanhas), RadarInsights (analytics), NexusCRM (CRM integrado), ForgeStudio
            (automação), EchoCopilot (assistente do atendente) e ShieldCompliance (LGPD by-default) —
            operando em infraestrutura brasileira com dados residentes no Brasil, SLA 99,9% contratual
            Enterprise e observabilidade de negócio via Radar 360°.
          </p>

          <h2 className="font-display text-2xl font-bold text-gray-900 mt-12">Compromissos públicos</h2>
          <ul className="list-disc list-outside ml-6 space-y-2">
            <li><strong>LGPD by-default:</strong> controles técnicos (criptografia AES-256, TLS 1.3, hashing de PII em logs), contratuais (DPA pronto) e organizacionais (DPO externo independente).</li>
            <li><strong>Sem setup fee escondido:</strong> planos Starter/Growth/Scale/Business têm preço público fixo. Enterprise é custom por escopo.</li>
            <li><strong>Transparência de custo WABA:</strong> utility e marketing cobrados conforme a categorização real da Meta, repassados sem markup.</li>
            <li><strong>Portabilidade garantida:</strong> exportação de dados em formato aberto via <code className="text-sm">/api/consent/export</code> assinado.</li>
          </ul>

          <h2 className="font-display text-2xl font-bold text-gray-900 mt-12">Governança e conformidade</h2>
          <p>
            Operamos em conformidade com LGPD (Lei 13.709/18), com DPO externo independente em
            homologação conforme LGPD Art. 41, DPA (Data Processing Addendum) disponível para todos os
            clientes, e programa de resposta a incidentes com SLA de 72h para notificação à ANPD quando
            aplicável.
          </p>
          <p>
            Para esclarecimentos comerciais, técnicos ou de compliance:{' '}
            <Link href="/contato" className="text-primary-600 hover:underline">página de contato</Link>
            {' · '}
            <Link href="/legal/privacidade" className="text-primary-600 hover:underline">Política de Privacidade</Link>
            {' · '}
            <Link href="/legal/dpa" className="text-primary-600 hover:underline">DPA</Link>.
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
