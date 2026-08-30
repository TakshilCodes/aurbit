import { WorkerEntrypoint } from "cloudflare:workers";
import { parseAurbitEvent } from "@aurbit/async-events";
import type { WorkerBindings } from "./environment";

// Next dev and Wrangler have separate Queue simulators. This local-only RPC
// binding enqueues into the consumer's simulator; it never calls a handler directly.
export class LocalQueueProducer extends WorkerEntrypoint<WorkerBindings> {
  async send(input: unknown): Promise<void> {
    const event = parseAurbitEvent(input);
    const queue = this.env.LOCAL_AURBIT_EVENTS;
    if (!queue) {
      throw new Error("The local Queue producer is not configured.");
    }
    await queue.send(event);
  }
}
