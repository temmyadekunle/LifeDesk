// Registered via --import so it runs before the test runner parses any
// .tsx file. See tsx-loader.mjs for what it actually does.
import { register } from "node:module";

register("./tsx-loader.mjs", import.meta.url);