import tseslint from "typescript-eslint";

export default [
  { ignores: ["**/.next/**", "**/dist/**", "**/node_modules/**"] },
  ...tseslint.configs.recommended,
];
