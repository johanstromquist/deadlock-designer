// Stats Panel Component

import { formatStat } from '../utils/calculator.js';

export class StatPanel {
  constructor(container) {
    this.container = container;
    this.stats = null;
    this.baseStats = null;
  }

  setStats(stats, baseStats) {
    this.stats = stats;
    this.baseStats = baseStats;
    this.render();
  }

  render() {
    if (!this.stats) {
      this.container.innerHTML = '<p>Select a hero to view stats</p>';
      return;
    }

    const groups = [
      {
        title: 'Combat',
        stats: [
          { key: 'effectiveBulletDamage', name: 'Bullet Damage', format: 'number' },
          { key: 'dps', name: 'DPS', format: 'number' },
          { key: 'fireRate', name: 'Fire Rate', format: 'perSecond' },
          { key: 'clipSize', name: 'Ammo', format: 'number' },
          { key: 'reloadTime', name: 'Reload', format: 'seconds' }
        ]
      },
      {
        title: 'Survivability',
        stats: [
          { key: 'health', name: 'Health', format: 'number' },
          { key: 'healthRegen', name: 'HP Regen', format: 'perSecond' },
          { key: 'bulletResist', name: 'Bullet Resist', format: 'percent' },
          { key: 'spiritResist', name: 'Spirit Resist', format: 'percent' },
          { key: 'effectiveHealth', name: 'Effective HP (Bullet)', format: 'number' }
        ]
      },
      {
        title: 'Spirit',
        stats: [
          { key: 'spiritPower', name: 'Spirit Power', format: 'number' },
          { key: 'cooldownReduction', name: 'Cooldown Reduction', format: 'percent' },
          { key: 'spiritLifesteal', name: 'Spirit Lifesteal', format: 'percent' },
          { key: 'abilityRange', name: 'Ability Range', format: 'percent' }
        ]
      },
      {
        title: 'Mobility',
        stats: [
          { key: 'moveSpeed', name: 'Move Speed', format: 'mps' },
          { key: 'sprintSpeed', name: 'Sprint', format: 'mps' },
          { key: 'stamina', name: 'Stamina', format: 'number' }
        ]
      },
      {
        title: 'Lifesteal',
        stats: [
          { key: 'bulletLifesteal', name: 'Bullet Lifesteal', format: 'percent' }
        ]
      }
    ];

    this.container.innerHTML = `
      ${groups.map(group => `
        <div class="stat-group">
          <div class="stat-group-title">${group.title}</div>
          ${group.stats.map(stat => this.renderStatRow(stat)).join('')}
        </div>
      `).join('')}

      <div class="stat-group">
        <div class="stat-group-title">Investment Bonuses</div>
        ${this.renderInvestmentBonuses()}
      </div>

      <div class="stat-group">
        <div class="stat-group-title">Summary</div>
        <div class="stat-row">
          <span class="stat-name">Total Souls</span>
          <span class="stat-value">${this.stats.totalSouls || 0}</span>
        </div>
      </div>
    `;
  }

  renderStatRow(stat) {
    const value = this.stats[stat.key] || 0;
    const baseValue = this.baseStats ? (this.baseStats[stat.key] || 0) : value;
    const formatted = formatStat(value, stat.format);

    let valueClass = 'stat-value';
    let bonusText = '';

    // Compare to base for certain stats
    if (this.baseStats && stat.key !== 'effectiveBulletDamage' && stat.key !== 'dps' && stat.key !== 'effectiveHealth') {
      if (value > baseValue) {
        valueClass += ' increased';
        const diff = value - baseValue;
        if (stat.format === 'percent') {
          bonusText = `(+${Math.round(diff * 100)}%)`;
        } else if (stat.format === 'number') {
          bonusText = `(+${Math.round(diff)})`;
        }
      } else if (value < baseValue) {
        valueClass += ' decreased';
      }
    }

    return `
      <div class="stat-row">
        <span class="stat-name">${stat.name}</span>
        <span class="${valueClass}">${formatted} ${bonusText ? `<span class="stat-bonus">${bonusText}</span>` : ''}</span>
      </div>
    `;
  }

  renderInvestmentBonuses() {
    if (!this.stats.investmentBonuses) {
      return '<div class="stat-row"><span class="stat-name">No bonuses yet</span></div>';
    }

    const bonuses = [];

    if (this.stats.investmentBonuses.weapon?.weaponDamage) {
      bonuses.push(`
        <div class="stat-row">
          <span class="stat-name">Weapon Track</span>
          <span class="stat-value increased">+${Math.round(this.stats.investmentBonuses.weapon.weaponDamage * 100)}% Damage</span>
        </div>
      `);
    }

    if (this.stats.investmentBonuses.vitality?.health) {
      bonuses.push(`
        <div class="stat-row">
          <span class="stat-name">Vitality Track</span>
          <span class="stat-value increased">+${this.stats.investmentBonuses.vitality.health} Health</span>
        </div>
      `);
    }

    if (this.stats.investmentBonuses.spirit?.spiritPower) {
      bonuses.push(`
        <div class="stat-row">
          <span class="stat-name">Spirit Track</span>
          <span class="stat-value increased">+${this.stats.investmentBonuses.spirit.spiritPower} Spirit</span>
        </div>
      `);
    }

    return bonuses.length > 0 ? bonuses.join('') : '<div class="stat-row"><span class="stat-name">No bonuses yet</span></div>';
  }
}
