import { AthenaMemoryManager } from "@/lib/memory/AthenaMemoryManager";

export default async function handler(req, res) {
  const memoryManager = new AthenaMemoryManager();
  const facts = await memoryManager.showMemory();
  res.status(200).json({ facts });
}
