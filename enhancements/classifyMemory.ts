export function classifyMemory(facts: string[]): Record<string, string[]> {
  const categories = {
    preferences: [],
    goals: [],
    identity: [],
    other: [],
  };

  for (const fact of facts) {
    const normalized = fact.toLowerCase();
    if (normalized.includes("favorite") || normalized.includes("likes")) {
      categories.preferences.push(fact);
    } else if (normalized.includes("goal") || normalized.includes("mission")) {
      categories.goals.push(fact);
    } else if (normalized.includes("peter") || normalized.includes("athena")) {
      categories.identity.push(fact);
    } else {
      categories.other.push(fact);
    }
  }

  return categories;
}
