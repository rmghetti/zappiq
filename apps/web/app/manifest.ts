import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ZappIQ — IA para WhatsApp sem setup fee',
    short_name: 'ZappIQ',
    description:
      'Plataforma de IA conversacional para WhatsApp Business. Treine sua IA sozinho, sem consultor, sem setup fee. 14 dias grátis.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4f46e5',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
