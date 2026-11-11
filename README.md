# TaskNest

TaskNest は、Visual Studio Code（VS Code）のタスクを名前に含まれる `:` で区切り、ツリーにまとめる拡張機能です。タスクの実行、停止、再実行をツリーから操作できます。

## インストール

1. [最新リリース](https://github.com/Kanayan-KK/Task-Nest-VSCode/releases/latest)の **Assets** から、拡張子が `.vsix` のファイルをダウンロードします。
2. VS Code の拡張機能ビューで **…** メニューを開き、**VSIX からのインストール** を選びます。
3. ダウンロードしたファイルを選択します。

## 使い方

たとえば、ワークスペースの `.vscode/tasks.json` に次のタスクを定義します。

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "build:frontend",
      "type": "shell",
      "command": "echo frontend build",
      "problemMatcher": []
    },
    {
      "label": "build:backend",
      "type": "shell",
      "command": "echo backend build",
      "problemMatcher": []
    },
    {
      "label": "test:unit",
      "type": "shell",
      "command": "echo unit test",
      "problemMatcher": []
    }
  ]
}
```

アクティビティバーから **TaskNest** を開くと、同じ接頭辞を持つタスクが一つのグループにまとまります。

```text
build
├─ frontend
└─ backend
test
└─ unit
```

TaskNest は、ビューを初めて開いたときに、各ワークスペースフォルダーの `.vscode/tasks.json` と `.code-workspace` ファイルに定義されたタスクを読み込みます。タスクの設定やワークスペースフォルダーを変更したら、ビューの **Refresh Tasks** を押して一覧を更新します。

自動検出されたタスクとユーザー単位のタスクは表示対象外です。TaskNest はサブフォルダー内の設定ファイルを検索しません。複数のプロジェクトを一緒に表示するには、各プロジェクトのフォルダーを同じワークスペースに追加します。

## 動作環境

TaskNest は信頼済みのワークスペースで動作します。仮想ワークスペースには対応していません。

| 項目 | バージョン |
| --- | --- |
| TaskNest | 0.1.0 |
| Visual Studio Code | 1.100 以降 |
| 開発用の Node.js | 24.21.0（固定） |
| 開発用のパッケージ管理ツール pnpm | 12.8.1（固定） |

## 開発手順

リポジトリのルートで次のコマンドを実行します。fnm（Fast Node Manager）は `.node-version` に指定された Node.js を選択します。

```powershell
fnm install
fnm use
node --version
corepack enable pnpm
pnpm install --frozen-lockfile
pnpm run all
```

VS Code で F5 キーを押すと、拡張機能を試すための別のウィンドウが開きます。**タスクの実行** からは `all`、`format`、`package`、`build`、`test`、`test:integration`、`lint`、`check` を選択できます。

### 開発用コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm run all` | 型の検査、整形、コードの検査、ビルド、単体テスト、統合テスト、パッケージ作成を順に実行します。 |
| `pnpm run check` | TypeScript の型を検査します。 |
| `pnpm run format` | コードを整形してファイルに書き込みます。 |
| `pnpm run format:check` | コードの書式を確認します。 |
| `pnpm run lint` | コードを検査します。警告があれば検査は失敗します。 |
| `pnpm run lint:fix` | 検査で見つかった問題のうち、自動修正できるものを修正します。 |
| `pnpm run build` | 拡張機能をビルドします。 |
| `pnpm test` | 単体テストを実行します。 |
| `pnpm run test:integration` | VS Code 上で統合テストを実行します。 |
| `pnpm run package` | インストール用の `.vsix` ファイルを作成します。 |
| `pnpm run prepare` | Git のフックと、フックが使う Node.js と pnpm の実行パスを設定します。 |

`pnpm run all` は、途中の処理が失敗すると停止します。

### 統合テストで使う VS Code

統合テストは、既定で最新の安定版をダウンロードして使います。対応する最も古いバージョンで試すには、環境変数 `TASKNEST_VSCODE_VERSION` を `1.100.0` に設定してから `pnpm run test:integration` を実行します。

インストール済みの VS Code を使うには、環境変数 `TASKNEST_VSCODE_PATH` に実行ファイルの絶対パスを設定します。この設定は `TASKNEST_VSCODE_VERSION` より優先されます。

### コミット前の確認

`pnpm install --frozen-lockfile` を実行すると、Git のコミット前フックが有効になります。フックは `pnpm run all` を実行し、検証に失敗するとコミットを中止します。

フックは整形後の変更を自動でステージしないため、変更をステージする前に `pnpm run all` を実行します。Node.js または pnpm のインストール先が変わった場合は、`pnpm run prepare` を再実行します。

### 手元でパッケージを作成してインストールする

次のコマンドでパッケージを作成し、VS Code にインストールできます。VS Code の `package` タスクでも同じファイルを作成できます。

```powershell
pnpm run package
code --install-extension .\task-nest-0.1.0.vsix
```

[変更履歴](CHANGELOG.md) · [ライセンス（MIT）](LICENSE)
