import { env } from "../../config/env.js";
import { createAnthropicProvider } from "./anthropic.js";
import { createBedrockProvider } from "./bedrock.js";
import { createOpenAiCompatibleProvider } from "./openai-compatible.js";

export type AiProviderId = "bedrock" | "openai" | "anthropic" | "openrouter";

export interface AiProvider {
  readonly id: AiProviderId;
  readonly label: string;
  readonly model: string;
  complete(system: string, prompt: string): Promise<string>;
}

export interface AiStatus {
  configured: boolean;
  provider: AiProviderId | null;
  label: string | null;
  model: string | null;
  hint: string | null;
}

const PROVIDER_IDS: AiProviderId[] = ["openrouter", "openai", "anthropic", "bedrock"];

const LABELS: Record<AiProviderId, string> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
  anthropic: "Anthropic",
  bedrock: "Amazon Bedrock",
};

const CONFIG_HINT =
  "Configura AI_PROVIDER (openrouter | openai | anthropic | bedrock) y la API key del proveedor en .env. " +
  "Ejemplo gratis: AI_PROVIDER=openrouter + OPENROUTER_API_KEY=... (usa modelos :free).";

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("La respuesta no contiene JSON");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function build(id: AiProviderId): AiProvider | null {
  switch (id) {
    case "openrouter":
      return env.openrouterApiKey
        ? createOpenAiCompatibleProvider({
            id,
            label: LABELS[id],
            baseUrl: env.openrouterBaseUrl,
            apiKey: env.openrouterApiKey,
            model: env.openrouterModel,
          })
        : null;
    case "openai":
      return env.openaiApiKey
        ? createOpenAiCompatibleProvider({
            id,
            label: LABELS[id],
            baseUrl: env.openaiBaseUrl,
            apiKey: env.openaiApiKey,
            model: env.openaiModel,
          })
        : null;
    case "anthropic":
      return env.anthropicApiKey
        ? createAnthropicProvider({
            id,
            label: LABELS[id],
            baseUrl: env.anthropicBaseUrl,
            apiKey: env.anthropicApiKey,
            model: env.anthropicModel,
          })
        : null;
    case "bedrock":
      return createBedrockProvider(env, LABELS[id]);
  }
}

function resolveId(): AiProviderId | null {
  const requested = env.aiProvider.trim().toLowerCase();
  if (requested) {
    if ((PROVIDER_IDS as string[]).includes(requested)) return requested as AiProviderId;
    return null;
  }
  for (const id of PROVIDER_IDS) {
    if (build(id)) return id;
  }
  return null;
}

export function resolveProvider(): AiProvider | null {
  const requested = env.aiProvider.trim().toLowerCase();
  if (requested && !(PROVIDER_IDS as string[]).includes(requested)) return null;
  const id = resolveId();
  if (!id) return null;
  return build(id);
}

export function getAiStatus(): AiStatus {
  const requested = env.aiProvider.trim().toLowerCase();
  if (requested && !(PROVIDER_IDS as string[]).includes(requested)) {
    return {
      configured: false,
      provider: null,
      label: null,
      model: null,
      hint: `AI_PROVIDER="${requested}" no es válido. Usa: ${PROVIDER_IDS.join(" | ")}.`,
    };
  }

  const provider = resolveProvider();
  if (!provider) {
    const explicit = requested as AiProviderId | "";
    if (explicit) {
      const missing: Record<AiProviderId, string> = {
        openrouter: "OPENROUTER_API_KEY",
        openai: "OPENAI_API_KEY",
        anthropic: "ANTHROPIC_API_KEY",
        bedrock: "BEDROCK_MODEL_ID, AWS_REGION, AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY",
      };
      return {
        configured: false,
        provider: explicit,
        label: LABELS[explicit],
        model: null,
        hint: `AI_PROVIDER=${explicit} pero falta ${missing[explicit]} en .env.`,
      };
    }
    return { configured: false, provider: null, label: null, model: null, hint: CONFIG_HINT };
  }

  return {
    configured: true,
    provider: provider.id,
    label: provider.label,
    model: provider.model,
    hint: null,
  };
}

export function providerNotFoundMessage(): string {
  return getAiStatus().hint ?? CONFIG_HINT;
}
