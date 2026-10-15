// Refuses to let seed/import scripts touch a production database by accident.
// They write curriculum, course and CLO/PLO data directly, so running one
// against live data must be a deliberate, explicit act.
//
// Opt-in is the exact lowercase value `yes` in ALLOW_PROD_SEED — "true", "1"
// or "YES" are not accepted, so a stray truthy value cannot unlock it.
export function assertSeedAllowed(scriptName: string, env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;
  if (env.ALLOW_PROD_SEED === 'yes') return;
  throw new Error(
    `Refusing to run ${scriptName}: NODE_ENV=production. ` +
      'Set ALLOW_PROD_SEED=yes only if you really intend to write to the production database.',
  );
}
