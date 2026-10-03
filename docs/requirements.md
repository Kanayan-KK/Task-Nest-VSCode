# TaskNest 要件定義書

## 1. 概要

**TaskNest** は、Visual Studio Code が認識している Task をツリー形式で整理・表示・実行する VS Code 拡張機能である。

TaskNest 自身はタスクの検出・解析・実行方法の判定を行わず、VS Code Task API が提供する Task のみを扱う。

主な目的は以下とする。

- VS Code Task を見やすいツリー形式で表示する
- Namespace を利用して階層化する
- Multi-root Workspace を自然に扱う
- 軽量かつ高速に動作する
- VS Code 標準の Task 実行機構をそのまま利用する

---

## 2. 基本方針

TaskNest は以下の責務だけを持つ。

```text
VS Code Task取得
      ↓
ツリー構築
      ↓
Tree View表示
      ↓
Task実行
```

---

## 3. タスク取得

Task の取得には VS Code Task API を使用する。

```ts
vscode.tasks.fetchTasks()
```

APIから取得したTaskのうち、各フォルダーの `.vscode/tasks.json` と `.code-workspace` の `tasks` 欄に明示したものだけを表示する。
未登録の自動検出タスクとユーザー共通設定のタスクは表示しない。
VS Codeの設定APIから所属ごとの定義を読み、名前・種類・提供元の定義項目で照合する。
独自のファイル探索や実行設定の生成は行わない。

表示対象を種類だけで制限しない。npm型なども明示登録されていれば表示する。

例えば以下はすべて同じ `vscode.Task` として扱う。

```text
shell
process
npm
TypeScript
PowerShell
その他のTask Provider
```

TaskNest 側では Task の種類ごとの専用処理を実装しない。

---

## 4. ツリー表示

TaskNest 専用アイコンから開くサイドバーに Tree View を表示する。
タスクは実行ボタンで実行し、行の選択や階層の展開では実行しない。

基本的な階層構造は以下とする。

```text
Workspace Folder
    ↓
Namespace
    ↓
Task
```

ただし Workspace Folder が1つだけの場合、最上位の Workspace Folder 表示は省略してよい。

---

## 5. Namespace

Task の `name` を `:` で分割し、Namespace として階層化する。
`test::unit`、`:build`、`build:` のように分割後の要素が空になる名前は、分割せず全体を1つの名前として表示する。
表示のために元のタスク名や実行設定を変更しない。

例えば以下の Task が存在する場合、

```text
build
test:unit
test:e2e
test:e2e:chrome
deploy:staging
deploy:production
```

以下のように表示する。

```text
build

test
├─ unit
└─ e2e
   └─ chrome

deploy
├─ staging
└─ production
```

Namespace Separator は MVP では `:` 固定とする。

---

## 6. Namespace と Task の共存

Namespace 名そのものに対応する Task が存在する場合、そのノード自身も実行可能とする。

例えば、

```text
test
test:unit
test:e2e
```

の場合、

```text
test
├─ unit
└─ e2e
```

の `test` 自体も Task として実行できる。

### 同名タスク

同じフォルダー内に同名の別タスクがある場合は、同じ階層にそれぞれを表示し、`Task.source` の提供元を添える。
同名タスクをまとめる親ノードは追加せず、各タスクを直接実行できるようにする。
名前だけを識別子にしてタスクを上書きしない。提供元も同じ場合は、取得した定義情報などで区別できる表示を用意する。

```text
repo
├─ build（提供元1） ［実行］
└─ build（提供元2） ［実行］
```

提供元1・提供元2は表示例の仮表記であり、拡張機能名とは限らない。

---

## 7. Single-folder Workspace

通常の「Open Folder」でフォルダを1つ開いた場合も動作する。

例えば、

```text
repo/
├─ apps/
│  ├─ frontend/
│  └─ backend/
└─ .vscode/
   └─ tasks.json
```

を `repo` として開き、以下の Task が存在する場合、

```text
frontend:build
frontend:test
backend:build
backend:test
```

TaskNest は以下のように表示する。

```text
frontend
├─ build
└─ test

backend
├─ build
└─ test
```

TaskNest 自身は `apps/frontend` や `apps/backend` を探索しない。

---

## 8. Multi-root Workspace

VS Code の Multi-root Workspace にも対応する。

例えば以下の Workspace Folder が存在する場合、

```text
frontend
backend
```

各 Workspace Folder に以下の Task が存在するとする。

```text
frontend
  build
  test:unit

backend
  build
  deploy
```

TaskNest は以下のように表示する。

```text
frontend
├─ build
└─ test
   └─ unit

backend
├─ build
└─ deploy
```

Workspace Folder の判定には `vscode.Task.scope` を利用する。

特定フォルダーに属さない共通タスクは最上位に表示し、専用グループや所属の補足表示を追加しない。
名前に `:` が含まれる場合は通常の階層化ルールに従う。

```text
frontend
└─ build
backend
└─ test
check-all ［実行］
```

---

## 9. Task 実行

Task の実行には VS Code Task API を使用する。

```ts
vscode.tasks.executeTask(task)
```

TaskNest 自身は以下を変更しない。

- command
- args
- cwd
- env
- shell
- process
- presentation
- problemMatcher

元の VS Code Task 設定をそのまま利用する。
同時実行数や上限到達時の動作などの実行制御は VS Code に委ねる。
TaskNest 独自の実行制限、待ち行列、自動停止、自動再試行は追加しない。

---

## 10. Task 停止

実行中 Task に対応する `TaskExecution` を取得できる場合、停止できるようにする。

```ts
execution.terminate()
```

Tree View 上から実行中 Task を停止できること。
同じタスクが複数実行中の場合だけ操作対象を選び、選んだ `TaskExecution` を停止する。
他の実行は停止しない。対象選択には VS Code 標準の選択UIを使用する。

---

## 11. Task 再実行

実行中 Task に対して Restart を提供する。

Restart は以下の処理とする。

```text
Task停止
   ↓
終了
   ↓
同じTaskを再実行
```

実行中でない Task に対する Restart は通常の Run と同等とする。
複数実行中の場合は選択した実行だけを対象にし、他の実行は継続する。
終了確認には VS Code の実行終了イベントを使い、終了を確認できないまま新しい実行を開始しない。
ここで定義する再実行は、選択した実行の停止と同じタスクの実行を標準APIでつなぐ操作に留める。
VS Code 標準の再実行コマンドとの細かな挙動の一致は実装時に確認し、独自の実行管理を追加しない。

---

## 12. 実行状態表示

VS Code Task API の実行イベントを利用し、実行中 Task を Tree View 上で識別できるようにする。

例：

```text
frontend
├─ ● dev
└─ build
```

表示には VS Code 標準 Codicon を利用する。

---

## 13. Refresh

Task 一覧を手動で更新する機能を提供する。

コマンド：

```text
TaskNest: Refresh Tasks
```

実行時は以下の処理を行う。

```text
fetchTasks()
    ↓
Namespace Tree再構築
    ↓
Tree View更新
```

---

## 14. パフォーマンス要件

TaskNest ではパフォーマンスを重要要件とする。

以下を原則とする。

```text
No Workspace Scan
No Polling
Minimal Task Fetch
Lazy Activation
Lazy Tree View
Minimal Refresh
```

### Workspace Scan

TaskNest は Task 検出のために Workspace 内を走査しない。

以下のような処理は行わない。

```ts
workspace.findFiles("**/*")
```

### Polling

Task 一覧更新のための定期ポーリングは行わない。

### Task Fetch

`vscode.tasks.fetchTasks()` は必要なタイミングだけ実行する。

主なタイミングは以下とする。

- TaskNest 初回表示
- Manual Refresh

Task 実行や Tree 展開のたびに再取得しない。
フォルダーの追加・削除やタスク定義の変更も自動取得の契機にせず、手動更新で一覧へ反映する。

### 公開前の検証

- ワークスペース走査、定期取得、実行状態変更時の再取得がないことを確認する。
- タスク100件・1,000件で、外部のタスク取得時間とTaskNest内部の処理時間を分けて測定する。
- 件数は検証規模であり、対応上限ではない。応答時間の合格値は測定後に決める。

---

## 15. Lazy Activation

VS Code 起動時には可能な限り TaskNest を起動しない。

TaskNest View が利用された時点で初めて初期化する。

```text
VS Code起動
    ↓
TaskNest未起動
    ↓
TaskNest Viewを開く
    ↓
Activation
    ↓
Task取得
    ↓
Tree表示
```

---

## 16. Lazy Tree View

Namespace Tree の内部データは保持してよいが、すべての `TreeItem` を事前生成しない。

VS Code から `getChildren()` が呼ばれたノードについて必要な子要素を生成する。

---

## 17. 実行状態更新

Task の実行状態が変化しただけの場合、Task 一覧の再取得や Namespace Tree 全体の再構築を行わない。

変更された Task Node の表示のみ更新することを基本とする。

---

## 18. データ構造

Namespace Tree は以下のような構造を基本とする。

同じ位置のタスクを配列で保持し、表示時には同名の各タスクを同じ階層へ展開する。
内部の階層構造と表示用の行を分け、タスクの重複によって表示階層を増やさない。

```ts
interface TaskNode {
  name: string;
  children: Map<string, TaskNode>;
  tasks: vscode.Task[];
}
```

Task 名を `:` で分割し、順番に Tree へ追加する。

計算量は Task 数を `N`、平均 Namespace 深度を `D` として、

```text
O(N × D)
```

程度を目標とする。

---

## 19. 技術構成

実装言語：

```text
TypeScript
```

主要 API：

```text
vscode.tasks
TreeDataProvider
TreeView
Commands
```

ビルド：

```text
Vite+（vp pack）
```

を使用する。

単体テストは `vp test`、lintは `vp lint`、型チェックは `vp check` を使用する。
VS Code統合テストとVSIX生成は専用ツールを維持し、`vp run` から実行する。

---

## 20. MVP 機能

初回リリースでは以下を実装する。

- VS Code Task API からの Task 取得
- Tree View 表示
- `:` による Namespace 階層化
- Single-folder Workspace 対応
- Multi-root Workspace 対応
- Task 実行
- Task 停止
- Task 再実行
- 実行状態表示
- Manual Refresh
- Lazy Activation
- Lazy Tree View

---

## 21. 公開・対応方針

- ソースを公開し、Visual Studio Marketplace での配布を目標とする。
- ライセンスは MIT とする。
- 初回の動作保証対象は Windows のデスクトップ版 VS Code とする。
- TaskNest が提供するユーザー向けのテキストは、VS Code の表示言語にかかわらず英語で記述する。
- Marketplace の説明、README、変更履歴など、利用者に表示する公開文書は英語で記述する。
- 開発者向けの内部文書とコードコメントは日本語で記述してよい。

---

## 22. コンセプト

TaskNest のコンセプトは以下とする。

> Fast hierarchical task explorer for VS Code.

TaskNest は VS Code がすでに認識している Task に対して、

```text
取得
↓
Namespace階層化
↓
表示
↓
実行
```

だけを提供する。

Task の検出方法や実行方法には介入せず、**VS Code Task の高速で見やすい Tree UI** に特化する。
