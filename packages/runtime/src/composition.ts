import type {
  HumanHandoffService,
  RuntimeComposition,
  RuntimePersistence,
  RuntimeToolRegistry,
  ToolRuntime,
} from "./contracts.js";
import { createHumanHandoffService } from "./handoff-service.js";
import { createToolRuntime } from "./runtime.js";

export type CreateRuntimeCompositionInput = Readonly<{
  registry: RuntimeToolRegistry;
  persistence: RuntimePersistence;
  toolRuntime?: ToolRuntime;
  handoffs?: HumanHandoffService;
}>;

export const createRuntimeComposition = (
  input: CreateRuntimeCompositionInput,
): RuntimeComposition =>
  Object.freeze({
    registry: input.registry,
    toolRuntime:
      input.toolRuntime ??
      createToolRuntime({
        registry: input.registry,
        persistence: input.persistence,
      }),
    handoffs:
      input.handoffs ?? createHumanHandoffService(input.persistence),
  });
