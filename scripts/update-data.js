#!/usr/bin/env node
/**
 * Deadlock Data Updater
 * Updates local JSON data from the official Deadlock API
 * Source: https://assets.deadlock-api.com/v2/heroes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../public/data');
const API_BASE = 'https://assets.deadlock-api.com/v2';

// Hero name mapping: API class_name -> local file name
const HERO_NAME_MAP = {
  'hero_atlas': 'abrams',
  'hero_bebop': 'bebop',
  'hero_nano': 'calico',
  'hero_dynamo': 'dynamo',
  'hero_orion': 'grey_talon',
  'hero_haze': 'haze',
  'hero_astro': 'holliday',
  'hero_inferno': 'infernus',
  'hero_tengu': 'ivy',
  'hero_kelvin': 'kelvin',
  'hero_ghost': 'lady_geist',
  'hero_lash': 'lash',
  'hero_forge': 'mcginnis',
  'hero_mirage': 'mirage',
  'hero_krill': 'mo_and_krill',
  'hero_chrono': 'paradox',
  'hero_synth': 'pocket',
  'hero_gigawatt': 'seven',
  'hero_shiv': 'shiv',
  'hero_hornet': 'vindicta',
  'hero_viscous': 'viscous',
  'hero_warden': 'warden',
  'hero_wraith': 'wraith',
  'hero_yamato': 'yamato'
};

// Stat field mapping: API field -> local field
const STAT_MAPPING = {
  'max_health': 'health',
  'base_health_regen': 'healthRegen',
  'max_move_speed': 'moveSpeed',
  'sprint_speed': 'sprintSpeed',
  'stamina': 'stamina'
};

class Updater {
  constructor(dryRun = false) {
    this.dryRun = dryRun;
    this.apiHeroes = null;
    this.updates = [];
  }

  async fetchApiData() {
    console.log('Fetching data from Deadlock API...');

    try {
      const response = await fetch(`${API_BASE}/heroes`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      this.apiHeroes = await response.json();
      console.log(`Fetched ${this.apiHeroes.length} heroes from API\n`);
    } catch (error) {
      console.error('Failed to fetch API data:', error.message);
      process.exit(1);
    }
  }

  getApiValue(stats, field) {
    const value = stats[field];
    if (value === undefined) return undefined;
    // Handle both {value: X} format and direct values
    return value?.value ?? value;
  }

  updateHero(apiHero, localFilePath) {
    const localData = JSON.parse(fs.readFileSync(localFilePath, 'utf-8'));
    const heroName = localData.name || localData.id;
    const apiStats = apiHero.starting_stats || {};

    let changed = false;
    const changes = [];

    // Ensure baseStats exists
    if (!localData.baseStats) {
      localData.baseStats = {};
    }

    // Update mapped stats
    for (const [apiField, localField] of Object.entries(STAT_MAPPING)) {
      const apiValue = this.getApiValue(apiStats, apiField);

      if (apiValue !== undefined) {
        const oldValue = localData.baseStats[localField];

        if (oldValue !== apiValue) {
          changes.push({
            field: localField,
            old: oldValue,
            new: apiValue
          });
          localData.baseStats[localField] = apiValue;
          changed = true;
        }
      }
    }

    if (changed) {
      this.updates.push({
        hero: heroName,
        file: path.basename(localFilePath),
        changes
      });

      if (!this.dryRun) {
        fs.writeFileSync(localFilePath, JSON.stringify(localData, null, 2) + '\n');
      }
    }

    return changed;
  }

  async update() {
    await this.fetchApiData();

    // Build API hero lookup by class name
    const apiHeroByClass = {};
    for (const hero of this.apiHeroes) {
      apiHeroByClass[hero.class_name] = hero;
    }

    console.log(this.dryRun ? '=== DRY RUN (no files will be modified) ===' : '=== UPDATING FILES ===');
    console.log('');

    const heroesDir = path.join(DATA_DIR, 'heroes');
    let updatedCount = 0;
    let skippedCount = 0;

    for (const [apiClass, localId] of Object.entries(HERO_NAME_MAP)) {
      const localFilePath = path.join(heroesDir, `${localId}.json`);

      if (!fs.existsSync(localFilePath)) {
        console.log(`⚠️  Skipping ${localId}: file not found`);
        skippedCount++;
        continue;
      }

      const apiHero = apiHeroByClass[apiClass];
      if (!apiHero) {
        console.log(`⚠️  Skipping ${localId}: no API data for ${apiClass}`);
        skippedCount++;
        continue;
      }

      const wasUpdated = this.updateHero(apiHero, localFilePath);
      if (wasUpdated) {
        updatedCount++;
      }
    }

    this.printReport(updatedCount, skippedCount);
  }

  printReport(updatedCount, skippedCount) {
    console.log('\n' + '='.repeat(70));
    console.log('UPDATE REPORT');
    console.log('='.repeat(70));
    console.log(`Generated: ${new Date().toISOString()}`);
    console.log(`Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
    console.log('='.repeat(70) + '\n');

    if (this.updates.length === 0) {
      console.log('✅ All data is already up to date!');
      return;
    }

    console.log(`Updated ${updatedCount} heroes:\n`);

    for (const update of this.updates) {
      console.log(`📋 ${update.hero.toUpperCase()} (${update.file})`);
      console.log('-'.repeat(40));

      for (const change of update.changes) {
        const oldStr = change.old === undefined ? '(missing)' : change.old;
        console.log(`  ${change.field}: ${oldStr} → ${change.new}`);
      }
      console.log('');
    }

    // Summary
    console.log('='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    console.log(`  Heroes updated: ${updatedCount}`);
    console.log(`  Heroes skipped: ${skippedCount}`);
    console.log(`  Total changes:  ${this.updates.reduce((sum, u) => sum + u.changes.length, 0)}`);

    if (this.dryRun) {
      console.log('\n⚠️  DRY RUN: No files were modified.');
      console.log('   Run with --apply to make changes.');
    } else {
      console.log('\n✅ Files have been updated.');
    }
  }
}

// Parse command line args
const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');

if (dryRun) {
  console.log('Running in DRY RUN mode. Use --apply to make actual changes.\n');
}

const updater = new Updater(dryRun);
updater.update();
