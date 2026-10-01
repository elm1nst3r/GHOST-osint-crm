// File: backend/utils/apiDocsPage.js
// The Swagger UI page over the OpenAPI document. One renderer, two homes:
//   - routes/apiDocs.js serves it at /api/docs inside a running instance,
//     where "Try it out" works against that instance's own data;
//   - scripts/build-api-docs.js writes it as the static catalogue published to
//     GitHub Pages, where there is no backend and requests are disabled.

const path = require('path');

const SWAGGER_UI_DIR = path.dirname(require.resolve('swagger-ui-dist/package.json'));
const SWAGGER_UI_ASSETS = { css: 'swagger-ui.css', js: 'swagger-ui-bundle.js' };

const REPO_URL = 'https://github.com/elm1nst3r/GHOST-osint-crm';

const NOTICE = {
  interactive:
    'Requests sent from this page run against this instance with your account and its ' +
    'permissions. Writes and deletes are real.',
  static:
    'Static reference for the latest release, so requests can\'t be sent from this page. ' +
    'Your own instance serves the same page for its version at <code>/api/docs</code> ' +
    'once you are signed in.',
};

// opts.specUrl / opts.cssUrl / opts.jsUrl: where the page finds openapi.json
// and the Swagger UI assets. opts.interactive: whether "Try it out" is offered.
function renderApiDocsPage({ version, specUrl, cssUrl, jsUrl, interactive }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GHOST OSINT CRM API v${version}</title>
  <meta name="description" content="Reference for the GHOST OSINT CRM REST API and the MCP tools generated from it.">
  <link rel="stylesheet" href="${cssUrl}">
  <style>
    :root { color-scheme: light; }
    body { margin: 0; background: #fff; }
    .catalogue-bar {
      font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1f2933;
      border-bottom: 1px solid #d9dee3;
      background: #f6f7f9;
    }
    .catalogue-bar > div {
      max-width: 1460px;
      margin: 0 auto;
      padding: 12px 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px 24px;
      align-items: baseline;
    }
    .catalogue-bar strong { font-size: 15px; }
    .catalogue-bar nav { display: flex; flex-wrap: wrap; gap: 4px 18px; margin-left: auto; }
    .catalogue-bar a { color: #0b5cad; text-decoration: none; }
    .catalogue-bar a:hover { text-decoration: underline; }
    .catalogue-bar p { flex: 0 0 100%; margin: 0; color: #52606d; }
    .catalogue-bar code { font-size: 13px; }
    /* The session cookie is the only credential and the browser sends it by
       itself, so there is nothing to enter in an Authorize dialog. */
    .swagger-ui .auth-wrapper { display: none; }
  </style>
</head>
<body>
  <header class="catalogue-bar">
    <div>
      <strong>GHOST OSINT CRM API</strong>
      <span>v${version}</span>
      <nav>
        <a href="${specUrl}">openapi.json</a>
        <a href="${REPO_URL}/tree/main/mcp">MCP server</a>
        <a href="${REPO_URL}">GitHub</a>
      </nav>
      <p>${interactive ? NOTICE.interactive : NOTICE.static}</p>
    </div>
  </header>

  <div id="swagger-ui"></div>

  <script src="${jsUrl}"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: ${JSON.stringify(specUrl)},
      dom_id: '#swagger-ui',
      deepLinking: true,
      filter: true,
      defaultModelsExpandDepth: 0,${interactive ? '' : `
      supportedSubmitMethods: [],`}
    });
  </script>
</body>
</html>
`;
}

module.exports = { renderApiDocsPage, SWAGGER_UI_DIR, SWAGGER_UI_ASSETS };
