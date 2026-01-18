// LocalStorage utilities for build persistence

const STORAGE_KEY = 'deadlock_builds';
const CURRENT_BUILD_KEY = 'deadlock_current_build';
const HERO_BUILDS_KEY = 'deadlock_hero_builds';

export function saveBuilds(builds) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(builds));
}

export function loadBuilds() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveBuild(build) {
  const builds = loadBuilds();
  const existingIndex = builds.findIndex(b => b.id === build.id);

  if (existingIndex >= 0) {
    builds[existingIndex] = build;
  } else {
    build.id = Date.now().toString();
    builds.push(build);
  }

  saveBuilds(builds);
  return build;
}

export function deleteBuild(buildId) {
  const builds = loadBuilds().filter(b => b.id !== buildId);
  saveBuilds(builds);
}

export function saveCurrentBuild(buildState) {
  localStorage.setItem(CURRENT_BUILD_KEY, JSON.stringify(buildState));
}

export function loadCurrentBuild() {
  const data = localStorage.getItem(CURRENT_BUILD_KEY);
  return data ? JSON.parse(data) : null;
}

export function clearCurrentBuild() {
  localStorage.removeItem(CURRENT_BUILD_KEY);
}

// Per-hero build storage
export function saveHeroBuild(heroId, buildData) {
  const heroBuilds = loadAllHeroBuilds();
  heroBuilds[heroId] = {
    ...buildData,
    heroId,
    timestamp: Date.now()
  };
  localStorage.setItem(HERO_BUILDS_KEY, JSON.stringify(heroBuilds));
}

export function loadHeroBuild(heroId) {
  const heroBuilds = loadAllHeroBuilds();
  return heroBuilds[heroId] || null;
}

export function loadAllHeroBuilds() {
  const data = localStorage.getItem(HERO_BUILDS_KEY);
  return data ? JSON.parse(data) : {};
}

export function clearHeroBuild(heroId) {
  const heroBuilds = loadAllHeroBuilds();
  delete heroBuilds[heroId];
  localStorage.setItem(HERO_BUILDS_KEY, JSON.stringify(heroBuilds));
}

// URL-based build sharing
export function encodeBuildToURL(buildState) {
  const encoded = btoa(JSON.stringify(buildState));
  return `${window.location.origin}${window.location.pathname}?build=${encoded}`;
}

export function decodeBuildFromURL() {
  const params = new URLSearchParams(window.location.search);
  const buildData = params.get('build');

  if (buildData) {
    try {
      return JSON.parse(atob(buildData));
    } catch (e) {
      console.error('Failed to decode build from URL:', e);
      return null;
    }
  }
  return null;
}

export function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Build URL copied to clipboard!');
  }).catch(() => {
    showToast('Failed to copy to clipboard');
  });
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}
