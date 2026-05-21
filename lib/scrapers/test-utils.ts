import { readFileSync } from "node:fs";
import { join } from "node:path";

export function loadFixture(name: string): string {
  const path = join(__dirname, "fixtures", name);
  return readFileSync(path, "utf-8");
}
