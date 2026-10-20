import "server-only";

const tenantIdEnvironmentVariables: Record<string, string> = {
  "sulthan-hardware": "SULTHAN_HARDWARE_TENANT_ID",
};

export function getTenantDatabaseId(slug: string): number | undefined {
  const variableName = tenantIdEnvironmentVariables[slug];
  if (!variableName) return undefined;

  const configuredId = process.env[variableName];
  if (!configuredId || !/^[1-9]\d*$/.test(configuredId)) {
    throw new Error(`${variableName} must be set to a positive integer.`);
  }

  const tenantId = Number(configuredId);
  if (!Number.isSafeInteger(tenantId)) {
    throw new Error(`${variableName} must be a safe positive integer.`);
  }

  return tenantId;
}
