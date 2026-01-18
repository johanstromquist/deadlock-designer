#!/usr/bin/env node
/**
 * Deadlock Item Effects Auditor
 * Compares item passive/active effects against the official Deadlock API
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../public/data');
const API_BASE = 'https://assets.deadlock-api.com/v2';

// Effect property mapping: API property -> local property path
const EFFECT_MAPPING = {
  // Cooldowns and durations
  'AbilityCooldown': { local: ['passive.cooldown', 'active.cooldown'], label: 'Cooldown' },
  'AbilityDuration': { local: ['passive.duration', 'active.duration'], label: 'Duration' },
  'AbilityCastRange': { local: ['active.range', 'passive.range'], label: 'Range' },

  // Damage and healing
  'BonusMeleeDamage': { local: ['passive.meleeDamage'], label: 'Melee Damage' },
  'LifestrikeHeal': { local: ['passive.meleeHeal'], label: 'Melee Heal' },
  'HealOnHit': { local: ['passive.healAmount'], label: 'Heal Amount' },
  'SpiritDamage': { local: ['passive.spiritDamage'], label: 'Spirit Damage' },

  // Percentages
  'SlowPercent': { local: ['passive.slowPercent', 'active.slowPercent'], label: 'Slow %', transform: v => parseFloat(v) / 100 },
  'BonusFireRate': { local: ['passive.fireRateBonus', 'active.fireRateBonus'], label: 'Fire Rate Bonus', transform: v => parseFloat(v) / 100 },
  'HeadshotDamage': { local: ['passive.headshotBonus'], label: 'Headshot Bonus' },

  // Misc
  'Radius': { local: ['passive.radius', 'active.radius'], label: 'Radius', transform: v => parseFloat(v.replace('m', '')) },
  'SilenceDuration': { local: ['passive.silenceDuration', 'active.silenceDuration'], label: 'Silence Duration' },
};

class EffectAuditor {
  constructor() {
    this.apiItems = null;
    this.discrepancies = [];
  }

  async fetchApiData() {
    console.log('Fetching item data from Deadlock API...');
    const response = await fetch(`${API_BASE}/items`);
    const allItems = await response.json();
    this.apiItems = allItems.filter(item => item.shopable);
    console.log(`Fetched ${this.apiItems.length} shopable items\n`);
  }

  loadLocalData(category) {
    const filePath = path.join(DATA_DIR, 'items', `${category}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  normalizeItemName(name) {
    return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');
  }

  findApiItem(localItem, category) {
    const normalizedLocal = this.normalizeItemName(localItem.name);
    for (const apiItem of this.apiItems) {
      if (apiItem.item_slot_type !== category) continue;
      const normalizedApi = this.normalizeItemName(apiItem.name);
      if (normalizedApi === normalizedLocal) return apiItem;
    }
    return null;
  }

  getNestedValue(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  extractApiEffects(apiItem) {
    const effects = {};
    const props = apiItem.properties || {};

    // Extract key effect properties
    for (const [apiKey, val] of Object.entries(props)) {
      if (typeof val === 'object' && val.value) {
        const v = val.value;
        if (v && v !== '0' && v !== '-1') {
          effects[apiKey] = {
            value: v,
            label: val.label || apiKey
          };
        }
      }
    }

    // Add activation type
    effects._activation = apiItem.activation;
    effects._isActive = apiItem.is_active_item;

    return effects;
  }

  compareEffects(localItem, apiItem, category) {
    const issues = [];
    const apiEffects = this.extractApiEffects(apiItem);
    const localPassive = localItem.passive || {};
    const localActive = localItem.active || {};

    // Check if item type matches (active vs passive)
    const apiIsActive = apiEffects._isActive;
    const localIsActive = !!localItem.active;
    const localIsPassive = !!localItem.passive;

    if (apiIsActive && !localIsActive && localIsPassive) {
      issues.push({
        field: 'type',
        issue: 'API says ACTIVE item, local has only passive',
        api: 'active',
        local: 'passive'
      });
    }

    // Compare specific effect values
    const keyEffectProps = [
      { api: 'AbilityCooldown', local: 'cooldown', in: ['passive', 'active'] },
      { api: 'AbilityDuration', local: 'duration', in: ['passive', 'active'] },
      { api: 'LifestrikeHeal', local: 'meleeHeal', in: ['passive'] },
      { api: 'HealOnHit', local: 'healAmount', in: ['passive'] },
      { api: 'HeadshotDamage', local: 'headshotBonus', in: ['passive'] },
      { api: 'SlowPercent', local: 'slowPercent', in: ['passive', 'active'], transform: v => parseFloat(v) / 100 },
      { api: 'SilenceDuration', local: 'silenceDuration', in: ['passive', 'active'] },
      { api: 'Radius', local: 'radius', in: ['passive', 'active'], transform: v => parseFloat(String(v).replace('m', '')) },
    ];

    for (const prop of keyEffectProps) {
      const apiVal = apiEffects[prop.api]?.value;
      if (!apiVal) continue;

      let apiNum = prop.transform ? prop.transform(apiVal) : parseFloat(apiVal);

      // Check in passive and active
      let localVal = null;
      let foundIn = null;
      for (const section of prop.in) {
        const sectionData = section === 'passive' ? localPassive : localActive;
        if (sectionData && sectionData[prop.local] !== undefined) {
          localVal = sectionData[prop.local];
          foundIn = section;
          break;
        }
      }

      if (localVal === null) {
        // Check if this is an important property
        if (['AbilityCooldown', 'LifestrikeHeal', 'HeadshotDamage', 'SlowPercent'].includes(prop.api)) {
          issues.push({
            field: prop.local,
            issue: `Missing in local (API has ${prop.api})`,
            api: apiNum,
            local: '(missing)'
          });
        }
      } else if (Math.abs(localVal - apiNum) > 0.01) {
        issues.push({
          field: prop.local,
          issue: 'Value mismatch',
          api: apiNum,
          local: localVal
        });
      }
    }

    return issues;
  }

  async audit() {
    await this.fetchApiData();

    console.log('=== ITEM EFFECTS AUDIT ===\n');

    for (const category of ['weapon', 'vitality', 'spirit']) {
      const localData = this.loadLocalData(category);
      if (!localData) continue;

      console.log(`Processing ${category} items...`);

      for (const localItem of localData.items) {
        const apiItem = this.findApiItem(localItem, category);
        if (!apiItem) continue;

        const issues = this.compareEffects(localItem, apiItem, category);
        if (issues.length > 0) {
          this.discrepancies.push({
            category,
            item: localItem.name,
            issues
          });
        }
      }
    }

    this.printReport();
  }

  printReport() {
    console.log('\n' + '='.repeat(70));
    console.log('ITEM EFFECTS AUDIT REPORT');
    console.log('='.repeat(70) + '\n');

    if (this.discrepancies.length === 0) {
      console.log('✅ No effect discrepancies found!');
      return;
    }

    const totalIssues = this.discrepancies.reduce((sum, d) => sum + d.issues.length, 0);
    console.log(`Found ${totalIssues} effect discrepancies across ${this.discrepancies.length} items:\n`);

    // Group by category
    const byCategory = {};
    for (const d of this.discrepancies) {
      if (!byCategory[d.category]) byCategory[d.category] = [];
      byCategory[d.category].push(d);
    }

    for (const [category, items] of Object.entries(byCategory)) {
      console.log(`\n📦 ${category.toUpperCase()}`);
      console.log('='.repeat(40));

      for (const item of items) {
        console.log(`\n  ${item.item}:`);
        for (const issue of item.issues) {
          console.log(`    ${issue.field}: ${issue.local} → ${issue.api} (${issue.issue})`);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    console.log(`  Items with issues: ${this.discrepancies.length}`);
    console.log(`  Total issues:      ${totalIssues}`);
  }
}

const auditor = new EffectAuditor();
auditor.audit();
