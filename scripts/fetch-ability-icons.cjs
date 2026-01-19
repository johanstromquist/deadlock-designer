#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

const HEROES_DIR = path.join(__dirname, '../public/data/heroes');
const OUTPUT_DIR = path.join(__dirname, '../public/images/abilities');
const MAPPING_FILE = path.join(HEROES_DIR, 'ability-images.json');

// Name mappings for abilities where local data differs from wiki
const NAME_ALIASES = {
  // Calico - wiki has different ability set
  "Feline Friends": "Gloom Bombs",
  "Wall Run": "Leaping Slash",
  "Purrsuit": "Ava",
  "Nine Lives": "Return to Shadows",
  // Holliday - wiki has different ability set
  "Weighted Dice": "Powder Keg",
  "Smoke Screen": "Bounce Pad",
  "Quick Draw": "Crackshot",
  "High Noon": "Spirit Lasso",
  // Minor name differences
  "Watcher's Stone": "Watcher's Covenant",
  "Enchanted Satchel": "Enchanter's Satchel",
  "Crow's Sight": "Crow Familiar",
};

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Get all ability names from hero files
function getAllAbilities() {
  const abilities = [];
  const heroFiles = fs.readdirSync(HEROES_DIR)
    .filter(f => f.endsWith('.json') && !['index.json', 'images.json', 'ability-images.json'].includes(f));

  for (const file of heroFiles) {
    const heroData = JSON.parse(fs.readFileSync(path.join(HEROES_DIR, file), 'utf-8'));
    if (heroData.abilities) {
      for (const ability of heroData.abilities) {
        abilities.push({
          id: ability.id,
          name: ability.name,
          heroId: heroData.id
        });
      }
    }
  }
  return abilities;
}

// Convert ability name to wiki filename
function toWikiFilename(name) {
  return name.replace(/ /g, '_') + '.png';
}

// Fetch image URL from wiki API
function fetchImageUrl(abilityName) {
  return new Promise((resolve, reject) => {
    const filename = toWikiFilename(abilityName);
    const apiUrl = `https://deadlock.wiki/api.php?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url&format=json`;

    https.get(apiUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pages = json.query?.pages;
          if (pages) {
            const page = Object.values(pages)[0];
            if (page.imageinfo && page.imageinfo[0]) {
              resolve(page.imageinfo[0].url);
            } else {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Download image
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Follow redirect
        https.get(res.headers.location, (res2) => {
          res2.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve(true);
          });
        }).on('error', reject);
      } else {
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(true);
        });
      }
    }).on('error', reject);
  });
}

// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('Fetching ability icons from Deadlock Wiki...\n');

  const abilities = getAllAbilities();
  console.log(`Found ${abilities.length} abilities across all heroes.\n`);

  const mapping = {};
  const failed = [];

  for (let i = 0; i < abilities.length; i++) {
    const ability = abilities[i];
    const filename = `${ability.id}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);

    process.stdout.write(`[${i + 1}/${abilities.length}] ${ability.name}... `);

    try {
      // Get wiki image URL (use alias if available)
      const wikiName = NAME_ALIASES[ability.name] || ability.name;
      const imageUrl = await fetchImageUrl(wikiName);

      if (!imageUrl) {
        console.log('NOT FOUND');
        failed.push(ability);
        continue;
      }

      // Download the image
      await downloadImage(imageUrl, filepath);

      // Add to mapping
      mapping[ability.id] = `images/abilities/${filename}`;
      console.log('OK');

      // Rate limit to be nice to the wiki
      await sleep(100);

    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      failed.push(ability);
    }
  }

  // Write mapping file
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2));
  console.log(`\nMapping saved to: ${MAPPING_FILE}`);

  console.log(`\nResults: ${Object.keys(mapping).length} downloaded, ${failed.length} failed`);

  if (failed.length > 0) {
    console.log('\nFailed abilities:');
    for (const f of failed) {
      console.log(`  - ${f.name} (${f.heroId})`);
    }
  }
}

main().catch(console.error);
