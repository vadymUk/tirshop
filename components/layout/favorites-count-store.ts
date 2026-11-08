// Mirrors favorite toggles in the header badge without a reload. It stores only a delta
// relative to the server-rendered count; Supabase stays the source of truth.

let delta = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function adjustFavoritesCount(by: number) {
  delta += by;
  emit();
}

export function resetFavoritesDelta() {
  if (delta === 0) return;
  delta = 0;
  emit();
}

export function subscribeFavoritesDelta(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getFavoritesDeltaSnapshot() {
  return delta;
}
