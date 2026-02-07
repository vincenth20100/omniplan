import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function removeUndefined<T extends object>(obj: T): T {
  const newObj: any = {};
  Object.keys(obj).forEach((key) => {
    if ((obj as any)[key] !== undefined) {
      newObj[key] = (obj as any)[key];
    }
  });
  return newObj;
}

export function getProjectColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
}
