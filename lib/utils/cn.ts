// Utility for combining Tailwind class names
import { clsx } from 'clsx';  // Install clsx
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}