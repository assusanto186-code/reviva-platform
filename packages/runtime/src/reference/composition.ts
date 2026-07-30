import {
  createRuntimeComposition,
  createRuntimeToolRegistry,
  type RuntimeComposition,
} from "../index.js";
import { createReleaseRuntimeRegistrations } from "./handlers.js";
import { createInMemoryRuntimePersistence } from "./in-memory.js";

export const createReferenceRuntimeComposition = (): RuntimeComposition => {
  const persistence = createInMemoryRuntimePersistence();
  const registry = createRuntimeToolRegistry(
    createReleaseRuntimeRegistrations(),
  );
  return createRuntimeComposition({ registry, persistence });
};
