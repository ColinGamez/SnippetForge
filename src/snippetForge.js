const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const { workspaceRoot } = require("./project");

const SNIPPET_FORGE_FILE = ".vscode/colins-snippets.code-snippets";
const SNIPPET_KEYWORDS = new Set([
  "abstract",
  "async",
  "await",
  "boolean",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "null",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "with",
  "yield"
]);

function selectedEditorText() {
  const editor = vscode.window.activeTextEditor;

  if (!editor || editor.selection.isEmpty) {
    return { editor, text: "" };
  }

  return {
    editor,
    text: editor.document.getText(editor.selection)
  };
}

function slugWords(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function suggestSnippetPrefix(text, languageId) {
  const firstUsefulLine = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("//") && !line.startsWith("#"));
  const words = slugWords(firstUsefulLine).slice(0, 4);
  const base = words.length ? words.join("-").toLowerCase() : "snippet";
  return languageId ? `${languageId}-${base}` : base;
}

function suggestSnippetName(prefix) {
  return slugWords(prefix)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ") || "New Snippet";
}

function detectPlaceholderCandidates(text) {
  const counts = new Map();
  const matches = String(text || "").match(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g) || [];

  for (const match of matches) {
    if (match.length < 3 || SNIPPET_KEYWORDS.has(match) || /^[A-Z0-9_]+$/.test(match)) {
      continue;
    }

    counts.set(match, (counts.get(match) || 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([label, count]) => ({ label, description: `${count} uses`, picked: count > 1 }));
}

function escapeSnippetLiteral(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\$/g, "\\$")
    .replace(/\}/g, "\\}");
}

function placeholderDefault(value) {
  return String(value || "").replace(/[\\}:$]/g, "");
}

function snippetBodyLines(text, placeholders) {
  const selected = [...new Set(placeholders)].filter(Boolean);

  if (!selected.length) {
    return String(text || "").split(/\r?\n/).map(escapeSnippetLiteral);
  }

  const placeholderIndex = new Map(selected.map((name, index) => [name, index + 1]));
  const pattern = new RegExp(`\\b(${selected.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "g");

  return String(text || "")
    .split(/\r?\n/)
    .map((line) => {
      let output = "";
      let lastIndex = 0;

      line.replace(pattern, (match, _capture, offset) => {
        output += escapeSnippetLiteral(line.slice(lastIndex, offset));
        output += `\${${placeholderIndex.get(match)}:${placeholderDefault(match)}}`;
        lastIndex = offset + match.length;
        return match;
      });

      output += escapeSnippetLiteral(line.slice(lastIndex));
      return output;
    });
}

function buildSnippetEntry({ name, prefix, scope, description, text, placeholders }) {
  return {
    [name]: {
      prefix,
      scope,
      body: snippetBodyLines(text, placeholders),
      description
    }
  };
}

function workspaceSnippetPath() {
  const root = workspaceRoot();
  return root ? path.join(root, SNIPPET_FORGE_FILE) : "";
}

function uniqueSnippetName(existing, preferredName) {
  if (!existing[preferredName]) {
    return preferredName;
  }

  let counter = 2;
  let candidate = `${preferredName} ${counter}`;

  while (existing[candidate]) {
    counter += 1;
    candidate = `${preferredName} ${counter}`;
  }

  return candidate;
}

function readSnippetFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }

  const text = fs.readFileSync(filePath, "utf8").trim();
  return text ? JSON.parse(text) : {};
}

async function saveWorkspaceSnippet(snippetEntry) {
  const filePath = workspaceSnippetPath();

  if (!filePath) {
    vscode.window.showWarningMessage("Snippet Forge needs an open workspace before it can save a workspace snippet.");
    return;
  }

  let existing;

  try {
    existing = readSnippetFile(filePath);
  } catch {
    vscode.window.showErrorMessage("Snippet Forge could not parse the existing workspace snippet file.");
    return;
  }

  const [preferredName] = Object.keys(snippetEntry);
  const name = uniqueSnippetName(existing, preferredName);
  const next = {
    ...existing,
    [name]: snippetEntry[preferredName]
  };

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), Buffer.from(`${JSON.stringify(next, null, 2)}\n`, "utf8"));
  vscode.window.showInformationMessage(`Snippet Forge: saved "${name}" to ${SNIPPET_FORGE_FILE}.`);
}

async function openWorkspaceSnippets() {
  const filePath = workspaceSnippetPath();

  if (!filePath) {
    vscode.window.showWarningMessage("Open a workspace before opening the Snippet Forge workspace snippet file.");
    return;
  }

  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), Buffer.from("{}\n", "utf8"));
  }

  await vscode.window.showTextDocument(vscode.Uri.file(filePath));
}

async function createSnippetFromSelection() {
  const { editor, text } = selectedEditorText();

  if (!editor || !text.trim()) {
    vscode.window.showWarningMessage("Select code first, then run Snippet Forge.");
    return;
  }

  const languageId = editor.document.languageId || "plaintext";
  const prefix = await vscode.window.showInputBox({
    title: "Snippet Forge",
    prompt: "Snippet prefix",
    value: suggestSnippetPrefix(text, languageId),
    validateInput: (value) => (value.trim() ? undefined : "A snippet prefix is required.")
  });

  if (!prefix) {
    return;
  }

  const description = await vscode.window.showInputBox({
    title: "Snippet Forge",
    prompt: "Snippet description",
    value: suggestSnippetName(prefix)
  });

  if (description === undefined) {
    return;
  }

  const scope = await vscode.window.showInputBox({
    title: "Snippet Forge",
    prompt: "Language scope for this workspace snippet",
    value: languageId
  });

  if (scope === undefined) {
    return;
  }

  const candidates = detectPlaceholderCandidates(text);
  const picked = candidates.length
    ? await vscode.window.showQuickPick(candidates, {
        canPickMany: true,
        title: "Snippet Forge placeholders",
        placeHolder: "Pick repeated identifiers to turn into tab stops"
      })
    : [];

  if (picked === undefined) {
    return;
  }

  const name = suggestSnippetName(prefix);
  const snippetEntry = buildSnippetEntry({
    name,
    prefix: prefix.trim(),
    scope: scope.trim() || languageId,
    description: description.trim() || name,
    text,
    placeholders: picked.map((item) => item.label)
  });
  const snippetJson = `${JSON.stringify(snippetEntry, null, 2)}\n`;
  const preview = await vscode.workspace.openTextDocument({
    language: "json",
    content: snippetJson
  });
  await vscode.window.showTextDocument(preview, { preview: true });

  const action = await vscode.window.showQuickPick(
    [
      { label: "Save To Workspace Snippets", description: SNIPPET_FORGE_FILE },
      { label: "Copy Snippet JSON", description: "Copy generated JSON to clipboard" },
      { label: "Open Workspace Snippets", description: "Review saved workspace snippets" }
    ],
    {
      title: "Snippet Forge",
      placeHolder: "Choose what to do with this snippet"
    }
  );

  if (!action) {
    return;
  }

  if (action.label === "Save To Workspace Snippets") {
    await saveWorkspaceSnippet(snippetEntry);
    return;
  }

  if (action.label === "Copy Snippet JSON") {
    await vscode.env.clipboard.writeText(snippetJson);
    vscode.window.showInformationMessage("Snippet Forge: snippet JSON copied.");
    return;
  }

  await openWorkspaceSnippets();
}

function registerSnippetForge(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("snippet-forge.createFromSelection", createSnippetFromSelection),
    vscode.commands.registerCommand("snippet-forge.openWorkspaceSnippets", openWorkspaceSnippets)
  );
}

module.exports = { registerSnippetForge };
