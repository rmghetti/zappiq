'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/* PLACEHOLDER: substituir por dados reais de clientes */
const NOTIFICATIONS = [
  'A Clínica São Lucas ativou o Pulse AI — há 3 min',
  '142 empresas testando ZappIQ agora',
  'Loja Virtual Express economizou R$8.200 este mês',
  'Escola Nova Era configurou automação em 4 minutos',
  'Studio Fitness reduziu tempo de resposta em 89%',
  'Pet Shop Amigo Fiel triplicou agendamentos online',
];

export function SocialProofToast() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Não exibir em mobile
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (dismissed || isMobile) return;

    // Primeira aparição após 8 segundos
    const initial = setTimeout(() => {
      setVisible(true);
    }, 8000);

    // Rotação a cada 15-20 segundos (variação aleatória)
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentIdx((prev) => (prev + 1) % NOTIFICATIONS.length);
        setVisible(true);
      }, 500); // pausa para animação de saída
    }, 17000); // ~17s entre cada

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
          <span className="text-primary-600 text-xs font-bold">✓</span>
        </div>
        <p className="text-sm text-gray-700 flex-1">{NOTIFICATIONS[currentIdx]}</p>
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
