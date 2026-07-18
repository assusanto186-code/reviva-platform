import "server-only";

import {
  PostgresAuthIdentityRepository,
  PostgresTransactionCoordinator,
  createPostgresClient,
} from "@reviva/postgres";
import { readRuntimeDatabaseUrl } from "./config";

let services:
  | Readonly<{
      identities: PostgresAuthIdentityRepository;
      transactions: PostgresTransactionCoordinator;
    }>
  | undefined;

export function getAuthDatabaseServices() {
  if (!services) {
    const client = createPostgresClient(readRuntimeDatabaseUrl(), { max: 4 });
    services = {
      identities: new PostgresAuthIdentityRepository(client),
      transactions: new PostgresTransactionCoordinator(client),
    };
  }
  return services;
}
