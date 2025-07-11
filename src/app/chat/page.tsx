'use client';

import { ChatInterface } from '../../components/ChatInterface';

export default function ChatPage() {
  return (
    <main className="h-screen bg-gray-50">
      <ChatInterface 
        className="h-full"
        onSessionChange={(session) => {
          if (session) {
            document.title = `ATHENA - ${session.title}`;
          } else {
            document.title = 'ATHENA Chat';
          }
        }}
      />
    </main>
  );
}
