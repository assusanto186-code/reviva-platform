import type {
  AIProvider,
  Planner,
  PlannerResult,
  ProviderDescriptor,
  ProviderRequest,
  ProviderResponse,
} from "../contracts.js";
import type { ModelIdentifier } from "../identifiers.js";
import { deepFreeze } from "../internal/immutable.js";

export type ScriptedProvider = Readonly<{
  provider: AIProvider;
  requests(): readonly ProviderRequest[];
}>;

export const createScriptedProvider = (
  descriptor: ProviderDescriptor,
  responses: readonly ProviderResponse[],
): ScriptedProvider => {
  if (responses.length === 0) {
    throw new Error("A scripted provider requires at least one response.");
  }
  const script = [...responses];
  const captured: ProviderRequest[] = [];
  const provider: AIProvider = Object.freeze({
    descriptor: deepFreeze({
      ...descriptor,
      modelIds: [...descriptor.modelIds],
      supportedPurposes: [...descriptor.supportedPurposes],
      capabilities: [...descriptor.capabilities],
    }),
    async infer(
      request: ProviderRequest,
      modelId: ModelIdentifier,
    ): Promise<ProviderResponse> {
      if (!descriptor.modelIds.includes(modelId)) {
        throw new Error("The scripted model is not declared by this provider.");
      }
      captured.push(request);
      const response = script.shift();
      if (response === undefined) {
        throw new Error("The deterministic provider script was exhausted.");
      }
      return deepFreeze(response);
    },
  });
  return Object.freeze({
    provider,
    requests: () => deepFreeze([...captured]),
  });
};

export const createReferencePlanner = (
  result: PlannerResult,
): Planner =>
  Object.freeze({
    async plan(): Promise<PlannerResult> {
      return deepFreeze({ ...result, reasonCodes: [...result.reasonCodes] });
    },
  });
