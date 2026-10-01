// File: backend/routes/apiDocs.js
// Interactive API reference at /api/docs (issue #93): Swagger UI over the same
// document served at /api/openapi.json. Lives under /api so the existing nginx
// proxy rule reaches it with no frontend change.
//
// It is same-origin with the API, so the browser sends the session cookie on
// "Try it out" requests and every call runs with the signed-in user's own role
// and project memberships — the page grants nothing the user doesn't have.
// Set API_DOCS_ENABLED=false to remove it entirely.
const express = require('express');
const path = require('path');
const router = express.Router();
const { version } = require('../package.json');
const { renderApiDocsPage, SWAGGER_UI_DIR, SWAGGER_UI_ASSETS } = require('../utils/apiDocsPage');

const page = renderApiDocsPage({
  version,
  specUrl: '/api/openapi.json',
  assetBase: '/api/docs/',
  interactive: true,
});

// requireAuth answers with JSON, which is the wrong thing to show someone who
// opened a bookmark in a fresh tab.
const SIGNED_OUT_PAGE = `<!doctype html>
<meta charset="utf-8">
<title>GHOST OSINT CRM API</title>
<body style="font: 16px/1.5 system-ui, sans-serif; margin: 3rem auto; max-width: 32rem; padding: 0 1rem;">
<h1 style="font-size: 1.25rem;">Sign in first</h1>
<p>The API reference is available to signed-in users. Sign in to GHOST in this browser, then reload this page.</p>
`;

router.get('/', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).type('html').send(SIGNED_OUT_PAGE);
  }
  res.type('html').send(page);
});

// Stock Swagger UI files, identical for everyone — no reason to gate them.
for (const asset of SWAGGER_UI_ASSETS) {
  router.get(`/${asset}`, (req, res) => {
    res.sendFile(path.join(SWAGGER_UI_DIR, asset), { maxAge: '1d' });
  });
}

module.exports = router;
