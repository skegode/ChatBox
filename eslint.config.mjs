import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "off",
      "react/no-unescaped-entities": "off",
      // Temporarily relax explicit any rule to allow incremental typing fixes during deployment
      "@typescript-eslint/no-explicit-any": "off",
      // Allow img elements to avoid refactors for now; prefer using next/image later
      "@next/next/no-img-element": "warn",
    },
  },
];

export default eslintConfig;
