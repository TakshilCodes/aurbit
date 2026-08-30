interface CloudflareEnv {
  AURBIT_EVENTS: import("@aurbit/async-events").AurbitEventQueue;
  AURBIT_EVENTS_LOCAL?: import("@aurbit/async-events").AurbitEventQueue;
  BUG_REPORT_ATTACHMENTS: R2Bucket;
}
