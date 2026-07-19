import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Отложенные side-эффекты «после коммита транзакции» (ревью #261): realtime-эмит
 * изнутри runDataSourceTransaction мог обгонять коммит Postgres — клиент делал
 * refetch, видел старое состояние и больше не получал события для уже
 * персистентного уведомления. Очередь живёт в AsyncLocalStorage: внутри
 * транзакции колбэки копятся и выполняются ПОСЛЕ успешного withTransaction
 * (откат/исключение — очередь отбрасывается вместе с контекстом); вне
 * транзакции колбэк выполняется сразу — поведение прежних не-транзакционных
 * путей не меняется.
 */
const afterCommitStorage = new AsyncLocalStorage<Array<() => void>>();

export function deferUntilTransactionCommit(callback: () => void): void {
  const queue = afterCommitStorage.getStore();
  if (queue) queue.push(callback);
  else callback();
}

export async function runWithAfterCommitQueue<T>(operation: () => Promise<T>): Promise<T> {
  const queue: Array<() => void> = [];
  const result = await afterCommitStorage.run(queue, operation);
  // Сюда попадаем только при успешном завершении (коммите) — flush.
  for (const callback of queue) {
    try {
      callback();
    } catch (error) {
      // Side-эффект (SSE-эмит) не должен ронять уже закоммиченный запрос.
      console.error("after_commit_callback_failed", error);
    }
  }
  return result;
}
