import { defineConfig } from 'vitest/config';

/**
 * Suíte de isolamento entre tenants (issue #35). Fica fora do `npm test`
 * porque fala com o projeto Supabase real: precisa de SUPABASE_URL,
 * SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY (service role) no ambiente.
 * Rodar com `npm run test:isolation`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/isolation/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Os testes compartilham usuários/tenants criados no beforeAll: sequencial.
    fileParallelism: false,
  },
});
