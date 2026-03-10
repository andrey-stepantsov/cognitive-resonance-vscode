/**
 * Pure utility functions extracted from extension.ts for testability.
 * These functions have zero dependencies on vscode.* or GoogleGenAI —
 * they take plain data in and return plain data out.
 */

// ─── Types ───────────────────────────────────────────────────────────

/** The structured response shape our UI expects. */
export interface CognitiveResponse {
  reply: string;
  dissonanceScore: number;
  dissonanceReason: string;
  semanticNodes: unknown[];
  semanticEdges: unknown[];
  [key: string]: unknown; // allow extra fields from the model
}

/** Minimal model info as returned by the GenAI list endpoint. */
export interface RawModelInfo {
  name?: string;
  displayName?: string;
  description?: string;
}

/** Cleaned model entry sent to the webview. */
export interface FilteredModel {
  name: string;
  displayName: string;
  description: string;
}

// ─── parseModelResponse ──────────────────────────────────────────────

/**
 * Parse a JSON string returned by `ai.models.generateContent`.
 *
 * - If the string is valid JSON, returns the parsed object as-is.
 * - If parsing fails (malformed / raw text from experimental models),
 *   returns a synthesized fallback with `dissonanceScore: 100` and the
 *   raw text embedded in `reply`.
 */
export function parseModelResponse(jsonStr: string): CognitiveResponse {
  try {
    const data = JSON.parse(jsonStr);
    return data as CognitiveResponse;
  } catch {
    return {
      reply:
        "*(The model failed to return a valid JSON format. This usually happens with experimental/nano models that do not support forced structured output).*\\n\\nRaw Output:\\n" +
        jsonStr,
      dissonanceScore: 100,
      dissonanceReason:
        "Schema mismatch: The model disregarded requested JSON constraints.",
      semanticNodes: [],
      semanticEdges: [],
    };
  }
}

// ─── filterModelList ─────────────────────────────────────────────────

/**
 * Filter a raw list of models from `ai.models.list()` down to the
 * primary Gemini generative chat models, excluding legacy and
 * specialized variants.
 */
export function filterModelList(models: RawModelInfo[]): FilteredModel[] {
  const result: FilteredModel[] = [];

  for (const m of models) {
    if (!m.name) continue;
    const name = m.name.toLowerCase();

    // Only include primary Gemini generative models
    if (!name.includes("gemini-")) continue;

    // Exclude legacy single-turn vision models
    if (name.includes("-vision")) continue;

    // Exclude specialized and embedding models
    if (
      name.includes("embedding") ||
      name.includes("aqa") ||
      name.includes("audio") ||
      name.includes("learn")
    )
      continue;
    if (name.includes("bison") || name.includes("gecko")) continue;

    result.push({
      name: m.name,
      displayName: m.displayName || m.name.replace("models/", ""),
      description: m.description || "A Google Gemini generative model.",
    });
  }

  return result;
}

// ─── formatApiError ──────────────────────────────────────────────────

/**
 * Normalize any error shape into a user-friendly string.
 * Handles Error objects, plain objects, strings, and null/undefined.
 */
export function formatApiError(error: unknown): string {
  if (error === null || error === undefined) {
    return "An unknown error occurred.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error === "object") {
    // Some API errors are plain objects with a `message` property
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === "string") {
      return obj.message;
    }
    return JSON.stringify(error);
  }
  return String(error);
}

// ─── getMimeType ─────────────────────────────────────────────────────

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".xml": "application/xml",
  ".html": "text/html",
  ".js": "text/javascript",
  ".ts": "text/typescript",
  ".py": "text/x-python",
};

/**
 * Resolve a MIME type from a file path's extension.
 * Returns `"application/octet-stream"` for unrecognised extensions.
 */
export function getMimeType(filePath: string): string {
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  const ext = filePath.slice(dot).toLowerCase();
  return MIME_MAP[ext] ?? "application/octet-stream";
}
