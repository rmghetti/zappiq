'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { WizardStep } from './WizardStep';
import { ArrowRight, Upload, X } from 'lucide-react';
import { track } from '../../lib/track';

const SEGMENTS = ['Saúde', 'Varejo', 'Educação', 'Serviços B2B', 'Financeiro', 'Outros'];
const TONES = [
  { id: 'friendly', label: 'Amigável', desc: 'Casual e receptivo' },
  { id: 'professional', label: 'Profissional', desc: 'Formal e objetivo' },
  { id: 'consultative', label: 'Consultivo', desc: 'Expertise e confiança' },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [segment, setSegment] = useState('');
  const [headcount, setHeadcount] = useState(50);
  const [agentName, setAgentName] = useState('');
  const [tone, setTone] = useState('professional');
  const [businessHours, setBusinessHours] = useState('9-18');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [documentUrl, setDocumentUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const score = step * 10;

  const handleStep1Submit = async () => {
    if (!segment) {
      setError('Selecione um segmento');
      return;
    }
    setError('');
    try {
      await fetch('/api/onboarding/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment, headcount }),
      });
      track('onboarding_step_completed', { step: 1, segment, headcount });
      track('register_started', { segment });
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar');
    }
  };

  const handleStep2Submit = async () => {
    if (!agentName.trim()) {
      setError('Nome do agente é obrigatório');
      return;
    }
    setError('');
    try {
      await fetch('/api/ai-training/identity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentName, tone, businessHours }),
      });
      track('onboarding_step_completed', { step: 2, agentName, tone, businessHours });
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar identidade');
    }
  };

  const handleStep3Submit = async () => {
    if (!uploadedFile && !documentUrl.trim()) {
      setError('Faça upload de um arquivo ou forneça uma URL');
      return;
    }
    setError('');
    setLoading(true);

    try {
      if (uploadedFile) {
        const formData = new FormData();
        formData.append('document', uploadedFile);
        const res = await fetch('/api/ai-training/documents', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error('Falha ao fazer upload');
      } else if (documentUrl.trim()) {
        const res = await fetch('/api/ai-training/documents/url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: documentUrl }),
        });
        if (!res.ok) throw new Error('Falha ao processar URL');
      }

      track('onboarding_step_completed', { step: 3 });
      track('onboarding_completed', { segment, agentName, tone });
      track('register_completed', { segment, agentName });
      router.push('/ai-training');
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer upload');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    document.cookie = 'zq_onboarding_skipped=1; path=/; SameSite=Lax';
    track('onboarding_skipped');
    router.push('/dashboard');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const valid = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'].includes(file.type);
      if (!valid) {
        setError('Formato não aceito. Use PDF, DOCX, TXT ou MD.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('Arquivo muito grande. Máximo 10MB.');
        return;
      }
      setUploadedFile(file);
      setDocumentUrl('');
      setError('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-3xl font-bold text-gray-900">Configurar sua IA</h1>
            <div className="text-2xl font-bold text-primary-500">{score}%</div>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${score}%` }} />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Segmento + Headcount */}
          {step >= 1 && (
            <>
              <WizardStep
                number={1}
                title="Qual é seu segmento?"
                description="Isso ajuda a IA a aprender melhor sobre seu contexto"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SEGMENTS.map((seg) => (
                    <button
                      key={seg}
                      onClick={() => { setSegment(seg); setError(''); }}
                      className={`px-4 py-3 rounded-lg border-2 font-medium text-sm transition-all ${
                        segment === seg
                          ? 'border-primary-500 bg-primary-50 text-primary-600'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300'
                      }`}
                    >
                      {seg}
                    </button>
                  ))}
                </div>

                {segment && (
                  <div className="mt-6 space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Headcount: <span className="text-primary-600 font-semibold">{headcount}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="500"
                      value={headcount}
                      onChange={(e) => setHeadcount(Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-xs text-gray-500">1 a 500 pessoas</p>
                  </div>
                )}

                {step === 1 && (
                  <button
                    onClick={handleStep1Submit}
                    className="mt-6 w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    Próximo <ArrowRight size={18} />
                  </button>
                )}
              </WizardStep>
            </>
          )}

          {/* Step 2: Identidade */}
          {step >= 2 && (
            <>
              <div className="border-t border-gray-200" />
              <WizardStep
                number={2}
                title="Personalizar seu agente"
                description="Como ele vai se apresentar e interagir"
              >
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome do agente *
                    </label>
                    <input
                      type="text"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="Ex: Atena, Pulse, ZappBot"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Tom de comunicação
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {TONES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setTone(t.id)}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            tone === t.id
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 bg-white hover:border-primary-300'
                          }`}
                        >
                          <p className="font-semibold text-sm text-gray-900">{t.label}</p>
                          <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Horário de atendimento
                    </label>
                    <input
                      type="text"
                      value={businessHours}
                      onChange={(e) => setBusinessHours(e.target.value)}
                      placeholder="Ex: 9-18"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    />
                  </div>
                </div>

                {step === 2 && (
                  <button
                    onClick={handleStep2Submit}
                    className="mt-6 w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    Próximo <ArrowRight size={18} />
                  </button>
                )}
              </WizardStep>
            </>
          )}

          {/* Step 3: Documento */}
          {step >= 3 && (
            <>
              <div className="border-t border-gray-200" />
              <WizardStep
                number={3}
                title="Primeiro documento para a IA aprender"
                description="Manual, FAQ, política ou qualquer documento importante"
              >
                <div className="space-y-4">
                  {/* Upload */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-all"
                  >
                    <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                    <p className="font-medium text-gray-900">Arraste ou clique para upload</p>
                    <p className="text-xs text-gray-500 mt-1">PDF, DOCX, TXT ou MD · Até 10MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      accept=".pdf,.docx,.txt,.md"
                      className="hidden"
                    />
                  </div>

                  {uploadedFile && (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                      <span className="text-sm font-medium text-green-700">{uploadedFile.name}</span>
                      <button
                        onClick={() => setUploadedFile(null)}
                        className="text-green-600 hover:text-green-700"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  )}

                  {/* URL ou arquivo */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">ou</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cole uma URL
                    </label>
                    <input
                      type="url"
                      value={documentUrl}
                      onChange={(e) => { setDocumentUrl(e.target.value); uploadedFile && setUploadedFile(null); }}
                      placeholder="https://exemplo.com/documento"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    />
                  </div>
                </div>

                {step === 3 && (
                  <button
                    onClick={handleStep3Submit}
                    disabled={loading}
                    className="mt-6 w-full bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? 'Enviando...' : 'Concluir'} <ArrowRight size={18} />
                  </button>
                )}
              </WizardStep>
            </>
          )}
        </div>

        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="mt-6 text-center text-sm text-gray-500 hover:text-gray-700 transition-colors block mx-auto"
        >
          Pular por enquanto
        </button>
      </div>
    </div>
  );
}
