import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [".next/**", ".next-build/**", "node_modules/**", "public/**", "playwright-report/**"],
  },
  ...nextVitals,
];

export default config;
