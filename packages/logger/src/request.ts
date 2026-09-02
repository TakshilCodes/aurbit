const REQUEST_ID_HEADER = "x-request-id";
const CLOUDFLARE_RAY_HEADER = "cf-ray";
const CLOUDFLARE_RAY_PATTERN = /^[a-f0-9]{16}(?:-[a-z]{3})?$/i;

export function createRequestContext(incoming: Headers) {
  const requestId = crypto.randomUUID();
  const headers = new Headers(incoming);
  // Public callers cannot choose or inject our correlation identifier.
  headers.set(REQUEST_ID_HEADER, requestId);
  return { requestId, headers };
}

// Call only downstream of the HTTP proxy, which replaces this header.
export function requestIdFromHeaders(headers: Pick<Headers, "get">): string {
  const value = headers.get(REQUEST_ID_HEADER);
  return value &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      value,
    )
    ? value
    : crypto.randomUUID();
}

export function cloudflareRayIdFromHeaders(
  headers: Pick<Headers, "get">,
): string | undefined {
  const value = headers.get(CLOUDFLARE_RAY_HEADER);
  return value && CLOUDFLARE_RAY_PATTERN.test(value) ? value : undefined;
}
