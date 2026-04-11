'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../../stores/authStore';
import { Logo } from '../../../components/Logo';
import { Navbar } from '../../../components/landing/Navbar';
import { Eye, EyeOff, Check, X as XIcon } from 'lucide-react';
import { PhoneInput, DocumentInput } from '../../../components/MaskedInputs';
import type { PersonType } from '../../../lib/masks';

interface PasswordCheck {
  label: string;
  met: boolean;
}

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', organizationName: '', whatsapp: '', personType: 'PJ' as PersonType, document: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passwordChecks: PasswordCheck[] = useMemo(() => [
    { label: 'Mínimo de 8 caracteres', met: form.password.length >= 8 },
    { label: 'Pelo menos 1 letra maiúscula (A-Z)', met: /[A-Z]/.test(form.password) },
    { label: 'Pelo menos 1 letra minúscula (a-z)', met: /[a-z]/.test(form.password) },
    { label: 'Pelo menos 1 número (0-9)', met: /\d/.test(form.password) },
    { label: 'Pelo menos 1 caractere especial (!@#$%^&*)', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.password) },
  ], [form.password]);

  const passwordsMatch = form.password.length > 0 && form.password === form.confirmPassword;
  const allPasswordChecksMet = passwordChecks.every(c => c.met);
  const requiredFilled = form.name.trim() !== '' && form.email.trim() !== '' && form.organizationName.trim() !== '';
  const canSubmit = requiredFilled && allPasswordChecksMet && passwordsMatch && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await register({ name: form.name, email: form.email, password: form.password, organizationName: form.organizationName });
      router.push('/onboarding');
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen flex items-center justify-center bg-background px-4 pt-24 pb-12">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <Link href="/" className="inline-block mb-3"><Logo variant="positivo" height={48} /></Link>
            <p className="text-text-secondary mt-2">Crie sua conta e comece a automatizar</p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 space-y-4">
            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Nome completo *</label>
              <input type="text" required value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" placeholder="Seu nome completo" />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Nome da Empresa *</label>
              <input type="text" required value={form.organizationName} onChange={(e) => setForm(prev => ({ ...prev, organizationName: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" placeholder="Minha Empresa LTDA" />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">E-mail *</label>
              <input type="email" required value={form.email} onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" placeholder="seu@email.com" />
            </div>

            <PhoneInput
              value={form.whatsapp}
              onChange={(val) => setForm(prev => ({ ...prev, whatsapp: val }))}
              label="WhatsApp"
              required={false}
            />

            <DocumentInput
              personType={form.personType}
              onPersonTypeChange={(type) => setForm(prev => ({ ...prev, personType: type, document: '' }))}
              value={form.document}
              onChange={(val) => setForm(prev => ({ ...prev, document: val }))}
              label="Documento"
              required={false}
            />

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Senha *</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} required value={form.password}
                  onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                  className={`w-full px-4 py-2.5 pr-10 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none ${
                    form.password.length > 0 && allPasswordChecksMet ? 'border-green-400' : 'border-gray-300'
                  }`}
                  placeholder="Crie uma senha forte" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Critérios de senha — sempre visíveis */}
              <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-1.5">
                <p className="text-xs font-medium text-gray-500 mb-1">Sua senha deve conter:</p>
                {passwordChecks.map((check) => (
                  <div key={check.label} className="flex items-center gap-2 text-xs">
                    {check.met
                      ? <Check size={13} className="text-green-500 flex-shrink-0" />
                      : <XIcon size={13} className="text-gray-300 flex-shrink-0" />}
                    <span className={check.met ? 'text-green-600 font-medium' : 'text-gray-400'}>{check.label}</span>
                  </div>
                ))}
                <p className="text-[10px] text-gray-400 pt-0.5">Especiais aceitos: ! @ # $ % ^ &amp; * ( ) _ + - =</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Confirmar Senha *</label>
              <div className="relative">
                <input type={showConfirm ? 'text' : 'password'} required value={form.confirmPassword}
                  onChange={(e) => setForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className={`w-full px-4 py-2.5 pr-10 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none ${
                    form.confirmPassword.length > 0 ? (passwordsMatch ? 'border-green-400' : 'border-red-400') : 'border-gray-300'
                  }`}
                  placeholder="Repita a senha" />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {form.confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-red-500 mt-1">As senhas não coincidem</p>
              )}
              {passwordsMatch && (
                <p className="text-xs text-green-500 mt-1 flex items-center gap-1"><Check size={12} /> Senhas coincidem</p>
              )}
            </div>

            <button type="submit" disabled={!canSubmit}
              className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${
                canSubmit ? 'bg-primary-500 hover:bg-primary-600 shadow-lg shadow-primary-500/25' : 'bg-gray-300 cursor-not-allowed'
              }`}>
              {loading ? 'Criando conta...' : 'Criar conta grátis'}
            </button>

            <p className="text-center text-sm text-text-secondary">
              Já tem conta? <Link href="/login" className="text-primary-500 font-medium hover:underline">Entrar</Link>
            </p>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">14 dias grátis · Sem cartão · Cancele quando quiser</p>
        </div>
      </div>
    </>
  );
}
