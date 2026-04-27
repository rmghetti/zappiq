'use client';

import Image from 'next/image';
import s from './prelaunch.module.css';

export function PrelaunchHeader() {
  return (
    <header className={s.topbar}>
      <div className={s.shell}>
        <div className={s.topRow}>
          <div className={s.cobrand} aria-label="ZappIQ é uma marca do grupo onze&onze.ai">
            <Image
              src="/logo-positivo.svg"
              alt="ZappIQ"
              className={s.cobrandZapp}
              width={140}
              height={38}
              priority
            />
            <span className={s.cobrandBy}>por</span>
            <Image
              src="/partners/onze/onze-prata.svg"
              alt="onze&onze.ai"
              className={s.cobrandOnze}
              width={150}
              height={42}
              priority
            />
          </div>

          <div className={s.tagPill}>
            <span className={s.tagPulse} />
            <span>PRÉ-LANÇAMENTO · 04 · 05 · 2026</span>
          </div>
        </div>
      </div>
    </header>
  );
}
