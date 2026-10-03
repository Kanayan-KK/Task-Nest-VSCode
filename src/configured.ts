/** @file 設定に明示したタスクとVS Codeの取得結果を照合し、表示対象を絞り込む。 */
import * as vscode from "vscode";
import { stable } from "./model";

type Entry = Record<string, unknown>;

/** 設定値からタスク定義として扱えるオブジェクトだけを取り出す。 */
function entries(value: unknown): Entry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is Entry => !!entry && typeof entry === "object" && !Array.isArray(entry),
  );
}

/** 所属が一致したタスクについて、種類・名前・提供元の定義項目を照合する。 */
function matches(task: vscode.Task, entry: Entry, properties: readonly string[]): boolean {
  // dependsOnだけのタスクは、VS Codeが$composite型として返す。
  const type =
    entry.type ??
    (task.definition.type === "$composite" && entry.dependsOn !== undefined
      ? "$composite"
      : "shell");
  if (type !== task.definition.type) return false;
  if (typeof entry.label === "string" && entry.label !== task.name) return false;
  // VS Codeが設定から生成するタスクは、所属・種類・名前で照合する。
  if (type === "shell" || type === "process" || type === "$composite")
    return entry.label === task.name;
  // 提供元の定義項目で照合し、同名の自動検出タスクを混ぜない。
  const keys = [...new Set([...Object.keys(task.definition), ...properties])].filter(
    (key) => key !== "type" && key in entry,
  );
  if (!keys.length) return false;
  return keys.every((key) => stable(entry[key]) === stable(task.definition[key]));
}

/** プロジェクトに明示したタスクだけを元のTaskオブジェクトのまま返す。ユーザー共通設定は含めない。 */
export function configuredTasks(tasks: readonly vscode.Task[]): vscode.Task[] {
  // 拡張が公開する定義項目は取得ごとに一度だけ集める。
  const properties = new Map<string, string[]>();
  for (const extension of vscode.extensions.all) {
    const definitions = extension.packageJSON.contributes?.taskDefinitions as
      | { type: string; properties?: Record<string, unknown> }[]
      | undefined;
    for (const definition of definitions ?? [])
      properties.set(definition.type, [
        ...(properties.get(definition.type) ?? []),
        ...Object.keys(definition.properties ?? {}),
      ]);
  }
  const folders = vscode.workspace.workspaceFolders ?? [];
  const configured = new Map<string | vscode.TaskScope, Entry[]>();
  // 設定APIで各フォルダーの明示定義だけを読む。ファイル探索や監視は行わない。
  for (const folder of folders) {
    const setting = vscode.workspace
      .getConfiguration("tasks", folder.uri)
      .inspect<unknown[]>("tasks");
    const value =
      setting?.workspaceFolderValue ??
      (!vscode.workspace.workspaceFile ? setting?.workspaceValue : undefined);
    configured.set(folder.uri.toString(), entries(value));
  }
  if (vscode.workspace.workspaceFile) {
    const setting = vscode.workspace.getConfiguration("tasks").inspect<unknown[]>("tasks");
    configured.set(vscode.TaskScope.Workspace, entries(setting?.workspaceValue));
  }
  // ユーザー設定や未登録の自動検出結果は対象外。実行には元のTaskを使う。
  return tasks.filter((task) => {
    const scope = typeof task.scope === "object" ? task.scope.uri.toString() : task.scope;
    if (scope === undefined) return false;
    return (configured.get(scope) ?? []).some((entry) =>
      matches(task, entry, properties.get(task.definition.type) ?? []),
    );
  });
}
