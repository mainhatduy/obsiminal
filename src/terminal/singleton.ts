export interface SingletonSelection<T> {
  duplicates: T[];
  primary: T | null;
}

export function selectSingleton<T>(items: T[], preferred: T | null): SingletonSelection<T> {
  if (items.length === 0) {
    return { duplicates: [], primary: null };
  }

  const primary = preferred !== null && items.includes(preferred) ? preferred : items[0];
  return {
    duplicates: items.filter((item) => item !== primary),
    primary,
  };
}
