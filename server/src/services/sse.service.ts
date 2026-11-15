import type { Response } from "express";

const HEARTBEAT_MS = 15_000;

class SseHub {
  private clients = new Set<Response>();

  subscribe(response: Response): void {
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders?.();
    response.write(": connected\n\n");

    this.clients.add(response);
    const heartbeat = setInterval(() => {
      response.write(": heartbeat\n\n");
    }, HEARTBEAT_MS);

    response.on("close", () => {
      clearInterval(heartbeat);
      this.clients.delete(response);
    });
  }

  broadcast<T>(event: string, data: T): void {
    if (this.clients.size === 0) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients) {
      client.write(payload);
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}

export const sseHub = new SseHub();
