import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(firstName?: string, lastName?: string) {
  const a = firstName?.[0] ?? "";
  const b = lastName?.[0] ?? "";
  return `${a}${b}`.toUpperCase() || "SS";
}
