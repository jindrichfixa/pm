import { initialData, type BoardData } from "@/lib/kanban";

export const cloneInitialData = (): BoardData =>
  JSON.parse(JSON.stringify(initialData));
