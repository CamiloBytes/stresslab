import { z } from "zod";
import { postJson } from "./http.js";
import type { ProviderOptions } from "./openai-compatible.js";
import type { AiProvider } from "./provider.js";

const message = z.object({ content: z.array(z.object({ type: z.string(), text: z.string().optional() })) });
export function createAnthropicProvider({ id, label, baseUrl, apiKey, model }: ProviderOptions): AiProvider {
  return { id, label, model, async complete(system, prompt) {
    const data = await postJson(`${baseUrl}/messages`, { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, {
      model, max_tokens: 4096, system, messages: [{ role: "user", content: prompt }],
    });
    return message.parse(data).content.filter(b => b.type === "text").map(b => b.text).join("");
  } };
}
