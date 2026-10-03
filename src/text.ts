/** @file 通知用のエラー文字列への変換を共通化する。 */
/** Errorはメッセージを取り出し、それ以外の例外値は文字列に変換する。 */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
