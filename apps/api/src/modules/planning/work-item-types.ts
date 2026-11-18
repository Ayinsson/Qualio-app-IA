export const WORK_ITEM_TYPES = ['TASK', 'BUG'] as const;

export type WorkItemType = (typeof WORK_ITEM_TYPES)[number];
