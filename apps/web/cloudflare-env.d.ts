interface CloudflareEnv {
  AURBIT_EVENTS_LOCAL?: import("@aurbit/async-events").AurbitEventQueue;
  AURBIT_EVENTS: Queue<unknown>;
  BUG_REPORT_ATTACHMENTS: R2Bucket;
}
