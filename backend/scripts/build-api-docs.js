#!/usr/bin/env node
// Builds the static API catalogue published to GitHub Pages
// (.github/workflows/publish-api-docs.yml).
//
// The catalogue is the same OpenAPI document a running instance serves at
// GET /api/openapi.json, rendered with Swagger UI. Nothing is hand-maintained:
// the spec comes from utils/openapiSpec.js and the MCP tool names from
// mcp/tools.js, so the published page can't drift from either.
// The page itself is the one a running instance serves at /api/docs
// (utils/apiDocsPage.js), rendered with requests switched off.
//
// Usage: node scripts/build-api-docs.js [outDir]     (default: ../_site)

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const { renderApiDocsPage, SWAGGER_UI_DIR, SWAGGER_UI_ASSETS } = require('../utils/apiDocsPage');

const REPO_ROOT = path.join(__dirname, '..', '..');

async function main() {
  const outDir = path.resolve(process.argv[2] || path.join(REPO_ROOT, '_site'));

  // Clone: the annotations below are for the published page only and must not
  // leak into the module other code requires.
  const spec = JSON.parse(JSON.stringify(require('../utils/openapiSpec')));
  const { toolName, isToolOperation } = await import(
    pathToFileURL(path.join(REPO_ROOT, 'mcp', 'tools.js')).href
  );

  spec.servers = [{ url: '/api', description: 'Relative to your own GHOST instance' }];

  let operations = 0;
  let tools = 0;
  for (const [routePath, ops] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(ops)) {
      operations++;
      const notes = [];
      if (operation['x-requires-admin']) notes.push('**Admin only.**');
      if (isToolOperation(routePath, method, operation)) {
        tools++;
        notes.push(`MCP tool: \`${toolName(method, routePath)}\``);
      }
      if (notes.length) {
        operation.description = [operation.description, notes.join(' ')].filter(Boolean).join('\n\n');
      }
    }
  }

  fs.mkdirSync(outDir, { recursive: true });
  for (const asset of SWAGGER_UI_ASSETS) {
    fs.copyFileSync(path.join(SWAGGER_UI_DIR, asset), path.join(outDir, asset));
  }
  fs.writeFileSync(path.join(outDir, 'openapi.json'), JSON.stringify(spec, null, 2));
  fs.writeFileSync(
    path.join(outDir, 'index.html'),
    renderApiDocsPage({
      version: spec.info.version,
      specUrl: 'openapi.json',
      assetBase: '',
      interactive: false,
    })
  );

  console.log(
    `API catalogue v${spec.info.version}: ${operations} operations, ${tools} MCP tools → ${outDir}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
