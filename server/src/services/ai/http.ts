export async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const result = await fetch(url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(90_000),
    headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  if (!result.ok) throw new Error(`El proveedor respondió HTTP ${result.status}${result.status === 429 ? " (límite de solicitudes o cuota)" : ""}`);
  return result.json();
}
