// Item Shop Component

import { getItemImageUrl, getItemInitials } from '../utils/images.js';

export class ItemShop {
  constructor(container, onItemSelect) {
    this.container = container;
    this.onItemSelect = onItemSelect;
    this.items = { weapon: [], vitality: [], spirit: [] };
    this.allItems = [];
    this.filteredItems = [];
    this.selectedCategory = 'all';
    this.selectedTier = 'all';
    this.targetSlot = null;

    this.shopItems = document.getElementById('shop-items');
    this.closeBtn = document.getElementById('close-shop');

    this.bindEvents();
  }

  async loadItems() {
    try {
      const categories = ['weapon', 'vitality', 'spirit'];
      const itemPromises = categories.map(async (category) => {
        const response = await fetch(`/data/items/${category}.json`);
        const data = await response.json();
        return { category, items: data.items };
      });

      const results = await Promise.all(itemPromises);
      results.forEach(({ category, items }) => {
        this.items[category] = items.map(item => ({ ...item, category }));
      });

      this.allItems = [
        ...this.items.weapon,
        ...this.items.vitality,
        ...this.items.spirit
      ];

      this.filteredItems = [...this.allItems];
    } catch (error) {
      console.error('Failed to load items:', error);
    }
  }

  bindEvents() {
    // Close button
    this.closeBtn.addEventListener('click', () => this.hide());

    // Category tabs
    document.querySelectorAll('.category-tabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.category-tabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.selectedCategory = tab.dataset.category;
        this.filterItems();
      });
    });

    // Tier filters
    document.querySelectorAll('.tier-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tier-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedTier = btn.dataset.tier;
        this.filterItems();
      });
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (this.container.classList.contains('hidden')) return;
      if (!this.container.contains(e.target) && !e.target.closest('.item-slot')) {
        this.hide();
      }
    });
  }

  filterItems() {
    this.filteredItems = this.allItems.filter(item => {
      const matchesCategory = this.selectedCategory === 'all' || item.category === this.selectedCategory;
      const matchesTier = this.selectedTier === 'all' || item.tier === parseInt(this.selectedTier);
      return matchesCategory && matchesTier;
    });

    this.render();
  }

  render() {
    // Sort by tier, then by cost
    const sorted = [...this.filteredItems].sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return a.cost - b.cost;
    });

    const equippedIds = this.equippedItemIds || [];

    this.shopItems.innerHTML = sorted.map(item => {
      const isEquipped = equippedIds.includes(item.id);
      return `
        <div class="shop-item ${item.category}${isEquipped ? ' equipped' : ''}" data-item-id="${item.id}">
          <div class="item-icon-container">
            <img
              src="${getItemImageUrl(item.name)}"
              alt="${item.name}"
              class="item-icon"
              loading="lazy"
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            >
            <span class="item-icon-fallback" style="display:none;">${getItemInitials(item.name)}</span>
          </div>
          <div class="item-details">
            <div class="item-header">
              <span class="item-name">${item.name}</span>
              <span class="item-tier">T${item.tier}</span>
            </div>
            <div class="item-cost">${item.cost.toLocaleString()} souls</div>
            ${isEquipped ? '<div class="equipped-badge">Equipped</div>' : ''}
            <div class="item-stats">
              ${this.renderItemStats(item)}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Bind click events
    this.shopItems.querySelectorAll('.shop-item').forEach(itemEl => {
      itemEl.addEventListener('click', () => {
        const itemId = itemEl.dataset.itemId;
        const item = this.allItems.find(i => i.id === itemId);
        if (item && this.onItemSelect) {
          this.onItemSelect(item, this.targetSlot);
          this.hide();
        }
      });
    });
  }

  renderItemStats(item) {
    const stats = [];

    if (item.stats) {
      Object.entries(item.stats).forEach(([stat, value]) => {
        const formatted = this.formatStatValue(stat, value);
        stats.push(`<span>${formatted}</span>`);
      });
    }

    if (item.passive) {
      stats.push(`<span class="passive">${item.passive.description}</span>`);
    }

    if (item.active) {
      stats.push(`<span class="active">Active: ${item.active.description}</span>`);
    }

    return stats.join('');
  }

  formatStatValue(stat, value) {
    const statNames = {
      health: 'Health',
      healthRegen: 'Health Regen',
      bulletDamage: 'Bullet Damage',
      weaponDamage: 'Weapon Damage',
      fireRate: 'Fire Rate',
      clipSize: 'Ammo',
      reloadTime: 'Reload Time',
      bulletLifesteal: 'Bullet Lifesteal',
      spiritPower: 'Spirit Power',
      spiritLifesteal: 'Spirit Lifesteal',
      cooldownReduction: 'Cooldown',
      abilityRange: 'Ability Range',
      abilityDuration: 'Ability Duration',
      bulletResist: 'Bullet Resist',
      spiritResist: 'Spirit Resist',
      moveSpeed: 'Move Speed',
      sprintSpeed: 'Sprint Speed',
      stamina: 'Stamina',
      bulletVelocity: 'Bullet Velocity',
      abilityCharges: 'Ability Charges'
    };

    const percentStats = ['weaponDamage', 'fireRate', 'bulletLifesteal', 'spiritLifesteal',
      'cooldownReduction', 'abilityRange', 'abilityDuration', 'bulletResist', 'spiritResist',
      'bulletVelocity'];

    const name = statNames[stat] || stat;
    const sign = value > 0 ? '+' : '';

    if (percentStats.includes(stat)) {
      return `${sign}${Math.round(value * 100)}% ${name}`;
    }

    return `${sign}${value} ${name}`;
  }

  show(slotInfo, equippedItemIds = []) {
    this.targetSlot = slotInfo;
    this.equippedItemIds = equippedItemIds;

    // Universal slots - don't pre-select category, show all items
    this.selectedCategory = 'all';
    document.querySelectorAll('.category-tabs .tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.category === 'all');
    });

    this.filterItems();
    this.container.classList.remove('hidden');

    // Show overlay
    this.showOverlay();
  }

  hide() {
    this.container.classList.add('hidden');
    this.hideOverlay();
    this.targetSlot = null;
  }

  showOverlay() {
    if (!document.querySelector('.overlay')) {
      const overlay = document.createElement('div');
      overlay.className = 'overlay';
      overlay.addEventListener('click', () => this.hide());
      document.body.appendChild(overlay);
    }
  }

  hideOverlay() {
    const overlay = document.querySelector('.overlay');
    if (overlay) overlay.remove();
  }
}
