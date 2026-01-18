#!/usr/bin/env node
/**
 * Deadlock Data Auditor
 * Compares local JSON data against the official Deadlock API
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
  'hero_nano': 'calico',        // API: nano = Calico
  'hero_dynamo': 'dynamo',
  'hero_orion': 'grey_talon',   // API: orion = Grey Talon
  'hero_haze': 'haze',
  'hero_astro': 'holliday',     // API: astro = Holliday
  'hero_inferno': 'infernus',
  'hero_tengu': 'ivy',          // API: tengu = Ivy
  'hero_kelvin': 'kelvin',
  'hero_ghost': 'lady_geist',
  'hero_lash': 'lash',
  'hero_forge': 'mcginnis',     // API: forge = McGinnis
  'hero_mirage': 'mirage',
  'hero_krill': 'mo_and_krill',
  'hero_chrono': 'paradox',
  'hero_synth': 'pocket',       // API: synth = Pocket
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

// Ability name mapping: API internal name -> local ability id
const ABILITY_NAME_MAP = {
  // Abrams
  'citadel_ability_bull_heal': 'siphon_life',
  'citadel_ability_bull_charge': 'shoulder_charge',
  'citadel_ability_passive_beefy': 'infernal_resilience',
  'citadel_ability_bull_leap': 'seismic_impact'
};

class Auditor {
  constructor() {
    this.discrepancies = [];
    this.apiHeroes = null;
    this.localHeroes = {};
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

  loadLocalData() {
    console.log('Loading local hero data...');

    const heroesDir = path.join(DATA_DIR, 'heroes');
    const files = fs.readdirSync(heroesDir).filter(f =>
      f.endsWith('.json') && f !== 'index.json' && f !== 'images.json'
    );

    for (const file of files) {
      const heroId = file.replace('.json', '');
      const data = JSON.parse(fs.readFileSync(path.join(heroesDir, file), 'utf-8'));
      this.localHeroes[heroId] = data;
    }

    console.log(`Loaded ${Object.keys(this.localHeroes).length} local heroes\n`);
  }

  compareStats(apiHero, localHero, heroName) {
    const apiStats = apiHero.starting_stats || {};
    const localStats = localHero.baseStats || {};

    for (const [apiField, localField] of Object.entries(STAT_MAPPING)) {
      const apiValue = apiStats[apiField]?.value ?? apiStats[apiField];
      const localValue = localStats[localField];

      if (apiValue !== undefined && localValue !== undefined) {
        if (Math.abs(apiValue - localValue) > 0.01) {
          this.discrepancies.push({
            hero: heroName,
            field: localField,
            type: 'stat',
            local: localValue,
            api: apiValue,
            diff: ((apiValue - localValue) / localValue * 100).toFixed(1) + '%'
          });
        }
      } else if (apiValue !== undefined && localValue === undefined) {
        this.discrepancies.push({
          hero: heroName,
          field: localField,
          type: 'missing_local',
          api: apiValue
        });
      }
    }
  }

  compareAbilities(apiHero, localHero, heroName) {
    // Count unique abilities from recommended_ability_order
    const apiAbilities = apiHero.recommended_ability_order || [];
    const uniqueApiAbilities = [...new Set(apiAbilities)];
    const apiAbilityCount = uniqueApiAbilities.length;
    const localAbilityCount = localHero.abilities?.length || 0;

    if (apiAbilityCount !== localAbilityCount && apiAbilityCount > 0) {
      this.discrepancies.push({
        hero: heroName,
        field: 'ability_count',
        type: 'ability',
        local: localAbilityCount,
        api: apiAbilityCount,
        apiAbilities: uniqueApiAbilities
      });
    }
  }

  async audit() {
    await this.fetchApiData();
    this.loadLocalData();

    console.log('Comparing data...\n');
    console.log('='.repeat(70));

    // Build reverse map for faster lookup
    const apiHeroByClass = {};
    for (const hero of this.apiHeroes) {
      apiHeroByClass[hero.class_name] = hero;
    }

    // Check each local hero
    for (const [localId, localData] of Object.entries(this.localHeroes)) {
      // Find matching API hero
      let apiHero = null;
      for (const [apiClass, mappedId] of Object.entries(HERO_NAME_MAP)) {
        if (mappedId === localId) {
          apiHero = apiHeroByClass[apiClass];
          break;
        }
      }

      if (!apiHero) {
        console.log(`⚠️  No API mapping found for: ${localId}`);
        continue;
      }

      this.compareStats(apiHero, localData, localId);
      this.compareAbilities(apiHero, localData, localId);
    }

    // Check for heroes in API but not locally
    for (const [apiClass, mappedId] of Object.entries(HERO_NAME_MAP)) {
      if (!this.localHeroes[mappedId]) {
        this.discrepancies.push({
          hero: mappedId,
          type: 'missing_hero',
          message: 'Hero exists in API but not in local data'
        });
      }
    }

    this.printReport();
  }

  printReport() {
    console.log('\n' + '='.repeat(70));
    console.log('AUDIT REPORT');
    console.log('='.repeat(70));
    console.log(`Generated: ${new Date().toISOString()}`);
    console.log(`API Source: ${API_BASE}/heroes`);
    console.log('='.repeat(70) + '\n');

    if (this.discrepancies.length === 0) {
      console.log('✅ No discrepancies found!');
      return;
    }

    console.log(`Found ${this.discrepancies.length} discrepancies:\n`);

    // Group by hero
    const byHero = {};
    for (const d of this.discrepancies) {
      if (!byHero[d.hero]) byHero[d.hero] = [];
      byHero[d.hero].push(d);
    }

    for (const [hero, issues] of Object.entries(byHero)) {
      console.log(`\n📋 ${hero.toUpperCase()}`);
      console.log('-'.repeat(40));

      for (const issue of issues) {
        if (issue.type === 'stat') {
          console.log(`  ${issue.field}:`);
          console.log(`    Local: ${issue.local}`);
          console.log(`    API:   ${issue.api} (${issue.diff})`);
        } else if (issue.type === 'missing_local') {
          console.log(`  ${issue.field}: missing locally (API has: ${issue.api})`);
        } else if (issue.type === 'ability') {
          console.log(`  ${issue.field}: Local=${issue.local}, API=${issue.api}`);
        } else {
          console.log(`  ${issue.message || issue.type}`);
        }
      }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));

    const statIssues = this.discrepancies.filter(d => d.type === 'stat').length;
    const abilityIssues = this.discrepancies.filter(d => d.type === 'ability').length;
    const missingIssues = this.discrepancies.filter(d =>
      d.type === 'missing_local' || d.type === 'missing_hero'
    ).length;

    console.log(`  Stat mismatches:    ${statIssues}`);
    console.log(`  Ability mismatches: ${abilityIssues}`);
    console.log(`  Missing data:       ${missingIssues}`);
    console.log(`  Total:              ${this.discrepancies.length}`);

    // Write JSON report
    const reportPath = path.join(__dirname, '../audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      generated: new Date().toISOString(),
      apiSource: `${API_BASE}/heroes`,
      summary: {
        totalDiscrepancies: this.discrepancies.length,
        statMismatches: statIssues,
        abilityMismatches: abilityIssues,
        missingData: missingIssues
      },
      discrepancies: this.discrepancies
    }, null, 2));

    console.log(`\n📄 Full report saved to: audit-report.json`);
  }
}

// Run the auditor
const auditor = new Auditor();
auditor.audit();
