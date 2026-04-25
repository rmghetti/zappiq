'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const HIGHLIGHTS = [
  'Iza responde seu cliente em menos de 3 segundos',
  'CRM pronto, direto dentro do WhatsApp',
  'Seus dados no Brasil — servidor em São Paulo',
  'LGPD resolvida, pronta pra auditoria do jurídico',
  'Programa Fundadores: 50% off no 1º ano',
  'Liga em 5 minutos — sem ligar pra TI',
];

export function SocialProofToast() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (dismissed || isMobile) return;

    const initial = setTimeout(() => {
      setVisible(true);
    }, 8000);

    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentIdx((prev) => (prev + 1) % HIGHLIGHTS.length);
        setVisible(true);
      }, 500);
    }, 17000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [dismissed, isMobile]);

  if (dismissed || isMobile || !visible) return null;

  return (
    <div className="fixed bottom-6 left-6 z-40 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-primary-600 text-xs font-bold">✦</span>
        </div>
        <p className="text-sm text-gray-700 flex-1">{HIGHLIGHTS[currentIdx]}</p>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
          aria-label="Fechar notificação"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
