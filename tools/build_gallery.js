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
const generateHtml = (mainContent) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cognitive Resonance Gallery</title>
    <script src="https://cdn.tailwindcss.com"></script>
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
    </style>
</head>
<body class="min-h-screen p-8 text-zinc-300">
    <div class="max-w-5xl mx-auto">
        <header class="mb-12 border-b border-zinc-800 pb-6 flex items-baseline justify-between">
            <div class="flex items-center gap-4">
                <svg class="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                <h1 class="text-3xl font-bold tracking-tight text-white">Cognitive Resonance Gallery</h1>
            </div>
            <a href="https://github.com/andrey-stepantsov/cognitive-resonance-vscode/tree/main/data/gallery-sessions" class="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5">
                Submit a Chat via PR →
            </a>
        </header>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${mainContent}
        </div>
        
        <footer class="mt-20 border-t border-zinc-800 pt-8 text-center text-sm text-zinc-500">
            Powered by Cognitive Resonance VS Code Extension. Generated statically from JSON session exports.
        </footer>
    </div>
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

            // We generate individual specific HTML pages for each chat if we want, 
            // but for v1 let's just create a robust index card view
            cardsHtml += `
                <div class="group flex flex-col p-6 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-800/80 transition-all cursor-pointer shadow-lg hover:shadow-indigo-900/20">
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
                </div>
            `;
        } catch (e) {
            console.error(`Failed to parse ${file}:`, e);
        }
    }
    
    const finalHtml = generateHtml(cardsHtml);
    const outputPath = path.join(outputDir, 'index.html');
    fs.writeFileSync(outputPath, finalHtml);
    console.log(`Gallery successfully generated at ${outputPath}`);
}

processSessions();
