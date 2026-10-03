/** @file テスト用VS Codeを起動し、単一フォルダーと共通タスク付きワークスペースで統合テストを実行する。 */
import { runTests } from "@vscode/test-electron";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

// 導入済みVSIXの検証では別の拡張をテストの起動役にし、開発版への置き換えを防ぐ。
const installed = process.env.TASKNEST_INSTALLED_EXTENSIONS;
const host = resolve(".vscode-test/tasknest-test-host");
if (installed) {
  await mkdir(host, { recursive: true });
  await writeFile(
    resolve(host, "package.json"),
    JSON.stringify({
      name: "tasknest-test-host",
      publisher: "tasknest-tests",
      version: "0.0.1",
      engines: { vscode: "^1.100.0" },
    }),
  );
}
// 単一フォルダーと共通タスクを持つワークスペースを別々に検証する。
for (const fixture of ["tests/fixture", "tests/fixture/project.code-workspace"])
  await runTests({
    extensionDevelopmentPath: installed ? host : resolve("."),
    extensionTestsPath: resolve("dist/tests/integration.cjs"),
    // VS Codeからのコミットで継承されるNode実行モードを、テスト用VS Codeでは解除する。
    extensionTestsEnv: { ELECTRON_RUN_AS_NODE: undefined },
    launchArgs: [
      resolve(fixture),
      "--disable-workspace-trust",
      "--skip-welcome",
      "--skip-release-notes",
      ...(installed ? ["--extensions-dir", resolve(installed), "--locale", "ja"] : []),
    ],
    ...(process.env.TASKNEST_VSCODE_PATH
      ? { vscodeExecutablePath: process.env.TASKNEST_VSCODE_PATH }
      : {}),
  });
