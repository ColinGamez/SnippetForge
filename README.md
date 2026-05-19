# Colin's Snippet Forge

Turn selected code into a clean VS Code workspace snippet without manually escaping JSON or rebuilding tab stops by hand.

## Features

- Suggest snippet prefixes from the selected code and current language.
- Detect repeated identifiers and offer them as snippet placeholders.
- Preview generated snippet JSON in an unsaved editor.
- Save snippets to `.vscode/colins-snippets.code-snippets` or copy the JSON.
- Open the workspace snippet file whenever you need to review it.

## Usage

Select code in an editor, then run **Colin's Snippet Forge: Forge Snippet From Selection** from the Command Palette or editor context menu.

## Local Development

```sh
npm install
npm run build
npx @vscode/vsce package --allow-missing-repository
```
