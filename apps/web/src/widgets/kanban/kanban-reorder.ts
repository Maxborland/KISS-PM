import { arrayMove } from "@dnd-kit/sortable";

export function kanbanInsertIndexById<T extends { id: string }>(
  bucket: T[],
  fallbackIndex: number,
  overId?: string
): number {
  const overIndex = overId ? bucket.findIndex((item) => item.id === overId) : -1;
  const index = overIndex >= 0 ? overIndex : fallbackIndex;
  return Math.max(0, Math.min(index, bucket.length));
}

export function reorderKanbanColumnByIds<T extends { id: string }>(
  bucket: T[],
  fromIndex: number,
  toIndex: number,
  movingId?: string,
  overId?: string
): T[] {
  const resolvedFrom = movingId ? bucket.findIndex((item) => item.id === movingId) : fromIndex;
  if (resolvedFrom < 0) return bucket;
  const resolvedTo = kanbanInsertIndexById(bucket, toIndex, overId);
  const targetIndex = Math.min(resolvedTo, bucket.length - 1);
  if (resolvedFrom === targetIndex) return bucket;
  return arrayMove(bucket, resolvedFrom, targetIndex);
}
