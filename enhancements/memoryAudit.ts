import { memoryManager } from "@/lib/memory/AthenaMemoryManager";

export async function auditMemory(userId: string): Promise<string[]> {
  const allFacts = await memoryManager.getAllFacts(userId); // Assume this is implemented
  return allFacts.map(doc => doc.pageContent);
}
