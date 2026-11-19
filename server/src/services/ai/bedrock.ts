import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import type { env } from "../../config/env.js";
import type { AiProvider } from "./provider.js";

export function createBedrockProvider(config: typeof env, label: string): AiProvider | null {
  const { awsRegion, awsAccessKeyId, awsSecretAccessKey, bedrockModelId: model } = config;
  if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey || !model) return null;
  return { id: "bedrock", label, model, async complete(system, prompt) {
    const client = new BedrockRuntimeClient({ region: awsRegion, credentials: { accessKeyId: awsAccessKeyId, secretAccessKey: awsSecretAccessKey } });
    try {
      const reply = await client.send(new ConverseCommand({ modelId: model, system: [{ text: system }], messages: [{ role: "user", content: [{ text: prompt }] }], inferenceConfig: { maxTokens: 4096, temperature: 0.2 } }), { abortSignal: AbortSignal.timeout(90_000) });
      return reply.output?.message?.content?.map(b => b.text ?? "").join("") ?? "";
    } finally { client.destroy(); }
  } };
}
