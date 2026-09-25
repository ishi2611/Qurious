import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

/** Map each check/diagnostic question's text to its correct option, straight from the YAML. */
export function answerKey(): Map<string, string> {
  const dir = path.resolve(__dirname, "../../content/concepts");
  const key = new Map<string, string>();
  for (const f of readdirSync(dir)) {
    const c = parse(readFileSync(path.join(dir, f), "utf8"));
    for (const q of [...(c.checks ?? []), ...(c.diagnostic ?? [])]) {
      key.set(q.question, q.options[q.answer]);
    }
  }
  return key;
}
