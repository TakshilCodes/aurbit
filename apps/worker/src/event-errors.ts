export class PermanentEventProcessingError extends Error {
  constructor(public readonly code: string) {
    super("The event cannot be processed and should not be retried.");
    this.name = "PermanentEventProcessingError";
  }
}

export class RetryableEventProcessingError extends Error {
  constructor(public readonly code: string) {
    super("The event could not be processed yet and should be retried.");
    this.name = "RetryableEventProcessingError";
  }
}
