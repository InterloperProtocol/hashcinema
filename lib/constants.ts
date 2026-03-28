import { JobPackage, JobStatus, PackageType } from "@/lib/types/domain";

export const PACKAGE_CONFIG: Record<PackageType, JobPackage> = {
  "1d": {
    packageType: "1d",
    rangeDays: 1,
    priceSol: 0.01,
    priceUsdc: 1,
    videoSeconds: 30,
    enabled: true,
    label: "30 sec",
    subtitle: "Fast video trading card",
  },
  "2d": {
    packageType: "2d",
    rangeDays: 2,
    priceSol: 0.02,
    priceUsdc: 2,
    videoSeconds: 60,
    enabled: true,
    label: "60 sec",
    subtitle: "Full memecoin short film",
  },
  "3d": {
    packageType: "3d",
    rangeDays: 3,
    priceSol: 0.04,
    priceUsdc: 5,
    videoSeconds: 90,
    enabled: false,
    label: "90 sec",
    subtitle: "Legacy package",
  },
};

export const ACTIVE_PACKAGE_TYPES = ["1d", "2d"] as const satisfies readonly PackageType[];

export const FINAL_JOB_STATUSES: JobStatus[] = ["complete", "failed"];

export const PUMP_SOURCES = new Set([
  "PUMP_FUN",
  "PUMP",
  "PUMP_AMM",
  "PUMP_SWAP",
]);
