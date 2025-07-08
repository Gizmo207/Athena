"use client";

import dynamic from "next/dynamic";

// Dynamically load your Chat component only on the client
const Chat = dynamic(() => import("./Chat"), { ssr: false });

export default function ClientChat() {
  return <Chat />;
}
