import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lesson content lives in ../content (shared with the API). Most pages are statically
  // generated at build time, but /explore reads it at request time, so the YAML files must be
  // traced into its server bundle. Tracing starts at the monorepo root to reach them.
  outputFileTracingRoot: path.join(__dirname, ".."),
  outputFileTracingIncludes: {
    "/explore": ["../content/**/*.yaml"],
  },
};

export default nextConfig;
