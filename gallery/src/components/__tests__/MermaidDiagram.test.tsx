import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { MermaidDiagram } from '../MermaidDiagram';
import mermaid from 'mermaid';

test('renders mermaid diagram placeholder and calls mermaid.render', async () => {
  const chart = 'graph TD;\nA-->B;';
  
  render(<MermaidDiagram chart={chart} />);

  // Should have called initialize
  expect(mermaid.initialize).toHaveBeenCalled();

  // Should have called render with our chart
  await waitFor(() => {
    expect(mermaid.render).toHaveBeenCalledWith(
      expect.stringContaining('mermaid-container-'),
      chart
    );
  });
});

test('handles syntax errors gracefully', async () => {
  const chart = 'invalid graph syntax';
  
  // Override mock to throw error
  vi.mocked(mermaid.render).mockRejectedValueOnce(new Error('Syntax error parsing graph'));

  render(<MermaidDiagram chart={chart} />);

  await waitFor(() => {
    expect(screen.getByText('Mermaid Syntax Error')).toBeInTheDocument();
    expect(screen.getByText('Syntax error parsing graph')).toBeInTheDocument();
  });
});
