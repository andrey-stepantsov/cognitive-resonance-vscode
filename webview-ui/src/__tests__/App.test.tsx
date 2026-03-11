import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App, { BUILT_IN_GEMS } from '../App';

// Retrieve the global mock created in vitest.setup.ts
const mockPostMessage = (window as any).vscode.postMessage;

// Mock ScrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const simulateExtensionMessage = (data: any) => {
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data }));
    });
  };

  it('renders correctly and dispatches webview_ready on mount', () => {
    render(<App />);
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'webview_ready' });
    expect(screen.getAllByText(/Cognitive Resonance/i)[0]).toBeInTheDocument();
  });

  it('filters models to only those starting with gemini- or Gemini', async () => {
    render(<App />);
    
    // Simulate receiving models
    simulateExtensionMessage({
      type: 'models_loaded',
      data: [
        { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
        { name: 'models/gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro' },
        { name: 'models/claude-3-opus', displayName: 'Claude 3 Opus' }, // Should be filtered out
        { name: 'models/gpt-4o', displayName: 'GPT-4o' } // Should be filtered out
      ]
    });

    // Wait for models to be rendered in the select dropdown
    const select = await screen.findByTitle('Override model for this session');
    const options = select.querySelectorAll('option');
    
    // Initial render might have default selected model options.
    // The select should only contain gemini models plus potentially the empty/invalid fallback option if not matching
    const optionValues = Array.from(options).map(opt => opt.value);
    
    expect(optionValues).toContain('gemini-2.5-flash');
    expect(optionValues).toContain('gemini-3.1-pro-preview');
    expect(optionValues).not.toContain('claude-3-opus');
    expect(optionValues).not.toContain('gpt-4o');
  });

  it('disables input when an invalid model is selected', async () => {
    render(<App />);
    
    // Simulate receiving ONLY a non-matching model
    simulateExtensionMessage({
      type: 'models_loaded',
      data: [
        { name: 'models/gemini-2.1-flash', displayName: 'Gemini 2.1 Flash' }
      ]
    });

    // We start with 'gemini-2.5-flash' selected by default, which is NOT in the list!
    // The chat input should be disabled.
    const chatInput = await screen.findByPlaceholderText('Send a message...');
    
    // Based on the logic, the input has `disabled` if selectedModel is empty or not in chatModels
    expect(chatInput).toBeDisabled();
    
    // There should also be a warning message
    expect(screen.getByText("Please select a valid 'gemini-' model to continue.")).toBeInTheDocument();
  });

  it('submits a prompt and validates sending empty model', async () => {
    const { container } = render(<App />);
    
    simulateExtensionMessage({
      type: 'models_loaded',
      data: [
        { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }
      ]
    });

    const chatInput = await screen.findByPlaceholderText('Send a message...');
    const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    
    fireEvent.change(chatInput, { target: { value: 'Hello world' } });
    fireEvent.click(submitButton);

    expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'prompt',
      model: 'gemini-2.5-flash',
      history: [{ role: 'user', content: 'Hello world' }]
    }));
  });

  it('can create a new custom gem', async () => {
    render(<App />);

    simulateExtensionMessage({
      type: 'models_loaded',
      data: [
        { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' }
      ]
    });

    simulateExtensionMessage({
      type: 'gems_loaded',
      data: []
    });

    const manageGemsButton = await screen.findByTitle('Manage Gems');
    fireEvent.click(manageGemsButton);

    const createButton = await screen.findByRole('button', { name: /create custom gem/i });
    fireEvent.click(createButton);

    const nameInputContainer = await screen.findByPlaceholderText('E.g. Code Reviewer');
    fireEvent.change(nameInputContainer, { target: { value: 'My Awesome Gem' } });

    const saveButton = await screen.findByRole('button', { name: /save gem/i });
    expect(saveButton).not.toBeDisabled();
    
    fireEvent.click(saveButton);

    // The sidebar closes upon save, so we should reopen it to verify it's in the list
    const manageGemsButtonAfterSave = await screen.findByTitle('Manage Gems');
    fireEvent.click(manageGemsButtonAfterSave);

    // Sidebar should update to show the new gem in the list
    const sidebarElements = await screen.findAllByText('My Awesome Gem');
    expect(sidebarElements.length).toBeGreaterThan(0);
    
    // It should also broadcast the save back to the extension host
    expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'save_gems_config',
      data: expect.arrayContaining([
        expect.objectContaining({ name: 'My Awesome Gem' })
      ])
    }));
  });

  it('toggles the gem sidebar and correctly changes the active gem and model', async () => {
    render(<App />);
    
    simulateExtensionMessage({
      type: 'models_loaded',
      data: [
        { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
        { name: 'models/gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro Preview' }
      ]
    });
    
    simulateExtensionMessage({
      type: 'gems_loaded',
      data: [
        { id: 'custom-1', name: 'My Custom Gem', model: 'gemini-3.1-pro-preview', systemPrompt: 'Test prompt' }
      ]
    });

    // Click the manage gems button in prompt area
    const manageGemsButton = await screen.findByTitle('Manage Gems');
    expect(manageGemsButton).toHaveTextContent('General Chat'); // Default
    
    fireEvent.click(manageGemsButton);

    // Sidebar should open and show custom gem
    const customGemText = await screen.findByText('My Custom Gem');
    expect(customGemText).toBeInTheDocument();

    // Select the custom gem
    fireEvent.click(customGemText);

    // Sidebar should close and prompt button should update
    expect(manageGemsButton).toHaveTextContent('My Custom Gem');
    
    // The selected model should also update
    const modelSelect = screen.getByTitle('Override model for this session') as HTMLSelectElement;
    expect(modelSelect.value).toBe('gemini-3.1-pro-preview');
  });

  it('selects default gem on new session', async () => {
    render(<App />);
    
    // Open History Sidebar
    const historyButton = screen.getByTitle('Session History');
    fireEvent.click(historyButton);
    
    const newSessionButton = await screen.findByText('New Session');
    fireEvent.click(newSessionButton);

    const manageGemsButton = await screen.findByTitle('Manage Gems');
    // Assuming default is General Chat or the one configured
    expect(manageGemsButton).toHaveTextContent('General Chat');
  });
});
