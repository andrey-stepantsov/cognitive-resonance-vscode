const fs = require('fs');
const path = require('path');

const sessionsDir = path.join(__dirname, '..', 'data', 'gallery-sessions');
const outputDir = path.join(__dirname, '..', 'docs', 'gallery');

// Ensure directories exist
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Basic HTML structure matching the extension's dark theme
const generateHtml = (title, mainContent, isSubpage = false) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.1/marked.min.js"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        zinc: {
                            900: '#18181b',
                            950: '#0a0a0a',
                        }
                    }
                }
            }
        }
    </script>
    <style>
        body { background-color: #0a0a0a; color: #f4f4f5; font-family: ui-sans-serif, system-ui, sans-serif; }
        .prose pre { background-color: #18181b; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; border: 1px solid #27272a; margin-top: 0.5rem; margin-bottom: 0.5rem;}
        .prose code { color: #a5b4fc; font-family: ui-monospace, monospace; font-size: 0.875em; }
        .prose p { margin-bottom: 0.75rem; line-height: 1.6; }
        .prose > :last-child { margin-bottom: 0; }
    </style>
</head>
<body class="min-h-screen p-4 md:p-8 text-zinc-300">
    <div class="max-w-4xl mx-auto">
        <header class="mb-8 border-b border-zinc-800 pb-6">
            ${isSubpage ? `
            <a href="index.html" class="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-6">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Gallery
            </a>
            ` : ''}
            <div class="flex flex-col md:flex-row md:items-baseline justify-between gap-4">
                <div class="flex items-center gap-4">
                    <svg class="w-8 h-8 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    <h1 class="text-2xl md:text-3xl font-bold tracking-tight text-white">${title}</h1>
                </div>
                ${!isSubpage ? `
                <a href="https://github.com/andrey-stepantsov/cognitive-resonance-vscode/tree/main/data/gallery-sessions" class="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5 shrink-0">
                    Submit a Chat via PR →
                </a>
                ` : ''}
            </div>
        </header>
        
        <main>
            ${mainContent}
        </main>
        
        <footer class="mt-20 border-t border-zinc-800 pt-8 text-center text-sm text-zinc-500">
            Powered by Cognitive Resonance VS Code Extension. Generated statically from JSON session exports.
        </footer>
    </div>
    ${isSubpage ? `
    <script>
        // Parse markdown content on the client for simplicity
        document.querySelectorAll('.markdown-body').forEach(el => {
            el.innerHTML = marked.parse(el.textContent);
        });
    </script>
    ` : ''}
</body>
</html>`;

function getTopMarkers(messages) {
    if (!messages) return [];
    
    // Extract all semantic nodes from model turns
    const allMarkers = messages
        .filter(m => m.role === 'model' && m.internalState && m.internalState.semanticNodes)
        .flatMap(m => m.internalState.semanticNodes.map(n => n.label || n.id));
        
    // Count frequencies
    const counts = new Map();
    allMarkers.forEach(m => counts.set(m, (counts.get(m) || 0) + 1));
    
    // Sort intuitively and take top 4
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(entry => entry[0]);
}

function processSessions() {
    console.log('Reading sessions from', sessionsDir);
    const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
    
    let cardsHtml = '';
    
    if (files.length === 0) {
        cardsHtml = `<div class="col-span-full py-20 text-center text-zinc-500 bg-zinc-900/50 rounded-2xl border border-zinc-800 border-dashed">
            <p class="text-lg mb-2">The public gallery is currently empty.</p>
            <p class="text-sm">Export a JSON session from the extension and place it in <code>data/gallery-sessions</code> to populate it.</p>
        </div>`;
    }

    for (const file of files) {
        try {
            const rawContent = fs.readFileSync(path.join(sessionsDir, file), 'utf8');
            const data = JSON.parse(rawContent);
            
            const title = data.customName || file.replace('.json', '');
            const msgCount = data.messages ? data.messages.length : 0;
            const modelName = data.config && data.config.model ? data.config.model : 'Unknown Model';
            
            // Get a preview snippet (first user message)
            const firstUserMsg = data.messages.find(m => m.role === 'user');
            const preview = firstUserMsg ? firstUserMsg.content.substring(0, 160) + '...' : 'No user messages...';
            
            // Extract top concepts for tags
            const topMarkers = getTopMarkers(data.messages);
            const tagsHtml = topMarkers.map(t => `<span class="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 rounded border border-indigo-500/20 text-[10px] font-medium">${t}</span>`).join('');

            const fileSlug = file.replace('.json', '');
            const chatUrl = `${fileSlug}.html`;

            // Build Individual Chat Page
            let chatHtml = `<div class="flex flex-col gap-6">`;
            
            // Header for individual chat with metadata
            chatHtml += `
                <div class="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 mb-4">
                    <div class="flex flex-wrap items-center gap-3 mb-4">
                        <span class="px-2.5 py-1 bg-zinc-800 text-zinc-300 rounded text-xs font-mono border border-zinc-700/50">${modelName}</span>
                        <span class="text-xs text-zinc-500 font-mono">${msgCount} turns</span>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        ${tagsHtml}
                    </div>
                </div>
            `;
            
            // Render Messages
            if (data.messages && data.messages.length > 0) {
                for (const msg of data.messages) {
                    const isUser = msg.role === 'user';
                    
                    chatHtml += `
                        <div class="flex flex-col ${isUser ? 'items-end' : 'items-start'}">
                            <div class="text-xs font-medium text-zinc-500 mb-1.5 px-2">
                                ${isUser ? 'User' : 'Cognitive Resonance'}
                            </div>
                            <div class="max-w-[85%] rounded-2xl p-4 prose ${isUser ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100' : 'bg-zinc-900 border border-zinc-800 text-zinc-300'}">
                                <div class="markdown-body whitespace-pre-wrap">${msg.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
                            </div>
                        </div>
                    `;
                }
            }
            chatHtml += `</div>`;
            
            // Save the individual chat page
            const chatPageHtml = generateHtml(title, chatHtml, true);
            fs.writeFileSync(path.join(outputDir, chatUrl), chatPageHtml);

            // Add Card to Index Page
            cardsHtml += `
                <a href="${chatUrl}" class="group flex flex-col p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-800/80 transition-all shadow-lg hover:shadow-indigo-900/20">
                    <div class="flex justify-between items-start mb-3 gap-4">
                        <h2 class="text-lg font-semibold text-zinc-100 line-clamp-2 leading-snug group-hover:text-indigo-400 transition-colors">${title}</h2>
                    </div>
                    
                    <div class="flex items-center gap-2 mb-4">
                        <span class="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px] font-mono border border-zinc-700/50">${modelName}</span>
                         <span class="text-[10px] text-zinc-500 font-mono">${msgCount} turns</span>
                    </div>
                    
                    <p class="text-sm text-zinc-400 leading-relaxed mb-6 flex-1 line-clamp-4 italic">"${preview}"</p>
                    
                    <div class="flex flex-wrap gap-1.5 mt-auto pt-4 border-t border-zinc-800/80">
                        ${tagsHtml}
                    </div>
                </a>
            `;
        } catch (e) {
            console.error(`Failed to parse ${file}:`, e);
        }
    }
    
    // Wrap cards grid
    const indexContent = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${cardsHtml}</div>`;
    const finalHtml = generateHtml('Cognitive Resonance Gallery', indexContent, false);
    
    const outputPath = path.join(outputDir, 'index.html');
    fs.writeFileSync(outputPath, finalHtml);
    console.log(`Gallery successfully generated at ${outputPath}`);
}

processSessions();
