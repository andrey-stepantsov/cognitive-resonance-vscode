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

function getTopMarkers(messages) {
    if (!messages) return [];
    
    // Extract all semantic nodes from model turns
    const allMarkers = messages
        .filter(m => m.role === 'model' && m.internalState && m.internalState.semanticNodes)
        .flatMap(m => m.internalState.semanticNodes.map(n => n.label || n.id));
        
    // Count frequencies
    const counts = new Map();
    allMarkers.forEach(m => counts.set(m, (counts.get(m) || 0) + 1));
    
    // Sort by frequency and take top 4
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(entry => entry[0]);
}

function processSessions() {
    console.log('Reading sessions from', sessionsDir);
    const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
    
    const registry = [];

    for (const file of files) {
        try {
            const rawContent = fs.readFileSync(path.join(sessionsDir, file), 'utf8');
            const data = JSON.parse(rawContent);
            
            const title = data.customName || file.replace('.json', '');
            const messageCount = data.messages ? data.messages.length : 0;
            const model = data.config && data.config.model ? data.config.model : 'Unknown Model';
            
            // Get a preview snippet (first user message)
            const firstUserMsg = data.messages ? data.messages.find(m => m.role === 'user') : null;
            const preview = firstUserMsg ? firstUserMsg.content.substring(0, 160) + '...' : 'No user messages...';
            
            // Extract top concepts for tags
            const tags = getTopMarkers(data.messages);

            registry.push({
                title,
                preview,
                messageCount,
                model,
                tags,
                filename: file
            });
        } catch (e) {
            console.error(`Failed to parse ${file}:`, e);
        }
    }
    
    const outputPath = path.join(outputDir, 'index.json');
    fs.writeFileSync(outputPath, JSON.stringify(registry, null, 2));
    console.log(`Gallery registry generated at ${outputPath} (${registry.length} entries)`);
}

processSessions();
