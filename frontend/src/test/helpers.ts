import { initialData, type BoardData } from "@/lib/kanban";

export function cloneInitialData(): BoardData {
  return JSON.parse(JSON.stringify(initialData));
}
