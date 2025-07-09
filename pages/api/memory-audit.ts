import { AthenaMemoryManager } from "../../lib/memory/AthenaMemoryManager";

export default async function handler(req, res) {
  try {
    const memoryManager = new AthenaMemoryManager();
    const facts = await memoryManager.showMemory();
    res.status(200).json({ facts });
  } catch (error) {
    res.status(500).json({ error: "Failed to audit Athena memory." });
  }
}
