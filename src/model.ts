/** @file タスクの識別、名前による階層構築、表示用の行への変換を担当する。 */
import type * as vscode from "vscode";

// 表示名ではなく所属と定義を使い、更新前後のタスクを対応付ける。
/** 定義を比較できるよう、オブジェクトのキーを並べ替えて文字列化する。配列の順序は維持する。 */
export function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + stable(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
/** フォルダーのURIまたは共通タスクの所属を比較用の文字列にする。 */
export function scopeKey(task: vscode.Task): string {
  return typeof task.scope === "object" ? task.scope.uri.toString() : String(task.scope);
}
/** 所属・提供元・名前・定義から、取得前後のタスクを対応付けるキーを作る。 */
export function taskKey(task: vscode.Task): string {
  return stable([scopeKey(task), task.source, task.name, task.definition]);
}
/** 同じ名前の階層に属する子要素と複数のタスクを保持する。 */
export interface Branch {
  id: string;
  name: string;
  children: Map<string, Branch>;
  tasks: vscode.Task[];
  folder?: boolean;
}
/** ツリーに表示する1行と、実行対象や展開先の対応を保持する。 */
export interface Row {
  id: string;
  name: string;
  branch: Branch;
  task?: vscode.Task;
  description?: string;
  expand: boolean;
}
/** タスクも子要素も持たない階層を作る。 */
function branch(id: string, name: string): Branch {
  return { id, name, children: new Map(), tasks: [] };
}
/** タスク名をコロンで階層化する。空の区切りがある名前は分割せず、共通タスクは最上位に置く。 */
export function buildTree(
  tasks: readonly vscode.Task[],
  folders: readonly vscode.WorkspaceFolder[],
): Branch {
  const root = branch("root", "");
  for (const task of tasks) {
    let parent = root;
    // 共通タスクは最上位へ置き、フォルダー所属とは内部キーを分ける。
    const folder = typeof task.scope === "object" ? task.scope : undefined;
    const hideFolder = folders.length === 1 && folder?.uri.toString() === folders[0].uri.toString();
    if (folder && !hideFolder) {
      const key = "folder:" + folder.uri.toString();
      if (!root.children.has(key))
        root.children.set(key, { ...branch(key, folder.name), folder: true });
      parent = root.children.get(key)!;
    }
    const parts = task.name.split(":");
    const names = parts.some((part) => !part) ? [task.name] : parts;
    for (const name of names) {
      const key = scopeKey(task) + ":" + name;
      if (!parent.children.has(key))
        parent.children.set(key, branch(parent.id + "/" + JSON.stringify(key), name));
      parent = parent.children.get(key)!;
    }
    parent.tasks.push(task);
  }
  return root;
}
/** 直下の階層を表示行へ変換する。同名タスクは横並びの行にし、子階層の重複表示を避ける。 */
export function rows(parent: Branch): Row[] {
  return [...parent.children.values()].flatMap((node) => {
    if (!node.tasks.length)
      return [{ id: node.id, name: node.name, branch: node, expand: !!node.children.size }];
    const sources = new Map<string, number>();
    for (const task of node.tasks) sources.set(task.source, (sources.get(task.source) ?? 0) + 1);
    return node.tasks.map((task, index) => ({
      id: node.id + "/task/" + index,
      name: node.name,
      branch: node,
      task,
      // 同名の親タスクが複数ある場合、子階層は最初の行にだけ表示する。
      expand: index === 0 && !!node.children.size,
      description:
        node.tasks.length > 1
          ? task.source +
            (sources.get(task.source)! > 1
              ? " · " + stable(task.definition) + " #" + (index + 1)
              : "")
          : undefined,
    }));
  });
}
