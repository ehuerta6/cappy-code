import Link from 'next/link';

export default function Home() {
  return (
    <main className="landing-shell">
      <h1>CappyCode</h1>
      <p>CIC Intro solution showcase</p>
      <Link href="/officer">Officer Login</Link>
    </main>
  );
}
