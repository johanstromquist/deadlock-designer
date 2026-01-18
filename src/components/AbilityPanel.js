// Ability Panel Component

import { calculateAbilityDamage } from '../utils/calculator.js';

export class AbilityPanel {
  constructor(container, onUpgradeChange) {
    this.container = container;
    this.onUpgradeChange = onUpgradeChange;
    this.hero = null;
    this.upgrades = {};
    this.spiritPower = 0;
  }

  setHero(hero) {
    this.hero = hero;
    // Initialize upgrades for each ability
    this.upgrades = {};
    hero.abilities.forEach(ability => {
      this.upgrades[ability.id] = 0;
    });
    this.render();
  }

  setSpiritPower(spiritPower) {
    this.spiritPower = spiritPower;
    this.updateDamageDisplays();
  }

  setUpgrades(upgrades) {
    this.upgrades = upgrades;
    this.render();
  }

  render() {
    if (!this.hero) {
      this.container.innerHTML = '<p>Select a hero to view abilities</p>';
      return;
    }

    this.container.innerHTML = this.hero.abilities.map((ability, index) => {
      const isUltimate = ability.type === 'ultimate' || ability.key === '4';
      const currentLevel = this.upgrades[ability.id] || 0;
      const damage = calculateAbilityDamage(ability, this.spiritPower, currentLevel);

      return `
        <div class="ability-card ${isUltimate ? 'ultimate' : ''}" data-ability-id="${ability.id}">
          <div class="ability-header">
            <span class="ability-name">[${ability.key}] ${ability.name}</span>
            <span class="ability-type">${ability.type}</span>
          </div>
          <div class="ability-description">${ability.description}</div>
          <div class="ability-stats">
            ${ability.cooldown ? `<span class="ability-stat">CD: <span class="ability-stat-value">${ability.cooldown}s</span></span>` : ''}
            ${damage ? `<span class="ability-stat">Damage: <span class="ability-stat-value damage-value">${damage.total}</span></span>` : ''}
            ${ability.duration ? `<span class="ability-stat">Duration: <span class="ability-stat-value">${ability.duration}s</span></span>` : ''}
            ${ability.range ? `<span class="ability-stat">Range: <span class="ability-stat-value">${ability.range}m</span></span>` : ''}
          </div>
          <div class="ability-upgrades">
            ${this.renderUpgradeButtons(ability, currentLevel)}
          </div>
        </div>
      `;
    }).join('');

    this.bindUpgradeEvents();
  }

  renderUpgradeButtons(ability, currentLevel) {
    const costs = [1, 2, 5];

    return ability.upgrades.map((upgrade, index) => {
      const cost = costs[index];
      const isActive = currentLevel > index;
      const tooltipText = upgrade.effect;

      return `
        <button class="upgrade-btn ${isActive ? 'active' : ''}"
                data-ability-id="${ability.id}"
                data-level="${index + 1}"
                title="${tooltipText}">
          <span class="points">${cost}pt</span>
          T${index + 1}
        </button>
      `;
    }).join('');
  }

  bindUpgradeEvents() {
    this.container.querySelectorAll('.upgrade-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const abilityId = btn.dataset.abilityId;
        const level = parseInt(btn.dataset.level);
        const currentLevel = this.upgrades[abilityId] || 0;
        const isActive = currentLevel >= level;

        // If clicking an active tier, deselect from that point (go to level - 1)
        // If clicking an inactive tier, select up to that level
        if (isActive) {
          this.upgrades[abilityId] = level - 1;
        } else {
          this.upgrades[abilityId] = level;
        }

        this.render();

        if (this.onUpgradeChange) {
          this.onUpgradeChange(this.upgrades);
        }
      });
    });
  }

  updateDamageDisplays() {
    if (!this.hero) return;

    this.hero.abilities.forEach(ability => {
      const card = this.container.querySelector(`[data-ability-id="${ability.id}"]`);
      if (!card) return;

      const damageEl = card.querySelector('.damage-value');
      if (damageEl) {
        const currentLevel = this.upgrades[ability.id] || 0;
        const damage = calculateAbilityDamage(ability, this.spiritPower, currentLevel);
        if (damage) {
          damageEl.textContent = damage.total;
        }
      }
    });
  }

  getUpgrades() {
    return { ...this.upgrades };
  }

  getTotalPointsUsed() {
    const costs = [1, 2, 5];
    let total = 0;

    Object.values(this.upgrades).forEach(level => {
      for (let i = 0; i < level; i++) {
        total += costs[i];
      }
    });

    return total;
  }
}
