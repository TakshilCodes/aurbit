import {
  type AurbitEventInput,
  type AurbitEventQueue,
  enqueueAurbitEvent,
  selectEventQueue,
} from "@aurbit/async-events";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export function enqueueEvent(input: AurbitEventInput) {
  const { env } = getCloudflareContext() as unknown as {
    env: {
      AURBIT_EVENTS?: AurbitEventQueue;
      AURBIT_EVENTS_LOCAL?: AurbitEventQueue;
    };
  };
  return enqueueAurbitEvent(
    selectEventQueue(env, process.env.NODE_ENV === "development"),
    input,
  );
}
