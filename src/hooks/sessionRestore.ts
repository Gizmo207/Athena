
/**
 * Loads Athena's persistent memory context from the API route on session start.
 * Returns a formatted string of facts for system injection.
 */
export async function restoreAthenaMemoryContext(): Promise<string> {
  try {
    const res = await fetch('/api/memory-context');
    if (!res.ok) throw new Error('Failed to fetch memory context');
    const data = await res.json();
    console.log('[Athena:sessionRestore] Loaded memory context:', data.memoryContext);
    return data.memoryContext || '';
  } catch (err) {
    console.error('[Athena:sessionRestore] Error restoring memory context:', err);
    return '';
  }
}
