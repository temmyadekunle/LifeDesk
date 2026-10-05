import next from "eslint-config-next";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...next,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // .netlify/static is a deploy cache the Netlify CLI writes next to the
    // project: minified vendor chunks that are not ours to lint. Listed here as
    // well as in .gitignore, because ESLint does not read .gitignore.
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      ".netlify/**",
      "design/**",
    ],
  },
];

export default config;