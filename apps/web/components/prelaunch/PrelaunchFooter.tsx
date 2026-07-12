'use client';

import Image from 'next/image';
import Link from 'next/link';
import s from './prelaunch.module.css';

export function PrelaunchFooter() {
  return (
    <footer className={s.foot}>
      <div className={s.shell}>
        <div className={s.footRow}>
          <div className={s.footLeft}>
            <Image
              src="/zappiq-logo-dark.svg"
              alt="ZappIQ"
              className={s.footZapp}
              width={100}
              height={26}
            />
            <Image
              src="/partners/machia/machia-symbol-dark.svg"
              alt="MACHIA"
              className={s.footOnze}
              width={32}
              height={32}
            />
          </div>
          <nav className={s.footRight}>
            <a href="mailto:marketing@zappiq.com.br">Imprensa</a>
            <a href="mailto:dpo@zappiq.com.br">DPO</a>
            <Link href="/legal/privacidade">Privacidade</Link>
            <Link href="/home">ver home →</Link>
          </nav>
          <div className={s.footCopy}>
            ONZE E ONZE CONSULTORIA EMPRESARIAL LTDA · CNPJ 46.788.145/0001-08 · Av. das Nações Unidas, 12901
            · São Paulo/SP · © 2026 ZappIQ. Produto brasileiro 🇧🇷
          </div>
        </div>
      </div>
    </footer>
  );
}
