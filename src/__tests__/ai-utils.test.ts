import { describe, it, expect } from "vitest";
import {
  parseModelResponse,
  filterModelList,
  formatApiError,
  getMimeType,
  type RawModelInfo,
} from "../ai-utils";

// ─── parseModelResponse ──────────────────────────────────────────────

describe("parseModelResponse", () => {
  it("parses valid JSON and returns the object as-is", () => {
    const input = JSON.stringify({
      reply: "Hello!",
      dissonanceScore: 42,
      dissonanceReason: "Moderate uncertainty",
      semanticNodes: [{ id: "a" }],
      semanticEdges: [],
    });

    const result = parseModelResponse(input);

    expect(result.reply).toBe("Hello!");
    expect(result.dissonanceScore).toBe(42);
    expect(result.semanticNodes).toHaveLength(1);
  });

  it("returns synthesized fallback for malformed JSON (raw text)", () => {
    const rawText = "I cannot produce JSON output at this time.";

    const result = parseModelResponse(rawText);

    expect(result.dissonanceScore).toBe(100);
    expect(result.dissonanceReason).toContain("Schema mismatch");
    expect(result.reply).toContain("Raw Output:");
    expect(result.reply).toContain(rawText);
    expect(result.semanticNodes).toEqual([]);
    expect(result.semanticEdges).toEqual([]);
  });

  it("handles valid JSON with extra whitespace/newlines", () => {
    const input = `
      {
        "reply": "Spaced out",
        "dissonanceScore": 10,
        "dissonanceReason": "Low",
        "semanticNodes": [],
        "semanticEdges": []
      }
    `;

    const result = parseModelResponse(input);

    expect(result.reply).toBe("Spaced out");
    expect(result.dissonanceScore).toBe(10);
  });

  it("returns synthesized fallback for an empty string", () => {
    const result = parseModelResponse("");

    expect(result.dissonanceScore).toBe(100);
    expect(result.reply).toContain("Raw Output:");
  });
});

// ─── filterModelList ─────────────────────────────────────────────────

describe("filterModelList", () => {
  const mockModels: RawModelInfo[] = [
    // Should be INCLUDED
    { name: "models/gemini-2.5-pro", displayName: "Gemini 2.5 Pro", description: "The best." },
    { name: "models/gemini-2.0-flash", displayName: "Gemini 2.0 Flash", description: "Fast." },
    { name: "models/gemini-3.1-pro-preview", displayName: "Gemini 3.1 Pro Preview", description: "Preview." },
    // Should be INCLUDED — nano
    { name: "models/gemini-2.0-flash-nano", displayName: "Nano", description: "Tiny." },
    // Should be EXCLUDED — vision
    { name: "models/gemini-pro-vision", displayName: "Vision", description: "Sees things." },
    // Should be EXCLUDED — embedding
    { name: "models/embedding-001", displayName: "Embedding", description: "Embeds." },
    // Should be EXCLUDED — aqa
    { name: "models/aqa", displayName: "AQA", description: "Answers." },
    // Should be EXCLUDED — audio
    { name: "models/gemini-audio-preview", displayName: "Audio", description: "Hears." },
    // Should be EXCLUDED — learn
    { name: "models/gemini-learnlm-1.5-pro-experimental", displayName: "LearnLM", description: "Learns." },
    // Should be EXCLUDED — bison legacy
    { name: "models/text-bison-001", displayName: "Bison", description: "Legacy." },
    // Should be EXCLUDED — gecko legacy
    { name: "models/text-gecko-001", displayName: "Gecko", description: "Legacy." },
    // Should be EXCLUDED — no 'gemini-' in name
    { name: "models/chat-model-001", displayName: "Chat", description: "Generic." },
    // Should be EXCLUDED — missing name entirely
    { displayName: "Phantom", description: "No name." },
  ];

  it("returns only valid Gemini chat models", () => {
    const result = filterModelList(mockModels);

    const names = result.map((m) => m.name);
    expect(names).toEqual([
      "models/gemini-2.5-pro",
      "models/gemini-2.0-flash",
      "models/gemini-3.1-pro-preview",
      "models/gemini-2.0-flash-nano",
    ]);
  });

  it("excludes vision, embedding, aqa, audio, learn, bison, and gecko models", () => {
    const result = filterModelList(mockModels);
    const names = result.map((m) => m.name);

    expect(names).toContain("models/gemini-2.0-flash-nano");
    expect(names).not.toContain("models/gemini-pro-vision");
    expect(names).not.toContain("models/embedding-001");
    expect(names).not.toContain("models/aqa");
    expect(names).not.toContain("models/gemini-audio-preview");
    expect(names).not.toContain("models/gemini-learnlm-1.5-pro-experimental");
    expect(names).not.toContain("models/text-bison-001");
    expect(names).not.toContain("models/text-gecko-001");
  });

  it("falls back to name without 'models/' prefix when displayName is missing", () => {
    const result = filterModelList([
      { name: "models/gemini-2.0-flash" },
    ]);

    expect(result[0].displayName).toBe("gemini-2.0-flash");
  });

  it("uses default description when description is missing", () => {
    const result = filterModelList([
      { name: "models/gemini-2.0-flash" },
    ]);

    expect(result[0].description).toBe("A Google Gemini generative model.");
  });
});

// ─── formatApiError ──────────────────────────────────────────────────

describe("formatApiError", () => {
  it("extracts .message from Error objects", () => {
    const err = new Error("API key is invalid");
    expect(formatApiError(err)).toBe("API key is invalid");
  });

  it("returns string errors as-is", () => {
    expect(formatApiError("Network timeout")).toBe("Network timeout");
  });

  it("JSON-stringifies plain objects without .message", () => {
    const err = { code: 403, status: "FORBIDDEN" };
    expect(formatApiError(err)).toBe(JSON.stringify(err));
  });

  it("extracts .message from plain objects that have one", () => {
    const err = { message: "Region blocked", code: 451 };
    expect(formatApiError(err)).toBe("Region blocked");
  });

  it("returns a meaningful fallback for null", () => {
    expect(formatApiError(null)).toBe("An unknown error occurred.");
  });

  it("returns a meaningful fallback for undefined", () => {
    expect(formatApiError(undefined)).toBe("An unknown error occurred.");
  });
});

// ─── getMimeType ─────────────────────────────────────────────────────

describe("getMimeType", () => {
  it("maps known image extensions", () => {
    expect(getMimeType("photo.png")).toBe("image/png");
    expect(getMimeType("photo.jpg")).toBe("image/jpeg");
    expect(getMimeType("photo.jpeg")).toBe("image/jpeg");
    expect(getMimeType("image.webp")).toBe("image/webp");
    expect(getMimeType("graphic.gif")).toBe("image/gif");
  });

  it("maps known document extensions", () => {
    expect(getMimeType("file.pdf")).toBe("application/pdf");
    expect(getMimeType("notes.txt")).toBe("text/plain");
    expect(getMimeType("readme.md")).toBe("text/markdown");
    expect(getMimeType("data.csv")).toBe("text/csv");
    expect(getMimeType("config.json")).toBe("application/json");
  });

  it("is case-insensitive", () => {
    expect(getMimeType("PHOTO.PNG")).toBe("image/png");
    expect(getMimeType("Report.PDF")).toBe("application/pdf");
  });

  it("handles full paths", () => {
    expect(getMimeType("/Users/someone/images/cat.jpg")).toBe("image/jpeg");
  });

  it("returns octet-stream for unknown extensions", () => {
    expect(getMimeType("archive.zip")).toBe("application/octet-stream");
    expect(getMimeType("data.parquet")).toBe("application/octet-stream");
  });

  it("returns octet-stream for files without an extension", () => {
    expect(getMimeType("Makefile")).toBe("application/octet-stream");
  });
});
