export function formatAgentOutput(text: string): string {
  if (!text) return ''

  let cleaned = text
    // Markdown links: [label](url) -> label
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    // Heading markers
    .replace(/^\s*#{1,6}\s*/gm, '')
    // Bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    // Inline code
    .replace(/`([^`]+)`/g, '$1')
    // Normalize markdown list prefixes to "- "
    .replace(/^\s*[*+]\s+/gm, '- ')
    .replace(/^\s*\d+\.\s+/gm, '- ')
    // Bracketed control tags like [APPROVED], [SKIPPED], [USER_CHOICE]
    .replace(/\[(APPROVED|SKIPPED|USER_CHOICE|AUTO-GATHERED USER CONTEXT|END CONTEXT)\]\s*/g, '')
    // Ensure sentence boundaries are readable even when model streams adjacent chunks
    .replace(/([a-z0-9])([A-Z][a-z])/g, '$1. $2')
    .replace(/([.?!])([A-Z])/g, '$1 $2')
    .trim()

  // Split into lines, process bullet vs prose separately
  const lines = cleaned.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) {
      // Collapse multiple blanks into one
      if (result.length > 0 && result[result.length - 1] !== '') {
        result.push('')
      }
      continue
    }

    const isBullet = line.startsWith('- ')
    const prevIsBullet = result.length > 0 && result[result.length - 1].startsWith('- ')

    if (isBullet) {
      // Blank line before first bullet in a group (if preceded by prose)
      if (result.length > 0 && !prevIsBullet && result[result.length - 1] !== '') {
        result.push('')
      }
      result.push(line)
    } else {
      // Prose line — add blank after bullet group ends
      if (prevIsBullet) {
        result.push('')
      }
      result.push(line)
    }
  }

  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
