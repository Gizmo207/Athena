
// Enhanced: Replace any plausible date, relative date, or vague time reference unless in knownDates
export function sanitizeDates(text: string, knownDates: string[] = []): string {
  // Matches: Month Day, Month Day Year, relative dates, vague time references
  const datePattern = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s*\d{4})?|\b(?:today|yesterday|tomorrow|last week|last month|last year|a few days ago|recently|earlier this week|earlier this month|earlier this year|the other day|in the past|in recent days|in recent weeks|in recent months|in recent years)\b/gi;
  return text.replace(datePattern, (match) => {
    return knownDates.some(date => date.toLowerCase() === match.toLowerCase()) ? match : "[No date on record]";
  });
}
