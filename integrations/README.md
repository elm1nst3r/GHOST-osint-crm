# GHOST integrations

Integrations turn an OSINT tool in GHOST into something you can **search with
directly**: GHOST calls the service, shows the results, and lets you add what
you find to a person, marked with where and when it came from.

An integration is a single **JSON file**, not code. It names one HTTPS host,
how the API key is sent, what each search accepts (an email, a domain, an IP…),
the request path, and where the useful values are in the response. Installing
one cannot run code on your server.

- **Built-in integrations** ship with GHOST in
  [`backend/integrations/`](../backend/integrations): crt.sh, Wayback Machine,
  Gravatar, Have I Been Pwned, Hunter.io, IPinfo, Shodan, VirusTotal and
  urlscan.io.
- **Community integrations** live in [`community/`](community). An admin
  installs one under **Settings → Tools & Integrations → Install from file**,
  then adds a tool that uses it under **Tools**.

## The easy way: the integration builder

You don't have to write JSON by hand. In GHOST, an admin opens
**Tools → Add Tool → Integrated → "Build a new integration"** (or
**Settings → Tools & Integrations → Build an integration**) and answers a few
questions:

1. **About the service:** name, website, terms of use.
2. **Connecting:** whether it needs a key, and how the documentation says
   to send it.
3. **Searches:** paste an example request from the service's API docs and
   type the sample value used in it; GHOST works out the request. Run a test
   with a real value, then **click the values in the response** that
   investigators should see, and mark which can be added to a person.
4. **Review:** install it, or download the file to contribute it here.

Built-in integrations can be opened in the builder as a starting point, and
community ones can be edited there.

## What belongs here

Integrations for **lawful, legitimate** sources only: services that publish
an API and allow the use the integration makes of it.

Not accepted:

- services that sell or search **leaked or breached databases**, or personal
  data obtained without a lawful basis ("probiv" bots and the like);
- anything built to get around a service's terms, rate limits or access
  controls;
- integrations whose only purpose is tracking or harassing individuals.

Have I Been Pwned is fine: it tells you *that* an address appeared in a breach,
from a service that operates openly. A service that returns the breached
records themselves is not.

Each pull request is reviewed against this. When unsure, open an issue first.

## How an integration is checked

GHOST validates every file when it's installed and again when it's used:

- `baseUrl` must be `https://`; requests can't leave that host.
- Requests to private, loopback and link-local addresses are refused (an
  operator can allow their own LAN with `INTEGRATIONS_ALLOW_PRIVATE=true`).
- Redirects aren't followed, responses are size- and time-limited.
- The only template variable is `{{input}}`, validated for its kind and URL
  encoded. API keys are stored encrypted and never shown in results, errors
  or logs.

## Format

See [`community/_TEMPLATE.json`](community/_TEMPLATE.json) and the built-ins
for complete examples.

```jsonc
{
  "schema": "ghost-integration/v1",
  "id": "example",                       // lowercase, digits, dashes; unique
  "name": "Example Service",
  "version": "1.0.0",
  "description": "What it finds.",
  "category": "Email",
  "homepage": "https://example.com",
  "terms": "https://example.com/terms",  // the provider's terms of use
  "baseUrl": "https://api.example.com/v1",
  "auth": {                              // or { "type": "none" }
    "type": "header",                    // header | query | bearer
    "name": "X-Api-Key",                 // header or query parameter name
    "optional": false,                   // true: works without a key
    "label": "Example API key",
    "signupUrl": "https://example.com/keys"
  },
  "headers": { "User-Agent": "GHOST-OSINT-CRM" },   // optional, static
  "minIntervalMs": 1000,                 // pause between requests
  "timeoutMs": 15000,
  "test": { "path": "/account" },        // optional connection test
  "operations": [
    {
      "id": "lookup",
      "label": "Look up an email",
      "input": "email",                  // email | domain | ip | username | phone | url
      "cost": "quota",                   // free | quota | paid (shown before running)
      "path": "/lookup/{{input}}",       // filters: {{input|lower|sha256}} etc.
      "query": { "full": "true" },       // optional query parameters
      "notFound": [404],                 // statuses meaning "no results"
      "results": {
        "root": "data.items",            // where the list (or object) is
        "title": "name",
        "link": "url",                   // shown as a link if it's http(s)
        "distinctBy": "id",
        "fields": [
          { "label": "Name", "path": "name" },
          { "label": "Profiles", "path": "profiles[].url", "osintType": "Social Media" },
          { "label": "Hosts", "path": "hosts", "split": "\n", "osintType": "Website" },
          { "label": "About", "path": "bio", "stripHtml": true }
        ]
      }
    }
  ]
}
```

- **Paths** are dotted: `a.b`, `list[0].name`, and `list[].name` to take a
  field from every item of a list.
- **`osintType`** marks a value the investigator can add to a person; it
  should match one of your OSINT data types (Email, Phone, Website, Social
  Media, Username, IP Address…).
- **Filters** for `{{input}}`: `lower`, `upper`, `trim`, `md5`, `sha1`,
  `sha256`, `digits`.

## Contributing

1. Build it with the integration builder and download the file, or copy
   `community/_TEMPLATE.json` to `community/<id>.json` and edit it.
2. Install it on your own GHOST and run each operation against real data.
3. Open a pull request saying which service it is, a link to its API
   documentation and terms, and what you tested.
