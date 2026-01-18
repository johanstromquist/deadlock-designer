// Stat calculation formulas for Deadlock

export function calculateStats(hero, items, abilityUpgrades) {
  // Start with base stats
  const stats = { ...hero.baseStats };

  // Initialize derived stats
  stats.weaponDamage = 0;
  stats.spiritPower = 0;
  stats.bulletLifesteal = 0;
  stats.spiritLifesteal = 0;
  stats.bulletResist = 0;
  stats.spiritResist = 0;
  stats.cooldownReduction = 0;
  stats.abilityRange = 0;
  stats.abilityDuration = 0;
  stats.stamina = stats.stamina || 3;

  // Calculate investment track bonuses
  const investmentTotals = {
    weapon: 0,
    vitality: 0,
    spirit: 0
  };

  // Apply item stats
  items.forEach(item => {
    if (!item) return;

    // Track investment
    if (item.category) {
      investmentTotals[item.category] = (investmentTotals[item.category] || 0) + item.cost;
    }

    // Apply item stats
    if (item.stats) {
      Object.entries(item.stats).forEach(([stat, value]) => {
        if (stat === 'health' || stat === 'clipSize') {
          stats[stat] = (stats[stat] || 0) + value;
        } else if (stat === 'healthRegen' || stat === 'sprintSpeed' || stat === 'stamina') {
          stats[stat] = (stats[stat] || 0) + value;
        } else {
          // Percentage-based stats
          stats[stat] = (stats[stat] || 0) + value;
        }
      });
    }
  });

  // Apply investment track bonuses
  stats.investmentBonuses = calculateInvestmentBonuses(investmentTotals);

  // Apply investment bonuses to stats
  if (stats.investmentBonuses.weapon) {
    stats.weaponDamage += stats.investmentBonuses.weapon.weaponDamage || 0;
  }
  if (stats.investmentBonuses.vitality) {
    stats.health += stats.investmentBonuses.vitality.health || 0;
  }
  if (stats.investmentBonuses.spirit) {
    stats.spiritPower += stats.investmentBonuses.spirit.spiritPower || 0;
  }

  // Calculate derived stats
  stats.effectiveBulletDamage = stats.bulletDamage * (1 + stats.weaponDamage);
  stats.dps = stats.effectiveBulletDamage * stats.fireRate;
  stats.burstDamage = stats.effectiveBulletDamage * stats.clipSize;
  stats.effectiveHealth = calculateEffectiveHealth(stats.health, stats.bulletResist);
  stats.effectiveHealthSpirit = calculateEffectiveHealth(stats.health, stats.spiritResist);

  // Calculate total souls spent
  stats.totalSouls = items.reduce((sum, item) => sum + (item?.cost || 0), 0);

  return stats;
}

function calculateInvestmentBonuses(totals) {
  const bonuses = {
    weapon: { weaponDamage: 0 },
    vitality: { health: 0 },
    spirit: { spiritPower: 0 }
  };

  // Investment track thresholds based on actual tier costs: 800/1600/3200/6400
  // Tier 1 threshold: ~800
  // Tier 2 threshold: ~2400 (800 + 1600)
  // Tier 3 threshold: ~5600 (800 + 1600 + 3200)
  // Tier 4 threshold: ~12000 (800 + 1600 + 3200 + 6400)

  // Weapon investment track
  if (totals.weapon >= 12000) bonuses.weapon.weaponDamage = 0.28;
  else if (totals.weapon >= 5600) bonuses.weapon.weaponDamage = 0.18;
  else if (totals.weapon >= 2400) bonuses.weapon.weaponDamage = 0.10;
  else if (totals.weapon >= 800) bonuses.weapon.weaponDamage = 0.04;

  // Vitality investment track
  if (totals.vitality >= 12000) bonuses.vitality.health = 375;
  else if (totals.vitality >= 5600) bonuses.vitality.health = 225;
  else if (totals.vitality >= 2400) bonuses.vitality.health = 125;
  else if (totals.vitality >= 800) bonuses.vitality.health = 50;

  // Spirit investment track
  if (totals.spirit >= 12000) bonuses.spirit.spiritPower = 40;
  else if (totals.spirit >= 5600) bonuses.spirit.spiritPower = 24;
  else if (totals.spirit >= 2400) bonuses.spirit.spiritPower = 12;
  else if (totals.spirit >= 800) bonuses.spirit.spiritPower = 4;

  return bonuses;
}

function calculateEffectiveHealth(health, resist) {
  if (resist >= 1) return Infinity;
  return health / (1 - resist);
}

export function calculateAbilityDamage(ability, spiritPower, upgradeLevel = 0) {
  if (!ability.baseDamage) return null;

  const baseDamage = ability.baseDamage;
  const coefficient = ability.spiritCoefficient || 0;
  const spiritBonus = spiritPower * coefficient;

  // Apply upgrade bonuses (simplified - would need full upgrade data)
  let upgradeDamageBonus = 0;
  if (upgradeLevel >= 1 && ability.upgrades[0]) {
    const match = ability.upgrades[0].effect.match(/\+(\d+)\s*(?:Damage|DPS)/i);
    if (match) upgradeDamageBonus += parseInt(match[1]);
  }
  if (upgradeLevel >= 2 && ability.upgrades[1]) {
    const match = ability.upgrades[1].effect.match(/\+(\d+)\s*(?:Damage|DPS)/i);
    if (match) upgradeDamageBonus += parseInt(match[1]);
  }
  if (upgradeLevel >= 3 && ability.upgrades[2]) {
    const match = ability.upgrades[2].effect.match(/\+(\d+)\s*(?:Damage|DPS)/i);
    if (match) upgradeDamageBonus += parseInt(match[1]);
  }

  return {
    base: baseDamage,
    spiritBonus: Math.round(spiritBonus),
    upgradeBonus: upgradeDamageBonus,
    total: Math.round(baseDamage + spiritBonus + upgradeDamageBonus)
  };
}

export function calculateAbilityPointsUsed(abilityUpgrades) {
  let total = 0;
  const costs = [1, 2, 5];

  Object.values(abilityUpgrades).forEach(level => {
    for (let i = 0; i < level && i < costs.length; i++) {
      total += costs[i];
    }
  });

  return total;
}

export function getAbilityPointsAvailable(totalSouls) {
  // Ability points earned at soul milestones
  const milestones = [
    { souls: 0, points: 1 },
    { souls: 1000, points: 2 },
    { souls: 2500, points: 3 },
    { souls: 4000, points: 4 },
    { souls: 6000, points: 5 },
    { souls: 8000, points: 6 },
    { souls: 10000, points: 7 },
    { souls: 13000, points: 8 },
    { souls: 16000, points: 9 },
    { souls: 20000, points: 10 },
    { souls: 25000, points: 11 },
    { souls: 30000, points: 12 }
  ];

  let points = 0;
  for (const milestone of milestones) {
    if (totalSouls >= milestone.souls) {
      points = milestone.points;
    } else {
      break;
    }
  }

  return points;
}

export function formatStat(value, format) {
  switch (format) {
    case 'percent':
      return `${Math.round(value * 100)}%`;
    case 'perSecond':
      return `${value.toFixed(1)}/s`;
    case 'seconds':
      return `${value.toFixed(1)}s`;
    case 'mps':
      return `${value.toFixed(1)} m/s`;
    default:
      return Math.round(value).toString();
  }
}
