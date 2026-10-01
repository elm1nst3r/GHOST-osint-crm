// Tests for the generated OpenAPI document (utils/openapiSpec.js)

const spec = require('./openapiSpec');

describe('openapiSpec', () => {
  test('is a valid OpenAPI 3.1 skeleton', () => {
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toMatch(/GHOST/);
    expect(spec.info.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(spec.servers).toEqual([{ url: '/api' }]);
  });

  test('is JSON-serializable (no functions or cycles)', () => {
    expect(() => JSON.stringify(spec)).not.toThrow();
  });

  test('contains all entity schemas from middleware/schemas.js', () => {
    const expected = [
      'PersonCreate', 'PersonUpdate', 'BusinessCreate', 'BusinessUpdate',
      'ToolCreate', 'ToolUpdate', 'CaseCreate', 'CaseUpdate',
      'TodoCreate', 'TodoUpdate', 'TravelHistoryCreate', 'TravelHistoryUpdate',
      'PropertyCreate', 'PropertyUpdate', 'AssetCreate', 'AssetUpdate',
      'TransactionCreate', 'TransactionUpdate',
      'CryptoWalletCreate', 'CryptoWalletUpdate',
      'ProjectMemberCreate', 'ProjectMemberUpdate',
      'SettingsBrandingUpdate', 'SettingsGeocodingUpdate',
      'SettingsUpdateCheck', 'SettingsProjectRetention',
      'SettingsCustomFieldCreate', 'SettingsCustomFieldUpdate',
      'SettingsModelOptionCreate', 'SettingsModelOptionUpdate',
    ];
    expected.forEach((name) => {
      expect(spec.components.schemas[name]).toBeDefined();
      expect(spec.components.schemas[name].type).toBe('object');
    });
  });

  test('Zod constraints survive conversion', () => {
    const person = spec.components.schemas.PersonCreate;
    expect(person.required).toContain('firstName');
    expect(person.properties.firstName.minLength).toBe(1);

    const business = spec.components.schemas.BusinessCreate;
    expect(business.properties.latitude).toBeDefined();

    const asset = spec.components.schemas.AssetCreate;
    expect(asset.properties.location_mode.enum ||
           (asset.properties.location_mode.anyOf || []).length).toBeTruthy();
  });

  test('every operation has responses and a tag', () => {
    const methods = ['get', 'post', 'put', 'delete'];
    Object.entries(spec.paths).forEach(([path, ops]) => {
      Object.entries(ops).forEach(([method, operation]) => {
        if (!methods.includes(method)) return;
        expect(operation.responses).toBeDefined();
        expect(operation.tags && operation.tags.length).toBeTruthy();
      });
    });
  });

  test('every tag an operation uses is declared with a description', () => {
    const declared = new Set(spec.tags.map((t) => t.name));
    spec.tags.forEach((t) => expect(t.description).toBeTruthy());
    Object.values(spec.paths).forEach((ops) => {
      Object.values(ops).forEach((operation) => {
        operation.tags.forEach((tag) => expect(declared.has(tag)).toBe(true));
      });
    });
  });

  // The MCP server and the published catalogue both key off these.
  test('instance administration is kept out of the MCP toolset', () => {
    ['/export', '/import', '/upload/logo', '/settings/geocoding', '/settings/branding'].forEach((p) => {
      Object.values(spec.paths[p]).forEach((operation) => {
        expect(operation['x-mcp-exclude']).toBe(true);
      });
    });
    expect(spec.paths['/crypto-wallets'].get['x-mcp-exclude']).toBeUndefined();
  });

  test('project-scoped lists document the project_id filter', () => {
    ['/people', '/businesses', '/assets', '/transactions', '/crypto-wallets', '/properties'].forEach((p) => {
      const names = spec.paths[p].get.parameters.map((param) => param.name);
      expect(names).toContain('project_id');
    });
  });

  test('core entity paths are present', () => {
    ['/people', '/people/{id}', '/businesses', '/transactions', '/assets',
     '/properties', '/{entityType}/{id}/ledger', '/auth/login',
     '/businesses/{id}/venue-stats'].forEach((p) => {
      expect(spec.paths[p]).toBeDefined();
    });
  });

  test('all $ref targets resolve to component schemas', () => {
    const refs = JSON.stringify(spec).match(/#\/components\/schemas\/[A-Za-z]+/g) || [];
    refs.forEach((r) => {
      const name = r.split('/').pop();
      expect(spec.components.schemas[name]).toBeDefined();
    });
  });

  test('login endpoint is public, everything else defaults to cookieAuth', () => {
    expect(spec.paths['/auth/login'].post.security).toEqual([]);
    expect(spec.security).toEqual([{ cookieAuth: [] }]);
  });
});
