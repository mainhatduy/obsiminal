export interface CustomShellDefinition {
  args: string[];
  executable: string;
  id: string;
  name: string;
}

export interface VaultShellSettings {
  customShells: CustomShellDefinition[];
}

export const DEFAULT_SETTINGS: VaultShellSettings = { customShells: [] };

export function normalizeSettings(value: unknown): VaultShellSettings {
  if (!value || typeof value !== "object" || !("customShells" in value)) {
    return { customShells: [] };
  }

  const candidates: unknown[] = Array.isArray(value.customShells)
    ? (value.customShells as unknown[])
    : [];
  const customShells = candidates.filter(isCustomShellDefinition).map((candidate) => ({
    args: [...candidate.args],
    executable: candidate.executable,
    id: candidate.id,
    name: candidate.name,
  }));
  return { customShells };
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
