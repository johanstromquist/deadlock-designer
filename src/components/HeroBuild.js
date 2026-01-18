// Hero Build Component - Manages 12 universal item slots

import { getItemImageUrl, getItemInitials } from '../utils/images.js';

export class HeroBuild {
  constructor(options) {
    this.onSlotClick = options.onSlotClick;
    this.onItemRemove = options.onItemRemove;
    this.onStatsChange = options.onStatsChange;

    // 12 universal slots (9 base + 3 unlockable)
    this.slots = new Array(12).fill(null);

    // Slot unlock thresholds (souls spent)
    this.unlockThresholds = [0, 0, 0, 0, 0, 0, 0, 0, 0, 3000, 6000, 9000];

    this.totalSoulsEl = document.getElementById('total-souls');
    this.slotsContainer = document.getElementById('item-slots-grid');

    this.initializeSlots();
  }

  initializeSlots() {
    this.slotsContainer.innerHTML = '';

    for (let i = 0; i < 12; i++) {
      const slot = document.createElement('div');
      const isLocked = i >= 9;

      slot.className = `item-slot universal${isLocked ? ' locked' : ''}`;
      slot.dataset.index = i;
      slot.innerHTML = isLocked
        ? `<span class="empty-text locked-text">${this.unlockThresholds[i]}</span>`
        : '<span class="empty-text">+</span>';

      slot.addEventListener('click', (e) => {
        // If clicking remove button, don't open shop
        if (e.target.classList.contains('remove-item')) return;

        // Check if slot is locked
        if (this.isSlotLocked(i)) {
          this.showLockedMessage(i);
          return;
        }

        if (this.onSlotClick) {
          this.onSlotClick({
            index: i,
            currentItem: this.slots[i]
          });
        }
      });

      this.slotsContainer.appendChild(slot);
    }
  }

  isSlotLocked(index) {
    const totalSouls = this.getTotalSouls();
    return totalSouls < this.unlockThresholds[index];
  }

  showLockedMessage(index) {
    const threshold = this.unlockThresholds[index];
    const current = this.getTotalSouls();
    const needed = threshold - current;

    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = `Need ${needed.toLocaleString()} more souls to unlock this slot`;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2000);
  }

  setItem(index, item) {
    if (this.isSlotLocked(index)) return false;

    // Check for duplicate items
    if (this.hasItem(item.id)) {
      return { success: false, reason: 'duplicate' };
    }

    this.slots[index] = item;
    this.updateSlotDisplay(index);
    this.updateTotalSouls();
    this.updateLockedSlots();

    if (this.onStatsChange) {
      this.onStatsChange(this.getAllItems());
    }

    return { success: true };
  }

  hasItem(itemId) {
    return this.slots.some(slot => slot && slot.id === itemId);
  }

  getEquippedItemIds() {
    return this.slots
      .filter(slot => slot !== null)
      .map(slot => slot.id);
  }

  removeItem(index) {
    this.slots[index] = null;
    this.updateSlotDisplay(index);
    this.updateTotalSouls();
    this.updateLockedSlots();

    if (this.onStatsChange) {
      this.onStatsChange(this.getAllItems());
    }
  }

  updateSlotDisplay(index) {
    const slot = this.slotsContainer.children[index];
    const item = this.slots[index];
    const isLocked = this.isSlotLocked(index);

    if (item) {
      slot.classList.add('filled');
      slot.classList.remove('locked');
      // Add category class for border color
      slot.classList.remove('weapon', 'vitality', 'spirit');
      if (item.category) {
        slot.classList.add(item.category);
      }
      slot.innerHTML = `
        <div class="slot-icon-container">
          <img
            src="${getItemImageUrl(item.name)}"
            alt="${item.name}"
            class="slot-item-icon"
            loading="lazy"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          >
          <span class="slot-icon-fallback" style="display:none;">${getItemInitials(item.name)}</span>
        </div>
        <span class="item-name">${item.name}</span>
        <span class="item-cost">${item.cost.toLocaleString()}</span>
        <button class="remove-item" title="Remove item">&times;</button>
      `;

      // Bind remove button
      slot.querySelector('.remove-item').addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeItem(index);
        if (this.onItemRemove) {
          this.onItemRemove(index);
        }
      });
    } else if (isLocked) {
      slot.classList.remove('filled', 'weapon', 'vitality', 'spirit');
      slot.classList.add('locked');
      slot.innerHTML = `<span class="empty-text locked-text">${this.unlockThresholds[index].toLocaleString()}</span>`;
    } else {
      slot.classList.remove('filled', 'locked', 'weapon', 'vitality', 'spirit');
      slot.innerHTML = '<span class="empty-text">+</span>';
    }
  }

  updateLockedSlots() {
    // Re-check locked status for slots 9-11
    for (let i = 9; i < 12; i++) {
      if (!this.slots[i]) {
        this.updateSlotDisplay(i);
      }
    }
  }

  updateTotalSouls() {
    const total = this.getTotalSouls();
    this.totalSoulsEl.textContent = total.toLocaleString();
  }

  getAllItems() {
    return [...this.slots];
  }

  getTotalSouls() {
    return this.slots
      .filter(item => item !== null)
      .reduce((sum, item) => sum + item.cost, 0);
  }

  getInvestmentByCategory() {
    const investment = { weapon: 0, vitality: 0, spirit: 0 };

    this.slots.forEach(item => {
      if (item && item.category) {
        investment[item.category] = (investment[item.category] || 0) + item.cost;
      }
    });

    return investment;
  }

  getUnlockedSlotCount() {
    const totalSouls = this.getTotalSouls();
    let unlocked = 9; // Base slots

    if (totalSouls >= 9000) unlocked = 12;
    else if (totalSouls >= 6000) unlocked = 11;
    else if (totalSouls >= 3000) unlocked = 10;

    return unlocked;
  }

  loadBuild(buildData) {
    if (!buildData || !buildData.slots) return;

    // Handle both old format (category-based) and new format (array)
    if (Array.isArray(buildData.slots)) {
      buildData.slots.forEach((item, index) => {
        if (index < 12) {
          this.slots[index] = item;
          this.updateSlotDisplay(index);
        }
      });
    } else {
      // Legacy format conversion
      let slotIndex = 0;
      ['weapon', 'vitality', 'spirit', 'flex'].forEach(category => {
        if (buildData.slots[category]) {
          buildData.slots[category].forEach(item => {
            if (slotIndex < 12 && item) {
              this.slots[slotIndex] = item;
              this.updateSlotDisplay(slotIndex);
            }
            slotIndex++;
          });
        }
      });
    }

    this.updateTotalSouls();
    this.updateLockedSlots();
  }

  getBuildData() {
    return {
      slots: [...this.slots]
    };
  }

  reset() {
    for (let i = 0; i < 12; i++) {
      this.slots[i] = null;
      this.updateSlotDisplay(i);
    }
    this.updateTotalSouls();
    this.updateLockedSlots();

    if (this.onStatsChange) {
      this.onStatsChange(this.getAllItems());
    }
  }
}
