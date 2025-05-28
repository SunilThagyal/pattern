import Link from 'next/link';
import { Brush } from 'lucide-react';

export default function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-primary hover:opacity-80 transition-opacity duration-200">
      <Brush className="h-8 w-8" />
      <span>Pattern Party</span>
    </Link>
  );
}
