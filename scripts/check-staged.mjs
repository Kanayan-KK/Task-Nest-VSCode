/** @file 作業ツリーとステージを照合し、検証していない内容のコミットを防ぐ。 */
import { spawnSync } from "node:child_process";

const changes = new Set();
// 差分はNUL区切りで読み、空白や改行を含むファイル名も正しく扱う。
for (const args of [
  ["diff", "--name-only", "-z", "--"],
  ["ls-files", "--others", "--exclude-standard", "-z"],
]) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(result.stderr || "Could not compare the working tree with the Git index.");
    process.exit(result.status ?? 1);
  }
  for (const path of result.stdout.split("\0").filter(Boolean)) changes.add(path);
}

// ステージ操作は開発者に委ね、フックは変更を自動で追加しない。
if (changes.size) {
  console.error(
    "Commit stopped: unstaged or untracked files exist. Run pnpm run all, then stage the changes.",
  );
  for (const path of changes) console.error(`  ${JSON.stringify(path)}`);
  process.exit(1);
}
