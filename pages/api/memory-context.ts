
import { AthenaMemoryManager } from "../../lib/memory/AthenaMemoryManager";

export default async function handler(req, res) {
  try {
    const memoryManager = new AthenaMemoryManager();
    // You can adjust the query and k as needed
    const context = await memoryManager.getMemoryContext("motorcycle", 100);
    console.log('🧠 Raw memoryContext:', context);
    res.status(200).json({ memoryContext: context });
  } catch (error) {
    res.status(500).json({ error: "Failed to load Athena memory context." });
  }
}
