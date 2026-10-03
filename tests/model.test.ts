/** @file VS Codeを起動せず、階層・同名タスク・所属の扱いと階層構築時間を検証する。 */
import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import type * as vscode from "vscode";
import { buildTree, rows, taskKey } from "../src/model";

const folder = {
  name: "repo",
  uri: { toString: () => "file:///repo" },
  index: 0,
} as vscode.WorkspaceFolder;
/** 階層処理の検証に必要な項目を持つタスクデータを作る。 */
function task(
  name: string,
  source = "Workspace",
  scope: vscode.Task["scope"] = folder,
): vscode.Task {
  return {
    name,
    source,
    scope,
    definition: { type: "shell", id: source + name },
    isBackground: false,
    presentationOptions: {},
    problemMatchers: [],
    runOptions: {},
  };
}
test("単一フォルダーを省略し、親タスクと子タスクを両方残す", () => {
  const result = rows(buildTree([task("test"), task("test:unit")], [folder]));
  assert.equal(result[0].name, "test");
  assert.equal(result[0].task?.name, "test");
  assert.equal(rows(result[0].branch)[0].name, "unit");
});
test("同名タスクを同じ階層に残す", () => {
  const result = rows(buildTree([task("build", "one"), task("build", "two")], [folder]));
  assert.deepEqual(
    result.map((row) => row.name),
    ["build", "build"],
  );
  assert.deepEqual(
    result.map((row) => row.description),
    ["one", "two"],
  );
  assert.ok(result.every((row) => !row.expand));
});
test("空の区切りを含む名前を分割しない", () => {
  const result = rows(
    buildTree(
      [":build", "test::unit", "build:"].map((name) => task(name)),
      [folder],
    ),
  );
  assert.deepEqual(
    result.map((row) => row.name),
    [":build", "test::unit", "build:"],
  );
});
test("共通タスクとフォルダーを最上位に置き、所属を添えない", () => {
  const second = {
    ...folder,
    name: "other",
    uri: { toString: () => "file:///other" },
  } as vscode.WorkspaceFolder;
  const result = rows(
    buildTree([task("build"), task("check-all", "Workspace", 2)], [folder, second]),
  );
  assert.equal(result[0].name, "repo");
  assert.equal(result[1].name, "check-all");
  assert.equal(result[1].description, undefined);
});
test("名前と提供元が同じでも定義の異なるタスクを上書きしない", () => {
  const one = task("build");
  const two = task("build");
  two.definition = { type: "shell", id: "second" };
  const result = rows(buildTree([one, two], [folder]));
  assert.equal(result.length, 2);
  assert.notEqual(result[0].description, result[1].description);
  assert.notEqual(taskKey(one), taskKey(two));
});
test("定義のプロパティ順序は同一性に影響しない", () => {
  const one = task("build");
  const two = task("build");
  two.definition = { id: one.definition.id, type: "shell" };
  assert.equal(taskKey(one), taskKey(two));
});
test("同名の親タスクが複数でも子階層を重複表示しない", () => {
  const result = rows(
    buildTree([task("test", "one"), task("test", "two"), task("test:unit")], [folder]),
  );
  assert.equal(result.filter((row) => row.expand).length, 1);
});
test("100件と1,000件の階層構築を測定する（対応上限ではない）", () => {
  for (const count of [100, 1000]) {
    const tasks = Array.from({ length: count }, (_, i) => task("group" + i + ":build"));
    const start = performance.now();
    const result = rows(buildTree(tasks, [folder]));
    assert.equal(result.length, count);
    console.log(count + " tasks: " + (performance.now() - start).toFixed(2) + " ms");
  }
});
