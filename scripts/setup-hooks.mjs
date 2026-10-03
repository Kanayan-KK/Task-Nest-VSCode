/** @file 依存関係の導入時に、このリポジトリのGitフックを有効にする。 */
import "./check-node.mjs";
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));

// 配布アーカイブなど、Git管理外の環境では設定を省略する。
const repository = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
if (repository.status !== 0) process.exit(0);

// 親リポジトリの設定を変更しないよう、プロジェクトのルートを確認する。
if (resolve(repository.stdout.trim()).toLowerCase() !== resolve(cwd).toLowerCase()) process.exit(0);

// fnmの一時パスを避け、GUIからのコミットでも使えるNode.jsの実体を記録する。
const packageManagerPath = process.env.npm_execpath;
if (!packageManagerPath) {
  console.error("Run pnpm run prepare to configure the pnpm path.");
  process.exit(1);
}

// pnpmの導入場所がNode.jsと異なる環境でも、フックから実行できるようにする。
for (const [key, value] of [
  ["tasknest.nodePath", dirname(realpathSync(process.execPath))],
  ["tasknest.pnpmPath", dirname(realpathSync(packageManagerPath))],
  ["core.hooksPath", ".githooks"],
]) {
  const result = spawnSync("git", ["config", "--local", key, value], { cwd, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
