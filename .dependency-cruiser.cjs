/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-cannot-import-framework-or-prisma',
      comment:
        'AGENTS.md: Domain katmanı hiçbir framework veya ORM (@nestjs, @prisma vb.) import edemez; saf TypeScript olmalıdır.',
      severity: 'error',
      from: {
        path: '(^apps/api/src/modules/[^/]+/domain)',
      },
      to: {
        path: '(@nestjs|@prisma|prisma|express)',
      },
    },
    {
      name: 'no-inter-module-internal-imports',
      comment:
        'AGENTS.md: Modül dışından iç dosyalara (domain, application, infrastructure, presentation) doğrudan import yasaktır. Yalnızca index.js (public API) kullanılabilir.',
      severity: 'error',
      from: {
        path: '^apps/api/src/',
        pathNot: '^apps/api/src/modules/([^/]+)/',
      },
      to: {
        path: '^apps/api/src/modules/([^/]+)/(?!index\\.(ts|js)$).*',
      },
    },
    {
      name: 'no-cross-module-internal-imports',
      comment:
        'AGENTS.md: Bir iş modülü başka bir modülün iç dosyalarını import edemez; yalnızca o modülün public API (index.js) dosyasını kullanabilir.',
      severity: 'error',
      from: {
        path: '^apps/api/src/modules/([^/]+)/',
      },
      to: {
        path: '^apps/api/src/modules/([^/]+)/',
        pathNot: [
          '^apps/api/src/modules/$1/',
          '^apps/api/src/modules/[^/]+/index\\.(ts|js)$',
        ],
      },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
  },
};
