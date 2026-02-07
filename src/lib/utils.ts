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
