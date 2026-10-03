/** @file VS Codeのツリービューへ表示行を提供し、一覧取得と実行状態の更新を管理する。 */
import * as vscode from "vscode";
import { buildTree, rows, taskKey, type Branch, type Row } from "./model";
import { errorText } from "./text";
import { configuredTasks } from "./configured";

/** 一覧と表示行を保持し、必要な階層だけを生成するツリーデータ提供クラス。 */
export class TaskTree implements vscode.TreeDataProvider<Row>, vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<Row | undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  private root: Branch = buildTree([], []);
  private loaded = false;
  private pending?: Promise<void>;
  private readonly cache = new Map<Branch, Row[]>();
  private readonly visibleTasks = new Map<string, Set<Row>>();
  private readonly subscriptions: vscode.Disposable[];
  onMessage?: (message: string | undefined) => void;

  /** 一覧取得処理を受け取り、タスクの開始・終了に応じた表示更新を登録する。ここでは一覧を取得しない。 */
  constructor(
    private readonly fetchTasks: () => Thenable<vscode.Task[]> = () => vscode.tasks.fetchTasks(),
  ) {
    this.subscriptions = [
      vscode.tasks.onDidStartTask((event) => this.update(event.execution.task)),
      vscode.tasks.onDidEndTask((event) => this.update(event.execution.task)),
    ];
  }
  /** 一覧の更新を要求する。同時に要求された更新は進行中の処理を共有する。 */
  async refresh(): Promise<void> {
    if (this.pending) return this.pending;
    this.pending = this.fetch();
    try {
      await this.pending;
    } finally {
      this.pending = undefined;
    }
  }
  /** 表示対象を取得して階層と表示キャッシュを更新する。失敗時は既存の一覧を維持して通知する。 */
  private async fetch(): Promise<void> {
    try {
      // 取得に失敗した場合は既存の一覧を維持する。
      const tasks = configuredTasks(await this.fetchTasks());
      this.root = buildTree(tasks, vscode.workspace.workspaceFolders ?? []);
      this.cache.clear();
      this.visibleTasks.clear();
      this.loaded = true;
      this.onMessage?.(
        tasks.length ? undefined : "No tasks. Configure tasks in VS Code, then refresh.",
      );
      this.changed.fire(undefined);
    } catch (error) {
      this.loaded = true;
      this.onMessage?.("Could not load tasks. Use Refresh to retry.");
      void vscode.window.showErrorMessage("TaskNest: " + errorText(error));
    }
  }
  /** 指定行の直下を必要時に生成して返す。行の省略時は最上位を返し、初回だけ一覧を取得する。 */
  async getChildren(row?: Row): Promise<Row[]> {
    if (!this.loaded) await this.refresh();
    if (row && !row.expand) return [];
    const parent = row?.branch ?? this.root;
    if (!this.cache.has(parent)) {
      const children = rows(parent);
      this.cache.set(parent, children);
      for (const child of children) {
        if (!child.task) continue;
        const key = taskKey(child.task);
        if (!this.visibleTasks.has(key)) this.visibleTasks.set(key, new Set());
        this.visibleTasks.get(key)!.add(child);
      }
    }
    return this.cache.get(parent)!;
  }
  /** 行をVS Codeの表示要素に変換し、現在の実行数に応じたアイコンと操作を設定する。 */
  getTreeItem(row: Row): vscode.TreeItem {
    const item = new vscode.TreeItem(
      row.name,
      row.expand ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
    );
    item.id = row.id;
    item.description = row.description;
    if (!row.task) {
      item.iconPath = new vscode.ThemeIcon(row.branch.folder ? "folder" : "list-tree");
      return item;
    }
    const count = vscode.tasks.taskExecutions.filter(
      (execution) => taskKey(execution.task) === taskKey(row.task!),
    ).length;
    item.contextValue = count ? "taskRunning" : "taskIdle";
    item.iconPath = new vscode.ThemeIcon(count ? "sync~spin" : "tools");
    item.tooltip = row.task.name + (row.description ? "\n" + row.description : "");
    if (count) item.description = [row.description, `${count} running`].filter(Boolean).join(" · ");
    return item;
  }
  /** 状態が変化したタスクの表示行だけを更新通知し、一覧は再取得しない。 */
  private update(task: vscode.Task): void {
    // 実行状態の変化では取得や階層の再構築を行わない。
    for (const row of this.visibleTasks.get(taskKey(task)) ?? []) this.changed.fire(row);
  }
  /** 実行イベントの購読と表示更新用の通知を解放する。 */
  dispose(): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
    this.changed.dispose();
  }
}
