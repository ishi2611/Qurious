/**
 * Checks that every math block in content/concepts renders with KaTeX (the same library the
 * lesson player uses). Part of the content validator; see scripts/validate-content.sh.
 *
 * Usage: npm run content:math
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import katex from "katex";
import { parse } from "yaml";

const conceptsDir = path.resolve(__dirname, "../../content/concepts");
let blocks = 0;
const failures: string[] = [];

for (const file of readdirSync(conceptsDir).filter((f) =>
  f.endsWith(".yaml"),
)) {
  const concept = parse(readFileSync(path.join(conceptsDir, file), "utf8"));
  for (const [i, block] of (concept.math ?? []).entries()) {
    blocks++;
    try {
      // strict: "error" also rejects LaTeX that KaTeX would only warn about.
      katex.renderToString(block.latex, {
        throwOnError: true,
        strict: "error",
      });
    } catch (e) {
      failures.push(`${file} math[${i}]: ${(e as Error).message}`);
    }
  }
}

if (failures.length) {
  console.error(
    `✗ ${failures.length} of ${blocks} math blocks failed to render:`,
  );
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`✓ All ${blocks} math blocks render with KaTeX`);
