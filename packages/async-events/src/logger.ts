export type LogFields = Record<
  string,
  boolean | number | string | null | undefined
>;

export function structuredLog(
  level: "error" | "info" | "warn",
  message: string,
  fields: LogFields = {},
) {
  console[level](JSON.stringify({ level, message, ...fields }));
}
