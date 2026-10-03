/** @file 実際のGitインデックスを使い、コミット前のステージ照合を検証する。 */
import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/check-staged.mjs", import.meta.url));
// 呼び出し元のコミット用インデックスを、テスト用リポジトリへ持ち込まない。
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
);

/** 一時リポジトリへファイルをステージし、検証後に一時ファイルを削除する。 */
async function withRepository(action: (cwd: string) => Promise<void>): Promise<void> {
  const cwd = await mkdtemp(join(tmpdir(), "tasknest-staged-"));
  try {
    await writeFile(join(cwd, "staged file.txt"), "before\n");
    await writeFile(join(cwd, ".gitignore"), "generated.txt\n");
    for (const args of [
      ["init", "--quiet"],
      ["add", "--", "."],
    ]) {
      const result = spawnSync("git", args, { cwd, env, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    }
    await action(cwd);
  } finally {
    // 削除対象が、このテストで作成した一時ディレクトリ内にあることを確認する。
    assert.ok(resolve(cwd).startsWith(resolve(tmpdir()) + sep));
    await rm(cwd, { recursive: true, force: true });
  }
}

/** ステージ照合を別プロセスで実行し、終了コードと通知内容を取得する。 */
function check(cwd: string) {
  return spawnSync(process.execPath, [script], { cwd, env, encoding: "utf8" });
}

test("ステージと一致したファイルと除外対象の生成物はコミットを妨げない", async () => {
  await withRepository(async (cwd) => {
    await writeFile(join(cwd, "generated.txt"), "generated\n");
    const result = check(cwd);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("ステージ後の編集や整形が残っている場合はコミットを止める", async () => {
  await withRepository(async (cwd) => {
    await writeFile(join(cwd, "staged file.txt"), "after\n");
    const result = check(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /staged file\.txt/);
  });
});

test("未追跡のファイルがある場合はコミットを止める", async () => {
  await withRepository(async (cwd) => {
    await writeFile(join(cwd, "new file.txt"), "new\n");
    const result = check(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /new file\.txt/);
  });
});

test("ファイルの削除をステージしていない場合はコミットを止める", async () => {
  await withRepository(async (cwd) => {
    await rm(join(cwd, "staged file.txt"));
    const result = check(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /staged file\.txt/);
  });
});
