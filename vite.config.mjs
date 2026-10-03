/** @file Vite+のビルド・単体テスト・lint・型チェックと専用ツールの実行設定をまとめる。 */
import { defineConfig } from "vite-plus";

// VS Codeが読み込むCommonJS形式を維持する。
export default defineConfig({
  pack: {
    entry: { "src/extension": "src/extension.ts", "tests/integration": "tests/integration.ts" },
    format: "cjs",
    platform: "node",
    target: "node20",
    outDir: "dist",
    dts: false,
    sourcemap: true,
    deps: { neverBundle: ["vscode"] },
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
  // 外部アプリの起動と配布ファイルの生成は毎回実行する。
  run: {
    tasks: {
      integration: {
        command: "node scripts/test-integration.mjs",
        dependsOn: ["build"],
        cache: false,
      },
      // vsceのnpm呼び出しを使わず、pnpmで事前検証してからパッケージを作成する。
      vsix: {
        command:
          "pnpm run lint && pnpm run check && pnpm run build && vsce package --no-dependencies",
        cache: false,
      },
    },
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ["dist/**", "node_modules/**", ".vscode-test/**"],
    categories: { correctness: "error" },
  },
});
