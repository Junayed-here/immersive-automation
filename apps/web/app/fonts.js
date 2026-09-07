import { Zilla_Slab, Inter, IBM_Plex_Mono } from 'next/font/google';

export const display = Zilla_Slab({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

export const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});
