'use strict';

/**
 * Petit stockage temporaire en mémoire, avec expiration.
 * Sert aux données qui vivent quelques minutes seulement (réponse du CAPTCHA, défi Face ID) :
 * inutile de les mettre en base, donc aucune collection supplémentaire.
 * take() lit ET supprime : chaque valeur ne sert qu'une seule fois.
 */
class MemoryStore {
  constructor({ ttlMs, max = 5000 }) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.items = new Map();
  }

  set(key, value) {
    this.prune();
    if (this.items.size >= this.max) this.items.delete(this.items.keys().next().value); // la plus ancienne
    this.items.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  take(key) {
    if (!key) return undefined;
    const item = this.items.get(key);
    this.items.delete(key);
    return item && item.expiresAt > Date.now() ? item.value : undefined;
  }

  prune() {
    const now = Date.now();
    for (const [key, item] of this.items) if (item.expiresAt <= now) this.items.delete(key);
  }
}

module.exports = MemoryStore;
