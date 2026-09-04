export type AiResponseTarget = "name" | "description" | "both"

export interface AiResponse {
  name?: string
  description?: string
}

export function extractAiText(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (!value || typeof value !== "object") return ""

  if (Array.isArray(value)) {
    const textOutputs = value.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        (item as Record<string, unknown>).type === "text",
    )
    const values = textOutputs.length > 0 ? textOutputs : value

    return values
      .map((item) => extractAiText(item))
      .filter(Boolean)
      .join("\n")
      .trim()
  }

  const record = value as Record<string, unknown>
  for (const key of ["text", "output_text"]) {
    if (typeof record[key] === "string" && record[key].trim()) {
      return record[key].trim()
    }
  }

  for (const key of [
    "outputs",
    "output",
    "response",
    "content",
    "candidates",
    "parts",
    "message",
  ]) {
    const text = extractAiText(record[key])
    if (text) return text
  }

  return ""
}

export function parseAiResponse(
  text: string,
  target: AiResponseTarget,
): AiResponse {
  const cleaned = text
    .trim()
    .replace(/^```(?:json|text)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as {
      name?: unknown
      description?: unknown
    }
    if (
      typeof parsed.name === "string" ||
      typeof parsed.description === "string"
    ) {
        const name =
          typeof parsed.name === "string"
            ? parsed.name.trim().substring(0, 100)
            : undefined
        const description =
          typeof parsed.description === "string"
            ? parsed.description.trim().substring(0, 300)
            : undefined

        if (target === "name") return { name }
        if (target === "description") return { description }

      return {
          name,
          description,
      }
    }
  } catch {
    // Plain text responses are parsed below.
  }

  if (target === "both") {
    const nameMatch = cleaned.match(/NAMA:\s*(.+)/i)
    const descMatch = cleaned.match(/DESKRIPSI:\s*(.+)/i)
    return {
      name: nameMatch ? nameMatch[1].trim().substring(0, 100) : undefined,
      description: descMatch
        ? descMatch[1].trim().substring(0, 300)
        : undefined,
    }
  }
  if (target === "name") {
    return { name: cleaned.substring(0, 100) }
  }
  return { description: cleaned.substring(0, 300) }
}
