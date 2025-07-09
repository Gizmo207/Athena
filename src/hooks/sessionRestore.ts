import { AthenaMemoryManager } from '../../lib/memory/AthenaMemoryManager';

/**
 * Loads Athena's persistent memory context from Chroma on session start.
 * Returns a formatted string of facts for system injection.
 */
export async function restoreAthenaMemoryContext(): Promise<string> {
  try {
    const memoryManager = new AthenaMemoryManager();
    const context = await memoryManager.getMemoryContext('session startup', 10);
    console.log('[Athena:sessionRestore] Loaded memory context:', context);
    return context;
  } catch (err) {
    console.error('[Athena:sessionRestore] Error restoring memory context:', err);
    return '';
  }
}
