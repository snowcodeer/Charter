export function formatAgentOutput(text: string): string {
  if (!text) return ''

  let cleaned = text
    // Markdown links: [label](url) -> label
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    // Heading markers -> keep a visible section break
    .replace(/^\s*#{1,6}\s*/gm, '')
    // Bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    // Inline code
    .replace(/`([^`]+)`/g, '$1')
    // Markdown list prefixes -> consumer-readable bullets
    .replace(/^\s*[-*+]\s+/gm, '- ')
    .replace(/^\s*\d+\.\s+/gm, '- ')
    // Bracketed control tags like [APPROVED], [SKIPPED], [USER_CHOICE]
    .replace(/\[(APPROVED|SKIPPED|USER_CHOICE|AUTO-GATHERED USER CONTEXT|END CONTEXT)\]\s*/g, '')
    // Ensure sentence boundaries are readable even when model streams adjacent chunks
    .replace(/([a-z0-9])([A-Z][a-z])/g, '$1. $2')
    .replace(/([.?!])([A-Z])/g, '$1 $2')
    .trim()

  // Keep output clean and readable without markdown artifacts.
  cleaned = cleaned
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    // Convert long blobs into short paragraphs at sentence boundaries.
    .replace(/([.?!])\s+(?=[A-Z])/g, '$1\n\n')
    .replace(/\n{3,}/g, '\n\n')

  return cleaned
}
