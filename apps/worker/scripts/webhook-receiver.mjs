import { createServer } from "node:http";
import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import process from "node:process";
import console from "node:console";

// Explicitly run fixture: no production route and no binding to the LAN.
const secret = process.env.WEBHOOK_TEST_SECRET;
if (!secret)
  throw new Error(
    "Set WEBHOOK_TEST_SECRET to the endpoint's one-time signing secret.",
  );
const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/aurbit") {
    response.writeHead(404).end();
    return;
  }
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 16384) {
        response.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    const timestamp = request.headers["aurbit-timestamp"];
    const signature = request.headers["aurbit-signature"];
    if (
      typeof timestamp !== "string" ||
      !/^\d+$/.test(timestamp) ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
      typeof signature !== "string" ||
      !/^v1=[a-f0-9]{64}$/.test(signature)
    ) {
      response.writeHead(401).end();
      return;
    }
    const expected = createHmac("sha256", secret)
      .update(`${timestamp}.`)
      .update(body)
      .digest();
    const received = Buffer.from(signature.slice(3), "hex");
    if (!timingSafeEqual(expected, received)) {
      response.writeHead(401).end();
      return;
    }
    const event = JSON.parse(body.toString("utf8"));
    if (
      event.id !== request.headers["aurbit-event-id"] ||
      event.type !== request.headers["aurbit-event-type"]
    ) {
      response.writeHead(400).end();
      return;
    }
    console.log(
      JSON.stringify({
        message: "webhook_verified",
        eventId: event.id,
        eventType: event.type,
      }),
    );
    response.writeHead(204).end();
  } catch {
    if (!response.headersSent) response.writeHead(400).end();
  }
});
server.requestTimeout = 10000;
server.listen(8789, "127.0.0.1", () =>
  console.log("Webhook receiver listening on http://127.0.0.1:8789/aurbit"),
);
