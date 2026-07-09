import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-2xl">
        <div className="text-sm uppercase tracking-widest text-orange-400 mb-4">AI Marketing Manager</div>
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Your Facebook &amp; Instagram marketing, run by AI
        </h1>
        <p className="text-lg text-neutral-400 mb-10">
          Connect your business, and let AI plan your strategy, create your posts, and run
          your ads — while you stay in control.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/register" className="px-6 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 font-medium transition">
            Get started free
          </Link>
          <Link href="/login" className="px-6 py-3 rounded-lg border border-neutral-700 hover:border-neutral-500 font-medium transition">
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
