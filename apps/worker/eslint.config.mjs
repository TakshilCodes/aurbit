import { config } from "@aurbit/eslint-config/base";

/** @type {import("eslint").Linter.Config} */
export default [...config, { ignores: [".wrangler/**"] }];
