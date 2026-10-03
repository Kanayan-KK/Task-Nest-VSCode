/** @file ツリー上の実行・停止・再実行をVS Code標準APIへ接続する。 */
import * as vscode from "vscode";
import { taskKey, type Row } from "./model";
import { errorText } from "./text";

/** 複数実行中の場合だけ対象を選択させる。対象なし、または選択を取り消した場合はundefinedを返す。 */
async function selectExecution(task: vscode.Task): Promise<vscode.TaskExecution | undefined> {
  const executions = vscode.tasks.taskExecutions.filter(
    (execution) => taskKey(execution.task) === taskKey(task),
  );
  if (executions.length < 2) return executions[0];
  const selected = await vscode.window.showQuickPick(
    executions.map((execution, index) => ({
      label: `Execution ${index + 1}`,
      description: execution.task.name,
      execution,
    })),
    { placeHolder: "Select the execution to control" },
  );
  return selected?.execution;
}

/** 操作対象の実行を扱い、再実行の終了待ちとその解放を管理する。 */
export class TaskActions implements vscode.Disposable {
  private readonly pending = new Set<vscode.TaskExecution>();
  private readonly waiting = new Set<() => void>();
  /** 行に対応する元のタスクを、設定を変更せず実行する。 */
  async run(row?: Row): Promise<void> {
    if (row?.task) await vscode.tasks.executeTask(row.task);
  }
  /** 選択した実行だけを停止する。選択中に終了した実行には停止を要求しない。 */
  async stop(row?: Row): Promise<void> {
    if (!row?.task) return;
    const execution = await selectExecution(row.task);
    if (execution && vscode.tasks.taskExecutions.includes(execution)) execution.terminate();
  }
  /** 選択した実行の終了を待って同じタスクを起動する。待機の取り消し時は起動せず、停止済みの要求は戻さない。 */
  async restart(row?: Row): Promise<void> {
    if (!row?.task) return;
    const active = vscode.tasks.taskExecutions.some(
      (execution) => taskKey(execution.task) === taskKey(row.task!),
    );
    if (!active) return this.run(row);
    const execution = await selectExecution(row.task);
    if (!execution || this.pending.has(execution)) return;
    if (!vscode.tasks.taskExecutions.includes(execution)) return;
    this.pending.add(execution);
    try {
      // 停止前に終了を購読し、キャンセルや拡張終了時には再起動しない。
      const ended = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "TaskNest: waiting for task to stop",
          cancellable: true,
        },
        (_progress, token) =>
          new Promise<boolean>((resolve, reject) => {
            /** 終了イベントとキャンセルの購読を解放し、再起動してよいかを待機側へ返す。 */
            const finish = (ended: boolean) => {
              listener.dispose();
              cancel.dispose();
              this.waiting.delete(dispose);
              resolve(ended);
            };
            /** 停止待ちを解除し、後続の再起動を中止する。 */
            const dispose = () => finish(false);
            const listener = vscode.tasks.onDidEndTask((event) => {
              if (event.execution === execution) finish(true);
            });
            const cancel = token.onCancellationRequested(dispose);
            this.waiting.add(dispose);
            try {
              execution.terminate();
            } catch (error) {
              listener.dispose();
              cancel.dispose();
              this.waiting.delete(dispose);
              reject(error);
            }
          }),
      );
      if (ended) await vscode.tasks.executeTask(execution.task);
    } finally {
      this.pending.delete(execution);
    }
  }
  /** 残っている終了待ちを解除し、拡張終了後の再起動を防ぐ。 */
  dispose(): void {
    for (const cancel of this.waiting) cancel();
  }
}
/** 操作中の例外を捕捉し、VS Codeのエラー通知として表示する。 */
export async function report(action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (error) {
    void vscode.window.showErrorMessage("TaskNest: " + errorText(error));
  }
}
