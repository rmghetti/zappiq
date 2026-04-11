'use client';

import { useState, useEffect } from 'react';
import {
  formatPhone, isValidPhone,
  formatCPF, isValidCPF,
  formatCNPJ, isValidCNPJ,
  formatDocument, isValidDocument,
  type PersonType,
} from '../lib/masks';

// ═══════════════════════════════════════════════════════════════════
// Componentes reutilizáveis com máscara automática
// ═══════════════════════════════════════════════════════════════════

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
  disabled?: boolean;
}

// ── PhoneInput ────────────────────────────────────────────────────

export function PhoneInput({ value, onChange, label = 'Telefone', required = false, error, className = '', disabled = false }: InputProps) {
  const digits = value.replace(/\D/g, '');
  const valid = digits.length === 0 || isValidPhone(value);

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        type="tel"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(formatPhone(e.target.value))}
        placeholder="+55 11 99999-9999"
        maxLength={17}
        disabled={disabled}
        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors ${
          digits.length > 0 && !valid ? 'border-red-400' : digits.length >= 12 && valid ? 'border-green-400' : 'border-gray-300'
        } ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`}
      />
      {digits.length > 0 && !valid && (
        <p className="text-xs text-red-500 mt-1">Formato esperado: +55 11 99999-9999</p>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ── DocumentInput (CPF ou CNPJ com seletor PF/PJ) ────────────────

interface DocumentInputProps {
  personType: PersonType;
  onPersonTypeChange: (type: PersonType) => void;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
  showSelector?: boolean;
  disabled?: boolean;
}

export function DocumentInput({
  personType: personTypeProp,
  onPersonTypeChange,
  value,
  onChange,
  label = 'Documento',
  required = false,
  error,
  className = '',
  showSelector = true,
  disabled = false,
}: DocumentInputProps) {
  // Estado local para controle imediato da UI (não depende de re-render do parent)
  const [personType, setPersonType] = useState<PersonType>(personTypeProp);

  // Sincroniza se o prop externo mudar
  useEffect(() => {
    setPersonType(personTypeProp);
  }, [personTypeProp]);

  function handleSelect(type: PersonType) {
    setPersonType(type);
    onPersonTypeChange(type);
    if (value) onChange(''); // limpa o campo ao trocar o tipo
  }

  const digits = value.replace(/\D/g, '');
  const expectedLength = personType === 'PF' ? 11 : 14;
  const valid = digits.length === 0 || isValidDocument(value, personType);
  const complete = digits.length === expectedLength;

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {showSelector && (
        <div className="flex gap-2 mb-2">
          {/* Radio inputs: onChange funciona de forma confiável como evento nativo no React */}
          <label
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border cursor-pointer transition-all select-none ${
              personType === 'PF'
                ? 'bg-primary-50 border-primary-500 text-primary-700'
                : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'
            }`}
          >
            <input
              type="radio"
              name="docPersonType"
              value="PF"
              checked={personType === 'PF'}
              onChange={() => handleSelect('PF')}
              className="sr-only"
              disabled={disabled}
            />
            👤 Pessoa Física (CPF)
          </label>
          <label
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border cursor-pointer transition-all select-none ${
              personType === 'PJ'
                ? 'bg-primary-50 border-primary-500 text-primary-700'
                : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'
            }`}
          >
            <input
              type="radio"
              name="docPersonType"
              value="PJ"
              checked={personType === 'PJ'}
              onChange={() => handleSelect('PJ')}
              className="sr-only"
              disabled={disabled}
            />
            🏢 Pessoa Jurídica (CNPJ)
          </label>
        </div>
      )}

      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(formatDocument(e.target.value, personType))}
        placeholder={personType === 'PF' ? '999.999.999-99' : '99.999.999/9999-99'}
        maxLength={personType === 'PF' ? 14 : 18}
        disabled={disabled}
        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors ${
          complete && !valid ? 'border-red-400' : complete && valid ? 'border-green-400' : 'border-gray-300'
        } ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`}
      />

      {complete && !valid && (
        <p className="text-xs text-red-500 mt-1">
          {personType === 'PF' ? 'CPF inválido. Verifique os números digitados.' : 'CNPJ inválido. Verifique os números digitados.'}
        </p>
      )}
      {complete && valid && (
        <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
          ✓ {personType === 'PF' ? 'CPF' : 'CNPJ'} válido
        </p>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ── CPFInput (sem seletor, apenas CPF) ────────────────────────────

export function CPFInput({ value, onChange, label = 'CPF', required = false, error, className = '', disabled = false }: InputProps) {
  const digits = value.replace(/\D/g, '');
  const valid = digits.length === 0 || isValidCPF(value);
  const complete = digits.length === 11;

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(formatCPF(e.target.value))}
        placeholder="999.999.999-99"
        maxLength={14}
        disabled={disabled}
        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors ${
          complete && !valid ? 'border-red-400' : complete && valid ? 'border-green-400' : 'border-gray-300'
        } ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`}
      />
      {complete && !valid && <p className="text-xs text-red-500 mt-1">CPF inválido</p>}
      {complete && valid && <p className="text-xs text-green-500 mt-1">✓ CPF válido</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ── CNPJInput (sem seletor, apenas CNPJ) ──────────────────────────

export function CNPJInput({ value, onChange, label = 'CNPJ', required = false, error, className = '', disabled = false }: InputProps) {
  const digits = value.replace(/\D/g, '');
  const valid = digits.length === 0 || isValidCNPJ(value);
  const complete = digits.length === 14;

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(formatCNPJ(e.target.value))}
        placeholder="99.999.999/9999-99"
        maxLength={18}
        disabled={disabled}
        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors ${
          complete && !valid ? 'border-red-400' : complete && valid ? 'border-green-400' : 'border-gray-300'
        } ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`}
      />
      {complete && !valid && <p className="text-xs text-red-500 mt-1">CNPJ inválido</p>}
      {complete && valid && <p className="text-xs text-green-500 mt-1">✓ CNPJ válido</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
