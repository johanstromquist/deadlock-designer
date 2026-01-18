#!/usr/bin/env node
/**
 * Deadlock Item Data Auditor & Updater
 * Compares and syncs local item JSON data against the official Deadlock API
 * Source: https://assets.deadlock-api.com/v2/items
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../public/data');
const API_BASE = 'https://assets.deadlock-api.com/v2';

// Category mapping
const CATEGORY_MAP = {
  'weapon': 'weapon',
  'vitality': 'vitality',
  'spirit': 'spirit'
};

// Stat property mapping: API property -> local stat key
const STAT_MAPPING = {
  'BonusClipSizePercent': { key: 'clipSize', transform: v => parseInt(v) },
  'BaseAttackDamagePercent': { key: 'weaponDamage', transform: v => parseInt(v) / 100 },
  'WeaponPower': { key: 'weaponDamage', transform: v => parseInt(v) / 100 },
  'TechPower': { key: 'spiritPower', transform: v => parseInt(v) },
  'BonusHealth': { key: 'health', transform: v => parseInt(v) },
  'BonusHealthRegen': { key: 'healthRegen', transform: v => parseFloat(v) },
  'BonusFireRate': { key: 'fireRate', transform: v => parseInt(v) / 100 },
  'BulletResistReduction': { key: 'bulletResist', transform: v => parseInt(v) / 100 },
  'TechResistReduction': { key: 'spiritResist', transform: v => parseInt(v) / 100 },
  'BonusMoveSpeed': { key: 'moveSpeed', transform: v => parseFloat(v) },
  'StaminaBonus': { key: 'stamina', transform: v => parseInt(v) },
  'BonusBulletSpeedPercent': { key: 'bulletVelocity', transform: v => parseInt(v) / 100 },
  'TechRangePercent': { key: 'abilityRange', transform: v => parseInt(v) / 100 },
  'AbilityCharges': { key: 'abilityCharges', transform: v => parseInt(v) }
};

class ItemAuditor {
  constructor(options = {}) {
    this.updateMode = options.update || false;
    this.dryRun = options.dryRun !== false;
    this.apiItems = null;
    this.discrepancies = [];
    this.updates = [];
  }

  async fetchApiData() {
    console.log('Fetching item data from Deadlock API...');

    try {
      const response = await fetch(`${API_BASE}/items`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      const allItems = await response.json();

      // Filter to shopable items only
      this.apiItems = allItems.filter(item => item.shopable);
      console.log(`Fetched ${this.apiItems.length} shopable items from API\n`);
    } catch (error) {
      console.error('Failed to fetch API data:', error.message);
      process.exit(1);
    }
  }

  loadLocalData(category) {
    const filePath = path.join(DATA_DIR, 'items', `${category}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  normalizeItemName(name) {
    // Normalize for matching: lowercase, remove special chars
    return name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_');
  }

  findApiItem(localItem, category) {
    const normalizedLocal = this.normalizeItemName(localItem.name);

    for (const apiItem of this.apiItems) {
      if (apiItem.item_slot_type !== category) continue;

      const normalizedApi = this.normalizeItemName(apiItem.name);
      if (normalizedApi === normalizedLocal) {
        return apiItem;
      }
    }
    return null;
  }

  extractApiStats(apiItem) {
    const stats = {};
    const props = apiItem.properties || {};

    for (const [apiKey, mapping] of Object.entries(STAT_MAPPING)) {
      const prop = props[apiKey];
      if (prop && prop.value && prop.value !== '0' && prop.value !== '-1') {
        stats[mapping.key] = mapping.transform(prop.value);
      }
    }

    return stats;
  }

  compareItem(localItem, apiItem, category) {
    const issues = [];

    // Compare cost
    if (apiItem.cost !== undefined && localItem.cost !== apiItem.cost) {
      issues.push({
        field: 'cost',
        local: localItem.cost,
        api: apiItem.cost
      });
    }

    // Compare tier
    if (apiItem.item_tier !== undefined && localItem.tier !== apiItem.item_tier) {
      issues.push({
        field: 'tier',
        local: localItem.tier,
        api: apiItem.item_tier
      });
    }

    // Compare stats (only the ones we can map)
    const apiStats = this.extractApiStats(apiItem);
    const localStats = localItem.stats || {};

    for (const [key, apiValue] of Object.entries(apiStats)) {
      const localValue = localStats[key];
      if (localValue === undefined) {
        issues.push({
          field: `stats.${key}`,
          local: '(missing)',
          api: apiValue
        });
      } else if (Math.abs(localValue - apiValue) > 0.001) {
        issues.push({
          field: `stats.${key}`,
          local: localValue,
          api: apiValue
        });
      }
    }

    return issues;
  }

  updateItem(localItem, apiItem) {
    const changes = [];

    // Update cost
    if (apiItem.cost !== undefined && localItem.cost !== apiItem.cost) {
      changes.push({ field: 'cost', old: localItem.cost, new: apiItem.cost });
      localItem.cost = apiItem.cost;
    }

    // Update tier
    if (apiItem.item_tier !== undefined && localItem.tier !== apiItem.item_tier) {
      changes.push({ field: 'tier', old: localItem.tier, new: apiItem.item_tier });
      localItem.tier = apiItem.item_tier;
    }

    // Update stats
    const apiStats = this.extractApiStats(apiItem);
    if (!localItem.stats) localItem.stats = {};

    for (const [key, apiValue] of Object.entries(apiStats)) {
      const localValue = localItem.stats[key];
      if (localValue === undefined || Math.abs(localValue - apiValue) > 0.001) {
        changes.push({
          field: `stats.${key}`,
          old: localValue === undefined ? '(missing)' : localValue,
          new: apiValue
        });
        localItem.stats[key] = apiValue;
      }
    }

    return changes;
  }

  async audit() {
    await this.fetchApiData();

    console.log(this.updateMode
      ? (this.dryRun ? '=== UPDATE DRY RUN ===' : '=== UPDATING FILES ===')
      : '=== AUDIT MODE ===');
    console.log('');

    for (const category of Object.keys(CATEGORY_MAP)) {
      const localData = this.loadLocalData(category);
      if (!localData) {
        console.log(`⚠️  No local data for category: ${category}`);
        continue;
      }

      console.log(`\nProcessing ${category} items (${localData.items.length} items)...`);

      let categoryUpdates = [];

      for (const localItem of localData.items) {
        const apiItem = this.findApiItem(localItem, category);

        if (!apiItem) {
          this.discrepancies.push({
            category,
            item: localItem.name,
            type: 'not_found',
            message: 'Item not found in API'
          });
          continue;
        }

        if (this.updateMode) {
          const changes = this.updateItem(localItem, apiItem);
          if (changes.length > 0) {
            categoryUpdates.push({ item: localItem.name, changes });
          }
        } else {
          const issues = this.compareItem(localItem, apiItem, category);
          if (issues.length > 0) {
            this.discrepancies.push({
              category,
              item: localItem.name,
              issues
            });
          }
        }
      }

      if (this.updateMode && categoryUpdates.length > 0) {
        this.updates.push({ category, items: categoryUpdates });

        if (!this.dryRun) {
          const filePath = path.join(DATA_DIR, 'items', `${category}.json`);
          fs.writeFileSync(filePath, JSON.stringify(localData, null, 2) + '\n');
        }
      }
    }

    this.printReport();
  }

  printReport() {
    console.log('\n' + '='.repeat(70));
    console.log(this.updateMode ? 'UPDATE REPORT' : 'AUDIT REPORT');
    console.log('='.repeat(70));
    console.log(`Generated: ${new Date().toISOString()}`);
    console.log(`API Source: ${API_BASE}/items`);
    console.log('='.repeat(70) + '\n');

    if (this.updateMode) {
      this.printUpdateReport();
    } else {
      this.printAuditReport();
    }
  }

  printAuditReport() {
    if (this.discrepancies.length === 0) {
      console.log('✅ No discrepancies found!');
      return;
    }

    const totalIssues = this.discrepancies.reduce((sum, d) =>
      sum + (d.issues?.length || 1), 0);
    console.log(`Found ${totalIssues} discrepancies across ${this.discrepancies.length} items:\n`);

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
        if (item.type === 'not_found') {
          console.log(`    ⚠️  ${item.message}`);
        } else {
          for (const issue of item.issues) {
            console.log(`    ${issue.field}: ${issue.local} → ${issue.api}`);
          }
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));

    const notFound = this.discrepancies.filter(d => d.type === 'not_found').length;
    const withIssues = this.discrepancies.filter(d => d.issues).length;

    console.log(`  Items with discrepancies: ${withIssues}`);
    console.log(`  Items not found in API:   ${notFound}`);
    console.log(`  Total issues:             ${totalIssues}`);
    console.log('\nRun with --update to preview fixes, or --update --apply to apply them.');
  }

  printUpdateReport() {
    if (this.updates.length === 0) {
      console.log('✅ All item data is already up to date!');
      return;
    }

    const totalChanges = this.updates.reduce((sum, u) =>
      sum + u.items.reduce((s, i) => s + i.changes.length, 0), 0);

    console.log(`Updated ${totalChanges} values:\n`);

    for (const categoryUpdate of this.updates) {
      console.log(`\n📦 ${categoryUpdate.category.toUpperCase()}`);
      console.log('='.repeat(40));

      for (const itemUpdate of categoryUpdate.items) {
        console.log(`\n  ${itemUpdate.item}:`);
        for (const change of itemUpdate.changes) {
          console.log(`    ${change.field}: ${change.old} → ${change.new}`);
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
      console.log('   Run with --update --apply to make changes.');
    } else {
      console.log('\n✅ Files have been updated.');
    }
  }
}

// Parse command line args
const args = process.argv.slice(2);
const updateMode = args.includes('--update');
const dryRun = !args.includes('--apply');

const auditor = new ItemAuditor({ update: updateMode, dryRun });
auditor.audit();
