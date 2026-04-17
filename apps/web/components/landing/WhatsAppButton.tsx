'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';

/* Mensagem de boas-vindas do widget de chat */
const WELCOME_MESSAGE = 'Oi! Eu sou a IA da ZappIQ. Essa conversa que você está tendo agora é exatamente o que seus clientes vão experimentar. Quer ver como funciona?';

export function WhatsAppButton() {
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    // Exibir balão de boas-vindas após 3 segundos
    const timer = setTimeout(() => {
      if (sessionStorage.getItem('zappiq_chat_bubble_dismissed') !== 'true') {
        setShowBubble(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const dismissBubble = () => {
    setShowBubble(false);
    sessionStorage.setItem('zappiq_chat_bubble_dismissed', 'true');
  };

  const whatsappUrl = `https://wa.me/5511945633305?text=${encodeURIComponent(WELCOME_MESSAGE)}`;

  return (
    <>
      {/* Balão de boas-vindas */}
      {showBubble && (
        <div className="fixed bottom-24 right-6 z-50 max-w-[280px] bg-white rounded-2xl shadow-xl border border-gray-100 p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <button onClick={dismissBubble} className="absolute -top-2 -right-2 w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors">
            <X size={12} className="text-gray-500" />
          </button>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[10px] font-bold">ZQ</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-900 mb-1">Pulse IA</p>
              <p className="text-xs text-gray-600 leading-relaxed">{WELCOME_MESSAGE}</p>
            </div>
          </div>
        </div>
      )}

      {/* Botão WhatsApp */}
      <a href={whatsappUrl}
        target="_blank" rel="noopener noreferrer"
        onClick={dismissBubble}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#25D366] hover:bg-[#20bd5a] rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 transition-all hover:scale-110"
        aria-label="Fale conosco pelo WhatsApp">
        <MessageCircle size={26} className="text-white" />
      </a>
    </>
  );
}
