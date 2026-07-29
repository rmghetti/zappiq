'use client';

import Image from 'next/image';
import s from './prelaunch.module.css';

export function PrelaunchHeader() {
  return (
    <header className={s.topbar}>
      <div className={s.shell}>
        <div className={s.topRow}>
          <div className={s.cobrand} aria-label="ZappIQ é uma marca da MACHIA">
            <Image
              src="/zappiq-logo-dark.svg"
              alt="ZappIQ"
              className={s.cobrandZapp}
              width={140}
              height={38}
              priority
            />
            <span className={s.cobrandBy}>por</span>
            <Image
              src="/partners/machia/machia-logo-dark.svg"
              alt="MACHIA"
              className={s.cobrandPartner}
              width={120}
              height={26}
              priority
            />
          </div>

          <div className={s.tagPill}>
            <span className={s.tagPulse} />
            <span>PRÉ-LANÇAMENTO · 11 · 05 · 2026</span>
          </div>
        </div>
      </div>
    </header>
  );
}
