import { appInfo } from '@/lib/app-info';

export default function Home() {
  return (
    <main>
      <h1>{appInfo.name}</h1>
      <p>{appInfo.description}</p>
    </main>
  );
}
