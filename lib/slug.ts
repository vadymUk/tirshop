const UK_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ye", ж: "zh", з: "z",
  и: "y", і: "i", ї: "yi", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ь: "", ю: "yu", я: "ya", "'": "", "’": "", ʼ: "",
};

/**
 * Builds an SEO-friendly slug: lowercase ASCII, words joined by hyphens. Transliterates
 * Ukrainian; Polish and other Latin diacritics are stripped (ł is mapped explicitly).
 * Intended for the future admin when creating products and categories.
 */
export function slugify(input: string, maxLength = 80) {
  const transliterated = input
    .toLowerCase()
    .replace(/ł/g, "l")
    .replace(/[\u0400-\u04ff'’ʼ]/g, (char) => UK_MAP[char] ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return transliterated
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}
