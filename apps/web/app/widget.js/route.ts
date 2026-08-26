import { createWidgetScript } from "../../lib/widget-script";

export function GET(request: Request) {
  const origin = new URL(request.url).origin;

  return new Response(createWidgetScript(origin), {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Type": "text/javascript; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
