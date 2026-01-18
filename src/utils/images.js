// Image URL utilities for Deadlock items

const WIKI_BASE_URL = 'https://deadlock.wiki/Special:Redirect/file/';

/**
 * Convert item name to wiki image URL
 * @param {string} itemName - The item name (e.g., "Tesla Bullets")
 * @returns {string} - The wiki image URL
 */
export function getItemImageUrl(itemName) {
  if (!itemName) return null;

  // Convert spaces to underscores and handle special characters
  const wikiName = itemName
    .replace(/\s+/g, '_')
    .replace(/'/g, '%27');

  return `${WIKI_BASE_URL}${wikiName}.png`;
}

/**
 * Create an image element with fallback handling
 * @param {string} itemName - The item name
 * @param {string} className - CSS class for the image
 * @returns {HTMLImageElement}
 */
export function createItemImage(itemName, className = 'item-icon') {
  const img = document.createElement('img');
  img.src = getItemImageUrl(itemName);
  img.alt = itemName;
  img.className = className;
  img.loading = 'lazy';

  // Fallback to initials on error
  img.onerror = () => {
    img.style.display = 'none';
    const fallback = img.nextElementSibling;
    if (fallback && fallback.classList.contains('item-icon-fallback')) {
      fallback.style.display = 'flex';
    }
  };

  return img;
}

/**
 * Get initials from item name for fallback display
 * @param {string} itemName - The item name
 * @returns {string} - 1-2 character initials
 */
export function getItemInitials(itemName) {
  if (!itemName) return '?';

  const words = itemName.split(/\s+/);
  if (words.length === 1) {
    return itemName.substring(0, 2).toUpperCase();
  }
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
