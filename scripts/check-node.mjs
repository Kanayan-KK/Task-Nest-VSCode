/** @file 開発コマンドが指定したNode.jsバージョンで実行されていることを確認する。 */
import { readFileSync } from "node:fs";

const expected = readFileSync(new URL("../.node-version", import.meta.url), "utf8").trim();
const { engines } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

// バージョン指定の不一致と、異なるNode.jsでの検証を防ぐ。
if (engines.node !== expected || process.versions.node !== expected) {
  console.error(
    `Node.js ${expected} is required (current: ${process.versions.node}). Run fnm install and fnm use, then pnpm run prepare.`,
  );
  process.exit(1);
}
