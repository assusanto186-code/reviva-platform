import assert from "node:assert/strict";
import test from "node:test";
import {
  PostgresConfigurationError,
  readIntegrationTestConfig,
} from "../dist/index.js";

const valid = {
  REVIVA_DB_ENVIRONMENT: "development",
  REVIVA_DB_ALLOW_DESTRUCTIVE_TESTS: "reviva-development-only",
  REVIVA_DB_TEST_PROJECT_REF: "reviva-development",
  REVIVA_DB_PRODUCTION_PROJECT_REF: "reviva-production",
  REVIVA_DB_ADMIN_URL: "postgresql://admin:fake@localhost:5432/reviva",
  REVIVA_DB_RUNTIME_URL: "postgresql://runtime:fake@localhost:6543/reviva",
};

test("integration configuration accepts only separated Development credentials", () => {
  assert.deepEqual(readIntegrationTestConfig(valid), {
    adminUrl: valid.REVIVA_DB_ADMIN_URL,
    runtimeUrl: valid.REVIVA_DB_RUNTIME_URL,
    projectRef: valid.REVIVA_DB_TEST_PROJECT_REF,
  });
});

test("integration configuration rejects a Production target", () => {
  assert.throws(
    () => readIntegrationTestConfig({
      ...valid,
      REVIVA_DB_TEST_PROJECT_REF: valid.REVIVA_DB_PRODUCTION_PROJECT_REF,
    }),
    PostgresConfigurationError,
  );
});

test("integration configuration rejects missing confirmation and shared credentials", () => {
  assert.throws(
    () => readIntegrationTestConfig({
      ...valid,
      REVIVA_DB_ALLOW_DESTRUCTIVE_TESTS: "",
    }),
    PostgresConfigurationError,
  );
  assert.throws(
    () => readIntegrationTestConfig({
      ...valid,
      REVIVA_DB_RUNTIME_URL: valid.REVIVA_DB_ADMIN_URL,
    }),
    PostgresConfigurationError,
  );
});
