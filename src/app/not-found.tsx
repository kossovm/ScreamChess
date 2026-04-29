'use client';

import Link from 'next/link';
import { useT } from '@/components/LanguageProvider';

export default function NotFound() {
  const t = useT();
  return (
    <div className="container mx-auto px-4 py-24 text-center">
      <h1 className="text-6xl font-display font-bold mb-4">404</h1>
      <p className="text-gray-500 mb-8">{t('notfound.subtitle')}</p>
      <Link href="/" className="btn-primary">{t('notfound.back')}</Link>
    </div>
  );
}
