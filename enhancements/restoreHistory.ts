import { memoryManager } from "@/lib/memory/AthenaMemoryManager";

export async function restoreHistory(userId: string, limit: number = 10) {
  const facts = await memoryManager.getRecentFacts(userId, limit); // Assume this is implemented
  return facts.map(f => ({ role: "user", content: f.pageContent }));
}
