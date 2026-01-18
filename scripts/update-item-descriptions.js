#!/usr/bin/env node
/**
 * Deadlock Item Description Updater
 * Updates item passive/active descriptions from the official Deadlock API
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../public/data');
const API_BASE = 'https://assets.deadlock-api.com/v2';

class DescriptionUpdater {
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

  cleanHtml(text) {
    if (!text) return '';
    // Remove SVG tags and their content
    text = text.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '');
    // Remove all other HTML tags
    text = text.replace(/<[^>]+>/g, '');
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  }

  extractDescription(apiItem) {
    // Try to get description from tooltip sections first (more specific)
    const tooltips = apiItem.tooltip_sections || [];

    for (const section of tooltips) {
      const sectionType = section.section_type;
      if (sectionType === 'passive' || sectionType === 'active') {
        const attrs = section.section_attributes || [];
        for (const attr of attrs) {
          const locString = attr.loc_string;
          if (locString) {
            return this.cleanHtml(locString);
          }
        }
      }
    }

    // Fall back to main description
    const desc = apiItem.description;
    if (desc) {
      if (typeof desc === 'object') {
        // Try active description first, then general desc
        if (desc.active) return this.cleanHtml(desc.active);
        if (desc.desc) return this.cleanHtml(desc.desc);
      } else if (typeof desc === 'string') {
        return this.cleanHtml(desc);
      }
    }

    return null;
  }

  updateItemDescription(localItem, apiItem) {
    const changes = [];
    const apiDesc = this.extractDescription(apiItem);

    if (!apiDesc) return changes;

    // Determine target section
    const target = localItem.active || localItem.passive;
    if (!target) return changes;

    const targetKey = localItem.active ? 'active' : 'passive';

    // Compare descriptions
    const localDesc = target.description || '';

    // Only update if descriptions are meaningfully different
    if (localDesc !== apiDesc && apiDesc.length > 10) {
      changes.push({
        field: 'description',
        old: localDesc.substring(0, 60) + (localDesc.length > 60 ? '...' : ''),
        new: apiDesc.substring(0, 60) + (apiDesc.length > 60 ? '...' : ''),
        fullNew: apiDesc
      });
      target.description = apiDesc;
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

        const changes = this.updateItemDescription(localItem, apiItem);
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
    console.log('ITEM DESCRIPTION UPDATE REPORT');
    console.log('='.repeat(70) + '\n');

    if (this.updates.length === 0) {
      console.log('✅ All item descriptions are already up to date!');
      return;
    }

    const totalChanges = this.updates.reduce((sum, u) => sum + u.items.length, 0);

    console.log(`Updated ${totalChanges} descriptions:\n`);

    for (const categoryUpdate of this.updates) {
      console.log(`\n📦 ${categoryUpdate.category.toUpperCase()}`);
      console.log('='.repeat(40));

      for (const itemUpdate of categoryUpdate.items) {
        console.log(`\n  ${itemUpdate.item}:`);
        for (const change of itemUpdate.changes) {
          console.log(`    OLD: ${change.old}`);
          console.log(`    NEW: ${change.new}`);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    console.log(`  Items updated: ${totalChanges}`);

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

const updater = new DescriptionUpdater(dryRun);
updater.update();
