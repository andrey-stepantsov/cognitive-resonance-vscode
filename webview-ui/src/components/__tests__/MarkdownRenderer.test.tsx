import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { MarkdownRenderer } from '../MarkdownRenderer';

// Mock MermaidDiagram
vi.mock('../MermaidDiagram', () => ({
  MermaidDiagram: ({ chart }: { chart: string }) => (
    <div data-testid="mock-mermaid-diagram">{chart}</div>
  )
}));

test('renders standard markdown elements', () => {
  render(<MarkdownRenderer content="# Hello World\n\nThis is **bold** text." />);
  
  expect(screen.getByRole('heading')).toHaveTextContent('Hello World');
  expect(screen.getByText('bold')).toHaveStyle('font-weight: bolder');
});

test('renders inline code', () => {
  render(<MarkdownRenderer content="Wait for the `await Promise.resolve()` call" />);
  const codeElement = screen.getByText('await Promise.resolve()');
  expect(codeElement.tagName).toBe('CODE');
  expect(codeElement.className).toContain('bg-zinc-800');
});

test('intercepts mermaid language blocks and renders MermaidDiagram', () => {
  const markdown = "```mermaid\ngraph TD\nA-->B\n```";
  render(<MarkdownRenderer content={markdown} />);
  
  const mermaidDiagram = screen.getByTestId('mock-mermaid-diagram');
  expect(mermaidDiagram).toBeInTheDocument();
  expect(mermaidDiagram.textContent).toBe('graph TD\nA-->B');
});
