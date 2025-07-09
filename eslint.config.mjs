import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends(
    "airbnb-base",
    "airbnb-typescript/base",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
    "next/core-web-vitals",
    "next/typescript"
  ),
  {
    rules: {
      // Airbnb + Prettier hybrid
      'prettier/prettier': 'error',
      'import/prefer-default-export': 'off',
      'no-console': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-underscore-dangle': 'off',
      'class-methods-use-this': 'off',
    },
  },
];

export default eslintConfig;
