# Maintainer Guide

Instructions for maintaining the Cognitive Resonance gallery and extension.

## Gallery Workflow

The public gallery lets users browse community-submitted chats directly inside VS Code via the **Browse Public Gallery** command. Here's how it works end-to-end.

### Architecture

```
data/gallery-sessions/*.json   →   tools/build_gallery.js   →   docs/gallery/index.json
       (raw chats)                   (metadata extractor)          (registry, served via GitHub Pages)
```

The extension fetches `index.json` from GitHub Pages to populate the QuickPick, then fetches individual chat JSONs from `raw.githubusercontent.com` on demand.

### Accepting Submissions

1. A contributor opens a PR placing their exported `.json` into `data/gallery-sessions/`.
2. **Review checklist:**
   - ✅ Valid JSON with a `messages` array
   - ✅ No API keys, file paths, or personal data
   - ✅ Reasonable content (not spam or harmful)
3. Merge the PR to `main`.

### Registry Rebuild (Automated)

A GitHub Action (`.github/workflows/update-gallery.yml`) fires on every push to `main` that touches `data/gallery-sessions/**`. It runs `node tools/build_gallery.js` and auto-commits the updated `docs/gallery/index.json`.

**No manual steps needed after merging a PR.**

### Registry Rebuild (Manual)

If needed, you can rebuild locally:

```bash
node tools/build_gallery.js
git add docs/gallery/index.json
git commit -m "chore: update gallery registry"
git push origin main
```

### GitHub Pages

The repository must be configured to serve GitHub Pages from the `docs/` directory on the `main` branch. This is set in **Settings → Pages → Source**.

The registry is served at:
`https://andrey-stepantsov.github.io/cognitive-resonance-vscode/gallery/index.json`

### Registry Schema

Each entry in `index.json`:

| Field | Description |
|-------|-------------|
| `title` | `customName` from JSON, or filename without `.json` |
| `preview` | First 160 chars of the first user message |
| `messageCount` | Total messages in the session |
| `model` | Model name from `config.model` |
| `tags` | Top 4 most frequent semantic node labels across the session |
| `filename` | Original filename (e.g., `cognitive-resonance-ai-irc.json`) |

## Publishing a New Extension Version

```bash
npm run build:all          # compile extension + webview
npx vsce package           # produce .vsix
npx vsce publish           # publish to VS Code Marketplace
```

Bump `version` in `package.json` before publishing.
