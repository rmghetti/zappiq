import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ZappIQ: IA que atende e vende no WhatsApp e Instagram',
    short_name: 'ZappIQ',
    description:
      'Operação autônoma de atendimento e vendas no WhatsApp e Instagram. A Iza atende, vende e faz campanha; você aprova, ela executa. 14 dias grátis, sem setup fee.',
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
