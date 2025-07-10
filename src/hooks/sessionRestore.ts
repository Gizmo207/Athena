
/**
 * Loads Athena's persistent memory context from the API route on session start.
 * Returns a formatted string of facts for system injection.
 */
export async function restoreAthenaMemoryContext(): Promise<string> {
  try {
    // Use our current ATHENA memory endpoint instead of the old one
    const res = await fetch('/api/athena-mistral', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'SYSTEM_MEMORY_CONTEXT_REQUEST',
        userId: 'system',
        memoryOnly: true
      })
    });
    
    if (!res.ok) {
      console.warn('[Athena:sessionRestore] Memory context fetch failed, continuing without memory');
      return '';
    }
    
    const data = await res.json();
    const memoryContext = data.memoryContext || '';
    console.log('[Athena:sessionRestore] Loaded memory context:', memoryContext);
    return memoryContext;
  } catch (err) {
    console.error('[Athena:sessionRestore] Error restoring memory context:', err);
    return '';
  }
}
