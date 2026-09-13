// Shim de re-export: o motor de replanejamento vive de fato em
// supabase/functions/_shared/replanEngine.ts (compartilhado com o bot). É
// puro — zero import de Deno — então funciona igual do lado do Vite. Manter
// um único módulo evita três implementações divergentes de "mover dia" entre
// bot, RPC e app.
export * from '../../supabase/functions/_shared/replanEngine.ts';
