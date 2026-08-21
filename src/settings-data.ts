export interface CustomShellDefinition {
  args: string[];
  executable: string;
  id: string;
  name: string;
}

export interface VaultShellSettings {
  customShells: CustomShellDefinition[];
  defaultShellProfileId: string | null;
}

export const DEFAULT_SETTINGS: VaultShellSettings = {
  customShells: [],
  defaultShellProfileId: null,
};

export function normalizeSettings(value: unknown): VaultShellSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_SETTINGS, customShells: [] };
  }

  const settings = value as Record<string, unknown>;
  const candidates: unknown[] = Array.isArray(settings.customShells) ? settings.customShells : [];
  const customShells = candidates.filter(isCustomShellDefinition).map((candidate) => ({
    args: [...candidate.args],
    executable: candidate.executable,
    id: candidate.id,
    name: candidate.name,
  }));
  return {
    customShells,
    defaultShellProfileId:
      typeof settings.defaultShellProfileId === "string" && settings.defaultShellProfileId
        ? settings.defaultShellProfileId
        : null,
  };
}

function isCustomShellDefinition(value: unknown): value is CustomShellDefinition {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.executable === "string" &&
    Array.isArray(candidate.args) &&
    (candidate.args as unknown[]).every((argument) => typeof argument === "string")
  );
}
