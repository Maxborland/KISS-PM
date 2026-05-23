export const RESOURCE_MATRIX_DAY_COLUMN_WIDTH = 28;
export const RESOURCE_MATRIX_NAME_COLUMN_WIDTH = 220;

export function resourceMatrixGridTemplateColumns(dayCount: number): string {
  return `${RESOURCE_MATRIX_NAME_COLUMN_WIDTH}px repeat(${dayCount}, ${RESOURCE_MATRIX_DAY_COLUMN_WIDTH}px)`;
}
