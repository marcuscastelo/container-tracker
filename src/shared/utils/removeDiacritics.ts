// Removes diacritics from a string (e.g., accents)
// Example: "Tapioca doce" and "Tapioca doçe" both become "Tapioca doce"
export function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}
