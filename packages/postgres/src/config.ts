import postgres, { type Sql } from "postgres";
import { PostgresConfigurationError } from "./errors.js";

type Environment = Readonly<Record<string, string | undefined>>;
export type IntegrationTestConfig = { adminUrl: string; runtimeUrl: string; projectRef: string };

function required(env: Environment, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new PostgresConfigurationError(`${name} is required.`);
  return value;
}
function parseUrl(value: string, name: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new PostgresConfigurationError(`${name} must be a valid PostgreSQL URL.`); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new PostgresConfigurationError(`${name} must use PostgreSQL.`);
  return url;
}
export function readIntegrationTestConfig(env: Environment = process.env): IntegrationTestConfig {
  if (required(env, "REVIVA_DB_ENVIRONMENT") !== "development")
    throw new PostgresConfigurationError("Tests require REVIVA_DB_ENVIRONMENT=development.");
  if (required(env, "REVIVA_DB_ALLOW_DESTRUCTIVE_TESTS") !== "reviva-development-only")
    throw new PostgresConfigurationError("Tests require the explicit Development confirmation.");
  const projectRef = required(env, "REVIVA_DB_TEST_PROJECT_REF");
  const productionRef = env.REVIVA_DB_PRODUCTION_PROJECT_REF?.trim();
  if (productionRef && productionRef === projectRef)
    throw new PostgresConfigurationError("The test project must not be Production.");
  const adminUrl = required(env, "REVIVA_DB_ADMIN_URL");
  const runtimeUrl = required(env, "REVIVA_DB_RUNTIME_URL");
  parseUrl(adminUrl, "REVIVA_DB_ADMIN_URL"); parseUrl(runtimeUrl, "REVIVA_DB_RUNTIME_URL");
  if (adminUrl === runtimeUrl) throw new PostgresConfigurationError("Admin and runtime credentials must differ.");
  return { adminUrl, runtimeUrl, projectRef };
}
export function createPostgresClient(connectionUrl: string, options: { max?: number } = {}): Sql {
  const url = parseUrl(connectionUrl, "database URL");
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  return postgres(connectionUrl, { prepare: false, max: options.max ?? 4,
    connect_timeout: 10, idle_timeout: 20, max_lifetime: 600,
    ssl: local ? false : "require" });
}
