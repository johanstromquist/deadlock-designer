// Hero Selection Component
import { getTagIcon } from '../utils/tagIcons.js';

export class HeroSelect {
  constructor(container, onHeroSelect) {
    this.container = container;
    this.onHeroSelect = onHeroSelect;
    this.heroes = [];
    this.filteredHeroes = [];
    this.selectedTags = new Set();
    this.searchQuery = '';
    this.heroImages = {};
    this.imageBaseUrl = '';

    this.heroGrid = document.getElementById('hero-grid');
    this.searchInput = document.getElementById('hero-search');
    this.tagFilters = document.getElementById('tag-filters');

    this.bindEvents();
  }

  async loadHeroes() {
    try {
      // Load hero index and images in parallel
      const base = import.meta.env.BASE_URL;
      const [indexResponse, imagesResponse] = await Promise.all([
        fetch(`${base}data/heroes/index.json`),
        fetch(`${base}data/heroes/images.json`)
      ]);

      const index = await indexResponse.json();
      const imagesData = await imagesResponse.json();

      this.imageBaseUrl = imagesData.baseUrl;
      this.heroImages = imagesData.heroes;

      // Load each hero
      const heroPromises = index.heroes.map(async (heroId) => {
        const response = await fetch(`${base}data/heroes/${heroId}.json`);
        return response.json();
      });

      this.heroes = await Promise.all(heroPromises);
      this.filteredHeroes = [...this.heroes];

      // Extract all unique tags
      const allTags = new Set();
      this.heroes.forEach(hero => {
        hero.tags.forEach(tag => allTags.add(tag));
      });

      this.renderTagFilters(Array.from(allTags).sort());
      this.render();
    } catch (error) {
      console.error('Failed to load heroes:', error);
      this.heroGrid.innerHTML = '<p class="error">Failed to load heroes. Please refresh the page.</p>';
    }
  }

  bindEvents() {
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.filterHeroes();
    });
  }

  renderTagFilters(tags) {
    this.tagFilters.innerHTML = tags.map(tag => `
      <button class="tag-btn tag-${tag.toLowerCase().replace(/\s+/g, '-')}" data-tag="${tag}">
        <span class="tag-icon">${getTagIcon(tag)}</span>
        <span class="tag-label">${tag}</span>
      </button>
    `).join('');

    this.tagFilters.querySelectorAll('.tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        if (this.selectedTags.has(tag)) {
          this.selectedTags.delete(tag);
          btn.classList.remove('active');
        } else {
          this.selectedTags.add(tag);
          btn.classList.add('active');
        }
        this.filterHeroes();
      });
    });
  }

  filterHeroes() {
    this.filteredHeroes = this.heroes.filter(hero => {
      // Search filter
      const matchesSearch = !this.searchQuery ||
        hero.name.toLowerCase().includes(this.searchQuery) ||
        hero.tags.some(tag => tag.toLowerCase().includes(this.searchQuery));

      // Tag filter
      const matchesTags = this.selectedTags.size === 0 ||
        Array.from(this.selectedTags).every(tag => hero.tags.includes(tag));

      return matchesSearch && matchesTags;
    });

    this.render();
  }

  render() {
    this.heroGrid.innerHTML = this.filteredHeroes.map(hero => {
      const imagePath = this.heroImages[hero.id];
      const imageUrl = imagePath ? `${this.imageBaseUrl}/${imagePath}` : null;

      return `
        <div class="hero-card" data-hero-id="${hero.id}">
          <div class="hero-portrait ${imageUrl ? 'has-image' : ''}">
            ${imageUrl
              ? `<img src="${imageUrl}" alt="${hero.name}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                 <span class="fallback-initials" style="display:none;">${this.getHeroInitials(hero.name)}</span>`
              : this.getHeroInitials(hero.name)
            }
          </div>
          <div class="hero-name">${hero.name}</div>
          <div class="hero-card-tags">
            ${hero.tags.map(tag => `<span class="hero-card-tag tag-${tag.toLowerCase().replace(/\s+/g, '-')}" title="${tag}">${getTagIcon(tag)}</span>`).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Bind click events
    this.heroGrid.querySelectorAll('.hero-card').forEach(card => {
      card.addEventListener('click', () => {
        const heroId = card.dataset.heroId;
        const hero = this.heroes.find(h => h.id === heroId);
        if (hero && this.onHeroSelect) {
          this.onHeroSelect(hero);
        }
      });
    });
  }

  getHeroInitials(name) {
    return name.split(/[\s&]+/).map(word => word[0]).join('').toUpperCase().slice(0, 2);
  }

  getHeroImageUrl(heroId) {
    const imagePath = this.heroImages[heroId];
    return imagePath ? `${this.imageBaseUrl}/${imagePath}` : null;
  }

  show() {
    this.container.classList.remove('hidden');
  }

  hide() {
    this.container.classList.add('hidden');
  }
}
