import { memoryManager } from "@/lib/memory/AthenaMemoryManager";

export async function updateFact(userId: string, key: string, newValue: string) {
  await memoryManager.removeFactsMatching(userId, key); // Deletes old versions
  await memoryManager.addFact(userId, `${key}: ${newValue}`);
}
