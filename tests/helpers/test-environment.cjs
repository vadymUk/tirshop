/** @param {Record<string, string | undefined>} env */
function localSupabaseConfiguration(env) {
  const url = env.TEST_SUPABASE_URL;
  const publishableKey = env.TEST_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = env.TEST_SUPABASE_SECRET_KEY;
  if (!url || !publishableKey || !secretKey) {
    throw new Error("Set TEST_SUPABASE_URL, TEST_SUPABASE_PUBLISHABLE_KEY and TEST_SUPABASE_SECRET_KEY for the disposable local Supabase instance.");
  }
  if (url !== "http://127.0.0.1:54321" && url !== "http://127.0.0.1:54321/") {
    throw new Error("Destructive tests require a disposable local Supabase at http://127.0.0.1:54321; remote projects are forbidden.");
  }
  return { url: "http://127.0.0.1:54321", publishableKey, secretKey };
}

/** @param {Record<string, string | undefined>} env */
function databaseTestsEnabled(env) {
  if (env.ALLOW_DB_TESTS !== "true") return false;
  localSupabaseConfiguration(env);
  return true;
}

/** @param {Record<string, string | undefined>} env */
function e2eConfiguration(env) {
  if (env.E2E_ISOLATED !== "true") {
    throw new Error("Set E2E_ISOLATED=true to run E2E tests against disposable local services.");
  }
  if (env.E2E_BASE_URL) {
    throw new Error("E2E_BASE_URL is not allowed: Playwright must start its own isolated server.");
  }
  const supabase = localSupabaseConfiguration(env);
  const port = Number(env.E2E_PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("E2E_PORT must be an integer between 1024 and 65535.");
  }
  return { supabase, port, baseURL: `http://localhost:${port}` };
}

module.exports = { localSupabaseConfiguration, databaseTestsEnabled, e2eConfiguration };
