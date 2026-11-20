import type { Condition } from "./types";

export interface SavedStrategy {
  id: string;
  name: string;
  intent: string;
  conditions: Condition[];
  savedAt: string;
  dataMode?: string;
  counts?: { selected: number; excluded: number; pending: number };
  selectedCodes?: string[];
}

const STORAGE_KEY = "nl-stock-picker.strategies.v1";

export function listStrategies(): SavedStrategy[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedStrategy[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStrategy(input: Omit<SavedStrategy, "id" | "savedAt"> & { id?: string }): SavedStrategy {
  const all = listStrategies();
  const now = new Date().toISOString();
  const item: SavedStrategy = {
    id: input.id ?? `s_${Date.now()}`,
    name: input.name.trim() || `策略 ${new Date().toLocaleString("zh-CN")}`,
    intent: input.intent,
    conditions: input.conditions.map((c) => ({ ...c })),
    savedAt: now,
    dataMode: input.dataMode,
    counts: input.counts,
    selectedCodes: input.selectedCodes,
  };
  const next = [item, ...all.filter((s) => s.id !== item.id)].slice(0, 30);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return item;
}

export function deleteStrategy(id: string): void {
  const next = listStrategies().filter((s) => s.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
