import './globals.css';
import { display, sans, mono } from './fonts';

export const metadata = {
  title: 'Listing Automation',
  description: 'Automated listing digests for your buyers.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
