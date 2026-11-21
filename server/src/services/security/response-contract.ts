import { z } from 'zod';

export const expectationSchema = z.object({
  status: z.number().int().min(100).max(599),
  mediaType: z.enum(['application/json','text/html','text/plain']).optional(),
}).strict();

export function observeResponse(header: string) {
  const [statusLine, ...fields] = header.split(/\r?\n/);
  const match = /^HTTP\/\S+\s+([1-5]\d\d)(?:\s|$)/.exec(statusLine);
  if (!match) return null;
  const contentType = fields.find(line => /^content-type:/i.test(line));
  const mediaType = contentType?.slice(contentType.indexOf(':') + 1).split(';')[0].trim().toLowerCase();
  return {status: Number(match[1]), mediaType: mediaType?.slice(0, 120) || null};
}

export function checkContract(expected: {status:number;mediaType?:string}, observed: NonNullable<ReturnType<typeof observeResponse>>) {
  return {expected, observed, matches: expected.status === observed.status && (!expected.mediaType || expected.mediaType === observed.mediaType)};
}
