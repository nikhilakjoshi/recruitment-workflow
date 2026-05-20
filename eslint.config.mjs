import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Selector matches:  prisma.application.update({ data: { state: ... } })
// — any CallExpression on prisma.application.{update,updateMany,upsert}
// whose first argument's `data` object literal contains a `state` property.
const NO_RAW_STATE_WRITE_SELECTOR =
  "CallExpression[callee.object.object.name='prisma']" +
  "[callee.object.property.name='application']" +
  "[callee.property.name=/^(update|updateMany|upsert)$/]" +
  " ObjectExpression > Property[key.name='data']" +
  " > ObjectExpression > Property[key.name='state']";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: NO_RAW_STATE_WRITE_SELECTOR,
          message:
            "Application.state must only be written via lib/state-machine/application.ts (transition()).",
        },
      ],
    },
  },
  {
    files: ["lib/state-machine/**/*.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "prisma/migrations/**",
  ]),
]);

export default eslintConfig;
