import { PACKAGE_CONFIG } from "@/lib/constants";
import { JobPackage, PackageType } from "@/lib/types/domain";

const PACKAGE_BY_DURATION = new Map<number, JobPackage>(
  Object.values(PACKAGE_CONFIG)
    .filter((item) => item.enabled !== false)
    .map((item) => [item.videoSeconds, item]),
);

export function getPackageConfig(packageType: PackageType): JobPackage {
  return PACKAGE_CONFIG[packageType];
}

export function resolvePackageFromDuration(
  durationSeconds: number,
): JobPackage | null {
  return PACKAGE_BY_DURATION.get(durationSeconds) ?? null;
}

export function resolvePackage(input: {
  packageType?: PackageType | null;
  durationSeconds?: number | null;
}): JobPackage | null {
  if (input.packageType) {
    const pkg = PACKAGE_CONFIG[input.packageType] ?? null;
    return pkg?.enabled === false ? null : pkg;
  }

  if (typeof input.durationSeconds === "number") {
    return resolvePackageFromDuration(input.durationSeconds);
  }

  return null;
}
