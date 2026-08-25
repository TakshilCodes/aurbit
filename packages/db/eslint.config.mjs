import { config } from "@aurbit/eslint-config/base";

export default [
  {
    ignores: ["src/generated/**"],
  },
  ...config,
];
