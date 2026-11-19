import { z } from "zod";
import { postJson } from "./http.js";
import type { AiProvider } from "./provider.js";

export type ProviderOptions = Pick<AiProvider, "id" | "label" | "model"> & { apiKey: string; baseUrl: string };
const completion = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string().min(1) }) })).min(1) });

export function createOpenAiCompatibleProvider({ id, label, baseUrl, apiKey, model }: ProviderOptions): AiProvider {
  return { id, label, model, async complete(system, prompt) {
    const data = await postJson(`${baseUrl}/chat/completions`, { Authorization: `Bearer ${apiKey}` }, {
      model, messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    });
    return completion.parse(data).choices[0].message.content;
  } };
}
