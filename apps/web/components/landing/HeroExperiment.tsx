'use client';

import { useEffect } from 'react';
import { useExperiment, trackVariantExposure } from '../../lib/abTest';
import { track } from '../../lib/track';
import { HeroVariantA } from './HeroVariantA';
import { HeroVariantB } from './HeroVariantB';
import { HeroVariantC } from './HeroVariantC';

export function HeroExperiment() {
  const variant = useExperiment('hero_v1', ['A', 'B', 'C']);

  useEffect(() => {
    if (variant) {
      trackVariantExposure('hero_v1', variant);
      track('hero_cta_clicked', { variant });
    }
  }, [variant]);

  switch (variant) {
    case 'B':
      return <HeroVariantB />;
    case 'C':
      return <HeroVariantC />;
    case 'A':
    default:
      return <HeroVariantA />;
  }
}
