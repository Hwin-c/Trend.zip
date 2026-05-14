import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse Firestore artists field.
 * The artists field is stored as a string like "['Artist1', 'Artist2']"
 * instead of a proper array. This function cleans it for display.
 * 
 * @example parseArtists("['El Potro', 'Yandel']") → "El Potro, Yandel"
 * @example parseArtists("['Fabio DJ']") → "Fabio DJ"
 */
export function parseArtists(raw: string): string {
  if (!raw) return 'Unknown Artist';

  // Try JSON.parse after converting single quotes to double quotes
  try {
    const cleaned = raw.replace(/'/g, '"');
    const arr = JSON.parse(cleaned);
    if (Array.isArray(arr)) {
      return arr.join(', ');
    }
  } catch {
    // fallback below
  }

  // Fallback: strip brackets and single quotes manually
  const fallback = raw.replace(/[\[\]']/g, '').trim();
  return fallback || raw;
}
