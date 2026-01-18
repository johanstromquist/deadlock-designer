// Deadlock Character Designer - Main Entry Point

import { HeroSelect } from './components/HeroSelect.js';
import { ItemShop } from './components/ItemShop.js';
import { AbilityPanel } from './components/AbilityPanel.js';
import { StatPanel } from './components/StatPanel.js';
import { HeroBuild } from './components/HeroBuild.js';
import { calculateStats } from './utils/calculator.js';
import {
  saveCurrentBuild,
  loadCurrentBuild,
  encodeBuildToURL,
  copyToClipboard,
  decodeBuildFromURL,
  saveHeroBuild,
  loadHeroBuild
} from './utils/storage.js';

class DeadlockDesigner {
  constructor() {
    this.currentHero = null;
    this.abilityUpgrades = {};

    // DOM elements
    this.heroSelectPanel = document.getElementById('hero-select');
    this.buildPanel = document.getElementById('build-panel');
    this.buildActions = document.getElementById('build-actions');

    // Initialize components
    this.heroSelect = new HeroSelect(this.heroSelectPanel, (hero) => this.onHeroSelected(hero));
    this.itemShop = new ItemShop(document.getElementById('item-shop'), (item, slot) => this.onItemSelected(item, slot));
    this.abilityPanel = new AbilityPanel(document.getElementById('abilities-grid'), (upgrades) => this.onUpgradesChanged(upgrades));
    this.statPanel = new StatPanel(document.getElementById('stats-panel'));
    this.heroBuild = new HeroBuild({
      onSlotClick: (slotInfo) => this.onSlotClicked(slotInfo),
      onItemRemove: () => this.recalculateStats(),
      onStatsChange: () => this.recalculateStats()
    });

    // Bind navigation
    document.getElementById('back-to-heroes').addEventListener('click', () => this.showHeroSelect());
    document.getElementById('save-build').addEventListener('click', () => this.saveBuild());
    document.getElementById('share-build').addEventListener('click', () => this.shareBuild());
    document.getElementById('reset-build').addEventListener('click', () => this.resetBuild());

    // Initialize
    this.init();
  }

  async init() {
    // Load data
    await Promise.all([
      this.heroSelect.loadHeroes(),
      this.itemShop.loadItems()
    ]);

    // Check for build in URL
    const urlBuild = decodeBuildFromURL();
    if (urlBuild) {
      this.loadBuildFromData(urlBuild);
    } else {
      // Check for saved build
      const savedBuild = loadCurrentBuild();
      if (savedBuild) {
        this.loadBuildFromData(savedBuild);
      }
    }
  }

  onHeroSelected(hero) {
    this.currentHero = hero;

    // Update header
    document.getElementById('selected-hero-name').textContent = hero.name;
    document.getElementById('selected-hero-tags').innerHTML = hero.tags
      .map(tag => `<span class="hero-tag">${tag}</span>`)
      .join('');

    // Update hero portrait
    const portraitContainer = document.getElementById('hero-portrait-large');
    const fallback = document.getElementById('portrait-fallback');
    const imageUrl = this.heroSelect.getHeroImageUrl(hero.id);
    const initials = hero.name.split(/[\s&]+/).map(word => word[0]).join('').toUpperCase().slice(0, 2);

    if (imageUrl) {
      portraitContainer.innerHTML = `
        <img src="${imageUrl}" alt="${hero.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <span class="portrait-fallback" style="display:none;">${initials}</span>
      `;
    } else {
      portraitContainer.innerHTML = `<span class="portrait-fallback">${initials}</span>`;
    }

    // Load saved build for this hero, or reset if none exists
    const savedBuild = loadHeroBuild(hero.id);
    if (savedBuild && savedBuild.slots) {
      this.heroBuild.reset();
      this.heroBuild.loadBuild({ slots: savedBuild.slots });
      if (savedBuild.upgrades) {
        this.abilityUpgrades = savedBuild.upgrades;
      }
    } else {
      this.heroBuild.reset();
    }

    // Set up ability panel
    this.abilityPanel.setHero(hero);
    if (savedBuild && savedBuild.upgrades) {
      this.abilityPanel.setUpgrades(savedBuild.upgrades);
    }
    this.abilityUpgrades = this.abilityPanel.getUpgrades();

    // Calculate initial stats
    this.recalculateStats();

    // Show build panel
    this.showBuildPanel();
  }

  onItemSelected(item, slotInfo) {
    if (!slotInfo) return;

    // Universal slots - any item can go in any slot
    const result = this.heroBuild.setItem(slotInfo.index, item);

    if (result === false) {
      // Slot is locked
      return;
    }

    if (result.success) {
      this.recalculateStats();
      this.autoSave();
    } else if (result.reason === 'duplicate') {
      this.showToast(`${item.name} is already equipped!`);
    }
  }

  onSlotClicked(slotInfo) {
    const equippedIds = this.heroBuild.getEquippedItemIds();
    this.itemShop.show(slotInfo, equippedIds);
  }

  onUpgradesChanged(upgrades) {
    this.abilityUpgrades = upgrades;
    this.recalculateStats();
    this.autoSave();
  }

  recalculateStats() {
    if (!this.currentHero) return;

    const items = this.heroBuild.getAllItems().filter(item => item !== null);
    const stats = calculateStats(this.currentHero, items, this.abilityUpgrades);

    // Update stat panel
    this.statPanel.setStats(stats, this.currentHero.baseStats);

    // Update ability panel with new spirit power
    this.abilityPanel.setSpiritPower(stats.spiritPower);
  }

  showHeroSelect() {
    this.buildPanel.classList.add('hidden');
    this.buildActions.classList.add('hidden');
    this.heroSelectPanel.classList.remove('hidden');
  }

  showBuildPanel() {
    this.heroSelectPanel.classList.add('hidden');
    this.buildPanel.classList.remove('hidden');
    this.buildActions.classList.remove('hidden');
  }

  saveBuild() {
    if (!this.currentHero) return;

    const buildData = this.getBuildData();
    saveCurrentBuild(buildData);
    this.showToast('Build saved!');
  }

  shareBuild() {
    if (!this.currentHero) return;

    const buildData = this.getBuildData();
    const url = encodeBuildToURL(buildData);
    copyToClipboard(url);
  }

  resetBuild() {
    this.heroBuild.reset();
    this.abilityPanel.setHero(this.currentHero);
    this.abilityUpgrades = this.abilityPanel.getUpgrades();
    this.recalculateStats();
    this.autoSave();
    this.showToast(`${this.currentHero.name} build reset`);
  }

  autoSave() {
    if (!this.currentHero) return;
    const buildData = this.getBuildData();
    // Save per-hero
    saveHeroBuild(this.currentHero.id, buildData);
    // Also save as current build for URL sharing
    saveCurrentBuild(buildData);
  }

  getBuildData() {
    return {
      heroId: this.currentHero?.id,
      slots: this.heroBuild.getBuildData().slots,
      upgrades: this.abilityUpgrades,
      timestamp: Date.now()
    };
  }

  async loadBuildFromData(buildData) {
    if (!buildData.heroId) return;

    // Load hero
    try {
      const base = import.meta.env.BASE_URL;
      const response = await fetch(`${base}data/heroes/${buildData.heroId}.json`);
      const hero = await response.json();
      this.onHeroSelected(hero);

      // Load items
      if (buildData.slots) {
        this.heroBuild.loadBuild({ slots: buildData.slots });
      }

      // Load upgrades
      if (buildData.upgrades) {
        this.abilityUpgrades = buildData.upgrades;
        this.abilityPanel.setUpgrades(buildData.upgrades);
      }

      this.recalculateStats();
    } catch (error) {
      console.error('Failed to load build:', error);
    }
  }

  showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  window.app = new DeadlockDesigner();
});
