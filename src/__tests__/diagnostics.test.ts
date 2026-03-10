import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  appendDiagnostic,
  readDiagnosticLog,
  formatDiagnosticReport,
  getLogPath,
} from "../diagnostics";

// Use a temp directory for each test run
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cr-diag-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── appendDiagnostic ────────────────────────────────────────────────

describe("appendDiagnostic", () => {
  it("creates the log file and writes an NDJSON entry", () => {
    appendDiagnostic(tmpDir, {
      level: "error",
      context: "test",
      message: "something broke",
    });

    const content = fs.readFileSync(getLogPath(tmpDir), "utf8");
    const entry = JSON.parse(content.trim());

    expect(entry.level).toBe("error");
    expect(entry.context).toBe("test");
    expect(entry.message).toBe("something broke");
    expect(entry.ts).toBeDefined();
  });

  it("appends multiple entries on separate lines", () => {
    appendDiagnostic(tmpDir, { level: "error", context: "a", message: "first" });
    appendDiagnostic(tmpDir, { level: "warn", context: "b", message: "second" });

    const lines = fs.readFileSync(getLogPath(tmpDir), "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).message).toBe("first");
    expect(JSON.parse(lines[1]).message).toBe("second");
  });

  it("never throws even if the path is invalid", () => {
    // /dev/null/impossible is not a valid directory on any OS
    expect(() => {
      appendDiagnostic("/dev/null/impossible/path", {
        level: "error",
        context: "test",
        message: "should not throw",
      });
    }).not.toThrow();
  });
});

// ─── readDiagnosticLog ───────────────────────────────────────────────

describe("readDiagnosticLog", () => {
  it("returns empty string when no log exists", () => {
    expect(readDiagnosticLog(tmpDir)).toBe("");
  });

  it("returns the raw log content", () => {
    appendDiagnostic(tmpDir, { level: "info", context: "test", message: "hi" });
    const log = readDiagnosticLog(tmpDir);
    expect(log).toContain('"message":"hi"');
  });
});

// ─── formatDiagnosticReport ──────────────────────────────────────────

describe("formatDiagnosticReport", () => {
  it("returns a 'no entries' message for empty input", () => {
    expect(formatDiagnosticReport("")).toBe("No diagnostic entries recorded.");
    expect(formatDiagnosticReport("  \n  ")).toBe("No diagnostic entries recorded.");
  });

  it("formats NDJSON into a readable markdown report", () => {
    const ndjson = [
      JSON.stringify({ ts: "2026-01-01T00:00:00Z", level: "error", context: "api", message: "bad key" }),
      JSON.stringify({ ts: "2026-01-01T00:01:00Z", level: "warn", context: "io", message: "disk full", detail: "ENOSPC" }),
    ].join("\n");

    const report = formatDiagnosticReport(ndjson);

    expect(report).toContain("# Cognitive Resonance Diagnostics Report");
    expect(report).toContain("Entries: 2");
    expect(report).toContain("[ERROR]");
    expect(report).toContain("bad key");
    expect(report).toContain("[WARN]");
    expect(report).toContain("ENOSPC");
  });

  it("handles malformed JSON lines gracefully", () => {
    const ndjson = "not valid json\n" + JSON.stringify({ ts: "t", level: "info", context: "x", message: "ok" });
    const report = formatDiagnosticReport(ndjson);

    expect(report).toContain("[RAW]");
    expect(report).toContain("not valid json");
    expect(report).toContain("[INFO]");
  });
});
