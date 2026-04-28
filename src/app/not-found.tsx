import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-24 text-center">
      <h1 className="text-6xl font-display font-bold mb-4">404</h1>
      <p className="text-gray-500 mb-8">This square is empty.</p>
      <Link href="/" className="btn-primary">Back to home</Link>
    </div>
  );
}
