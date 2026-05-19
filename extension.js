const { registerSnippetForge } = require("./src/snippetForge");

function activate(context) {
  registerSnippetForge(context);
}

function deactivate() {}

module.exports = { activate, deactivate };
