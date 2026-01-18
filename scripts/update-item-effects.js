#!/usr/bin/env node
/**
 * Deadlock Item Effects Updater
 * Updates item passive/active effects from the official Deadlock API
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../public/data');
const API_BASE = 'https://assets.deadlock-api.com/v2';

class EffectUpdater {
  constructor(dryRun = true) {
    this.dryRun = dryRun;
    this.apiItems = null;
    this.updates = [];
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

  saveLocalData(category, data) {
    const filePath = path.join(DATA_DIR, 'items', `${category}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
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

  getApiPropValue(apiItem, propName, transform = null) {
    const props = apiItem.properties || {};
    const prop = props[propName];
    if (!prop || !prop.value || prop.value === '0' || prop.value === '-1') {
      return null;
    }
    let val = prop.value;
    if (transform) return transform(val);
    // Auto-detect numbers
    if (typeof val === 'string') {
      val = val.replace('m', '').replace('s', '').replace('%', '');
      const num = parseFloat(val);
      if (!isNaN(num)) return num;
    }
    return val;
  }

  updateItemEffects(localItem, apiItem) {
    const changes = [];
    const isApiActive = apiItem.is_active_item;

    // Get API values
    const apiCooldown = this.getApiPropValue(apiItem, 'AbilityCooldown');
    const apiDuration = this.getApiPropValue(apiItem, 'AbilityDuration');
    const apiSlowPercent = this.getApiPropValue(apiItem, 'SlowPercent', v => parseFloat(v) / 100);
    const apiRadius = this.getApiPropValue(apiItem, 'Radius', v => parseFloat(String(v).replace('m', '')));
    const apiActiveRadius = this.getApiPropValue(apiItem, 'ActiveRadius', v => parseFloat(String(v).replace('m', '')));
    const apiSilenceDuration = this.getApiPropValue(apiItem, 'SilenceDuration');
    const apiMeleeHeal = this.getApiPropValue(apiItem, 'LifestrikeHeal');
    const apiHeadshotBonus = this.getApiPropValue(apiItem, 'HeadshotDamage');
    const apiCastRange = this.getApiPropValue(apiItem, 'AbilityCastRange', v => parseFloat(String(v).replace('m', '')));

    // Determine if we need to convert passive to active
    if (isApiActive && localItem.passive && !localItem.active) {
      // Convert passive to active
      changes.push({ field: 'type', old: 'passive', new: 'active' });
      localItem.active = { ...localItem.passive };
      delete localItem.passive;
    }

    // Get target section (active or passive)
    const target = localItem.active || localItem.passive || {};
    const targetKey = localItem.active ? 'active' : 'passive';

    // Update cooldown
    if (apiCooldown !== null) {
      if (target.cooldown !== apiCooldown) {
        changes.push({ field: 'cooldown', old: target.cooldown, new: apiCooldown });
        target.cooldown = apiCooldown;
      }
    }

    // Update duration
    if (apiDuration !== null && apiDuration > 0) {
      if (target.duration !== apiDuration) {
        changes.push({ field: 'duration', old: target.duration, new: apiDuration });
        target.duration = apiDuration;
      }
    }

    // Update slow percent
    if (apiSlowPercent !== null && apiSlowPercent > 0) {
      if (target.slowPercent !== apiSlowPercent) {
        changes.push({ field: 'slowPercent', old: target.slowPercent, new: apiSlowPercent });
        target.slowPercent = apiSlowPercent;
      }
    }

    // Update radius
    const effectiveRadius = apiActiveRadius || apiRadius;
    if (effectiveRadius !== null && effectiveRadius > 0) {
      if (target.radius !== effectiveRadius) {
        changes.push({ field: 'radius', old: target.radius, new: effectiveRadius });
        target.radius = effectiveRadius;
      }
    }

    // Update silence duration
    if (apiSilenceDuration !== null) {
      if (target.silenceDuration !== apiSilenceDuration) {
        changes.push({ field: 'silenceDuration', old: target.silenceDuration, new: apiSilenceDuration });
        target.silenceDuration = apiSilenceDuration;
      }
    }

    // Update melee heal
    if (apiMeleeHeal !== null) {
      if (target.meleeHeal !== apiMeleeHeal) {
        changes.push({ field: 'meleeHeal', old: target.meleeHeal, new: apiMeleeHeal });
        target.meleeHeal = apiMeleeHeal;
      }
    }

    // Update headshot bonus
    if (apiHeadshotBonus !== null) {
      if (target.headshotBonus !== apiHeadshotBonus) {
        changes.push({ field: 'headshotBonus', old: target.headshotBonus, new: apiHeadshotBonus });
        target.headshotBonus = apiHeadshotBonus;
      }
    }

    // Update cast range
    if (apiCastRange !== null && apiCastRange > 0) {
      if (target.range !== apiCastRange) {
        changes.push({ field: 'range', old: target.range, new: apiCastRange });
        target.range = apiCastRange;
      }
    }

    // Re-assign the target back
    if (localItem.active) {
      localItem.active = target;
    } else if (localItem.passive) {
      localItem.passive = target;
    }

    return changes;
  }

  async update() {
    await this.fetchApiData();

    console.log(this.dryRun ? '=== DRY RUN ===' : '=== UPDATING FILES ===');
    console.log('');

    for (const category of ['weapon', 'vitality', 'spirit']) {
      const localData = this.loadLocalData(category);
      if (!localData) continue;

      let categoryChanges = [];

      for (const localItem of localData.items) {
        const apiItem = this.findApiItem(localItem, category);
        if (!apiItem) continue;

        const changes = this.updateItemEffects(localItem, apiItem);
        if (changes.length > 0) {
          categoryChanges.push({ item: localItem.name, changes });
        }
      }

      if (categoryChanges.length > 0) {
        this.updates.push({ category, items: categoryChanges });

        if (!this.dryRun) {
          this.saveLocalData(category, localData);
        }
      }
    }

    this.printReport();
  }

  printReport() {
    console.log('\n' + '='.repeat(70));
    console.log('ITEM EFFECTS UPDATE REPORT');
    console.log('='.repeat(70) + '\n');

    if (this.updates.length === 0) {
      console.log('✅ All item effects are already up to date!');
      return;
    }

    const totalChanges = this.updates.reduce((sum, u) =>
      sum + u.items.reduce((s, i) => s + i.changes.length, 0), 0);

    console.log(`Updated ${totalChanges} effect values:\n`);

    for (const categoryUpdate of this.updates) {
      console.log(`\n📦 ${categoryUpdate.category.toUpperCase()}`);
      console.log('='.repeat(40));

      for (const itemUpdate of categoryUpdate.items) {
        console.log(`\n  ${itemUpdate.item}:`);
        for (const change of itemUpdate.changes) {
          const oldVal = change.old === undefined ? '(missing)' : change.old;
          console.log(`    ${change.field}: ${oldVal} → ${change.new}`);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    console.log(`  Categories updated: ${this.updates.length}`);
    console.log(`  Items updated:      ${this.updates.reduce((s, u) => s + u.items.length, 0)}`);
    console.log(`  Total changes:      ${totalChanges}`);

    if (this.dryRun) {
      console.log('\n⚠️  DRY RUN: No files were modified.');
      console.log('   Run with --apply to make changes.');
    } else {
      console.log('\n✅ Files have been updated.');
    }
  }
}

// Parse args
const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');

if (dryRun) {
  console.log('Running in DRY RUN mode. Use --apply to make changes.\n');
}

const updater = new EffectUpdater(dryRun);
updater.update();
