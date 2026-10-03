/** @file TaskNestの起動時にツリービューと操作コマンドを登録する。 */
import * as vscode from "vscode";
import { TaskTree } from "./provider";
import { TaskActions, report } from "./actions";
import type { Row } from "./model";

/** 表示と操作を接続し、拡張終了時に解放するリソースを登録する。 */
export function activate(context: vscode.ExtensionContext): void {
  const tree = new TaskTree();
  const actions = new TaskActions();
  const view = vscode.window.createTreeView("tasknest.tasks", { treeDataProvider: tree });
  tree.onMessage = (message) => {
    view.message = message;
  };
  context.subscriptions.push(
    tree,
    actions,
    view,
    vscode.commands.registerCommand("tasknest.refresh", () => report(() => tree.refresh())),
    ...(["run", "stop", "restart"] as const).map((action) =>
      vscode.commands.registerCommand("tasknest." + action, (row?: Row) =>
        report(() => actions[action](row)),
      ),
    ),
  );
}
