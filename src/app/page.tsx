
import ClientChat from '@/components/ClientChat';

export default function Home() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-center text-2xl font-bold mb-8">Hams Minions AI Agent</h1>
      <ClientChat />
    </div>
  );
}
