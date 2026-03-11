import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Mermaid since we don't want to actually render SVGs in JSDOM
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg data-testid="mock-mermaid"></svg>' }),
  },
}));

// Provide a global mock for vscode before modules are evaluated
(window as any).vscode = {
  postMessage: vi.fn()
};
