import Image from 'next/image';

interface LogoProps {
  variant?: 'positivo' | 'negativo' | 'icon';
  height?: number;
  className?: string;
}

export function Logo({ variant = 'positivo', height = 40, className = '' }: LogoProps) {
  const src = variant === 'icon' ? '/logo-icon.svg'
    : variant === 'negativo' ? '/logo-negativo.svg'
    : '/logo-positivo.svg';

  // SVGs have 380:120 aspect ratio for full logo, 120:120 for icon
  const aspectRatio = variant === 'icon' ? 1 : 380 / 120;
  const width = Math.round(height * aspectRatio);

  return (
    <Image
      src={src}
      alt="ZappIQ"
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}
