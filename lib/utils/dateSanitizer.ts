export function sanitizeDates(text: string, knownDates: string[] = []): string {
  const datePattern = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s+\d{4})?\b/gi;
  return text.replace(datePattern, (match) => {
    return knownDates.includes(match) ? match : "[No date on record]";
  });
}
