/**
 * Lightweight local diagnostics logger.
 * Writes NDJSON (one JSON object per line) to a log file inside
 * the extension's globalStorage directory. Users can export this
 * file to share with the developer for tech support.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface DiagnosticEntry {
  level: 'error' | 'warn' | 'info';
  context: string;       // e.g. 'generateContent', 'save_history', 'loadSession'
  message: string;
  detail?: unknown;      // stack trace, raw API response, etc.
}

const LOG_FILENAME = 'diagnostics.ndjson';
const MAX_LOG_SIZE_BYTES = 512 * 1024; // 512 KB — auto-rotate to avoid unbounded growth

/**
 * Resolve the full path to the diagnostics log file.
 */
export function getLogPath(storagePath: string): string {
  return path.join(storagePath, LOG_FILENAME);
}

/**
 * Append a structured diagnostic entry to the log file.
 * Creates the storage directory if it doesn't exist.
 * Automatically rotates the log if it exceeds MAX_LOG_SIZE_BYTES.
 */
export function appendDiagnostic(storagePath: string, entry: DiagnosticEntry): void {
  try {
    fs.mkdirSync(storagePath, { recursive: true });
    const logPath = getLogPath(storagePath);

    // Auto-rotate: if the log is too large, keep only the last half
    if (fs.existsSync(logPath)) {
      const stat = fs.statSync(logPath);
      if (stat.size > MAX_LOG_SIZE_BYTES) {
        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.trim().split('\n');
        const half = lines.slice(Math.floor(lines.length / 2));
        fs.writeFileSync(logPath, half.join('\n') + '\n', 'utf8');
      }
    }

    const record = {
      ts: new Date().toISOString(),
      ...entry,
    };
    fs.appendFileSync(logPath, JSON.stringify(record) + '\n', 'utf8');
  } catch {
    // Diagnostics must never crash the extension
    console.error('[diagnostics] Failed to write log entry');
  }
}

/**
 * Read the full diagnostics log as a string.
 * Returns an empty string if the file doesn't exist.
 */
export function readDiagnosticLog(storagePath: string): string {
  const logPath = getLogPath(storagePath);
  if (!fs.existsSync(logPath)) {
    return '';
  }
  return fs.readFileSync(logPath, 'utf8');
}

/**
 * Format the raw NDJSON log into a human-readable report
 * suitable for pasting into a GitHub issue or chat.
 */
export function formatDiagnosticReport(ndjson: string): string {
  if (!ndjson.trim()) {
    return 'No diagnostic entries recorded.';
  }

  const lines = ndjson.trim().split('\n');
  const header = [
    '# Cognitive Resonance Diagnostics Report',
    `Generated: ${new Date().toISOString()}`,
    `Entries: ${lines.length}`,
    '',
    '---',
    '',
  ].join('\n');

  const entries = lines.map((line, i) => {
    try {
      const entry = JSON.parse(line);
      const parts = [
        `### Entry ${i + 1} [${(entry.level || 'info').toUpperCase()}]`,
        `- **Time:** ${entry.ts}`,
        `- **Context:** ${entry.context}`,
        `- **Message:** ${entry.message}`,
      ];
      if (entry.detail) {
        parts.push(`- **Detail:**\n\`\`\`\n${typeof entry.detail === 'string' ? entry.detail : JSON.stringify(entry.detail, null, 2)}\n\`\`\``);
      }
      return parts.join('\n');
    } catch {
      return `### Entry ${i + 1} [RAW]\n\`\`\`\n${line}\n\`\`\``;
    }
  });

  return header + entries.join('\n\n');
}
