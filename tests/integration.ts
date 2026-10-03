/** @file 実際のVS Codeで表示対象の絞り込みと実行・停止・再実行を検証する。 */
import * as vscode from "vscode";
import assert from "node:assert/strict";
import { TaskTree } from "../src/provider";
import { taskKey } from "../src/model";

/** 指定タスクの開始または終了を待つ。20秒で失敗させ、購読を解除できる関数も返す。 */
function waitFor(
  start: boolean,
  name: string,
): { promise: Promise<vscode.TaskExecution>; dispose: () => void } {
  let listener: vscode.Disposable;
  let timer: NodeJS.Timeout;
  const promise = new Promise<vscode.TaskExecution>((resolve, reject) => {
    timer = setTimeout(() => {
      listener.dispose();
      reject(new Error("Task event timeout"));
    }, 20000);
    /** 検証対象のイベントだけを受け取り、時間制限と購読を解放して待機を完了する。 */
    const accept = (event: vscode.TaskStartEvent | vscode.TaskEndEvent) => {
      if (event.execution.task.name !== name) return;
      clearTimeout(timer);
      listener.dispose();
      resolve(event.execution);
    };
    listener = start ? vscode.tasks.onDidStartTask(accept) : vscode.tasks.onDidEndTask(accept);
  });
  // 操作が先に失敗しても、まだawaitされていない待機が未処理の拒否にならないようにする。
  void promise.catch(() => {});
  return {
    promise,
    dispose: () => {
      clearTimeout(timer);
      listener.dispose();
    },
  };
}
/** 拡張の読み込みから操作まで検証し、終了時にテスト用の実行と登録を解放する。 */
export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("kanayan-kk.task-nest");
  assert.ok(extension);
  await extension.activate();
  assert.ok((await vscode.commands.getCommands()).includes("tasknest.refresh"));
  const folder = vscode.workspace.workspaceFolders![0];
  let fetches = 0;
  const definitions = ["job", "test", "test:unit"].map(
    (name) =>
      new vscode.Task(
        { type: "tasknest-test", id: name },
        folder,
        name,
        "TaskNest Test",
        new vscode.ProcessExecution(process.execPath, ["-e", "setTimeout(() => {}, 15000)"], {
          env: { ELECTRON_RUN_AS_NODE: "1" },
        }),
      ),
  );
  const provider = vscode.tasks.registerTaskProvider("tasknest-test", {
    provideTasks: () => definitions,
    resolveTask: () => undefined,
  });
  // VS Code自身の取得と区別し、拡張が要求した実際の取得だけを数える。
  const tree = new TaskTree(() => {
    fetches++;
    return vscode.tasks.fetchTasks();
  });
  const waits: ReturnType<typeof waitFor>[] = [];
  /** 待機処理を登録し、途中で失敗した場合もfinallyで解放できるようにする。 */
  const wait = (start: boolean, name = "job") => {
    const pending = waitFor(start, name);
    waits.push(pending);
    return pending.promise;
  };
  try {
    await tree.refresh();
    const fetched = fetches;
    const root = await tree.getChildren();
    console.log(
      "Visible tasks:",
      root.map((row) => row.task?.name),
    );
    if (vscode.workspace.workspaceFile)
      assert.ok(root.some((row) => row.task?.name === "common" && !row.description));
    assert.ok(root.some((row) => row.task?.name === "npm-configured"));
    // 複合タスクを表示し、元のタスクを実行すると依存タスクが開始・終了することを確認する。
    const aggregate = root.find((row) => row.task?.name === "aggregate");
    assert.ok(aggregate);
    assert.equal(aggregate.task?.definition.type, "$composite");
    assert.ok(
      (await tree.getChildren(aggregate)).some((row) => row.task?.name === "aggregate:child"),
    );
    const childStarted = wait(true, "aggregate:child");
    const childEnded = wait(false, "aggregate:child");
    await vscode.commands.executeCommand("tasknest.run", aggregate);
    await childStarted;
    await childEnded;
    assert.ok(!root.some((row) => row.task?.definition.type === "tasknest-test"));
    assert.ok(!root.some((row) => row.task?.definition.script === "auto-only"));
    const detected = await vscode.tasks.fetchTasks();
    assert.ok(
      detected.some((task) => task.definition.script === "auto-only"),
      "Excluded task must actually exist in API results",
    );
    const row = root.find((row) => row.task?.name === "job")!;
    assert.ok(row);
    assert.equal(tree.getTreeItem(row).command, undefined);
    assert.equal(tree.getTreeItem(row).contextValue, "taskIdle");
    await tree.getChildren(root.find((row) => row.name === "test"));
    assert.equal(fetches, fetched);
    const started = wait(true);
    await vscode.commands.executeCommand("tasknest.run", row);
    const execution = await started;
    assert.equal(taskKey(execution.task), taskKey(row.task!));
    assert.equal(tree.getTreeItem(row).contextValue, "taskRunning");
    const ended = wait(false);
    const restarted = wait(true);
    await vscode.commands.executeCommand("tasknest.restart", row);
    await ended;
    await restarted;
    const stopped = wait(false);
    await vscode.commands.executeCommand("tasknest.stop", row);
    await stopped;
    assert.equal(fetches, fetched, "State changes must not fetch tasks");
    await tree.refresh();
    assert.ok(fetches > fetched);
    console.log(
      "TaskNest integration passed: composite dependencies, fetch, lazy children, run, restart, stop, no state-triggered fetch",
    );
  } finally {
    // 待機のタイマーと購読を解放してから、テスト用タスクを停止する。
    for (const pending of waits) pending.dispose();
    for (const execution of vscode.tasks.taskExecutions)
      if (execution.task.name === "job") execution.terminate();
    tree.dispose();
    provider.dispose();
  }
}
