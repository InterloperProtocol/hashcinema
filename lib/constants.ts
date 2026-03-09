import { JobPackage, JobStatus, PackageType } from "@/lib/types/domain";

export const PACKAGE_CONFIG: Record<PackageType, JobPackage> = {
  "1d": { packageType: "1d", rangeDays: 1, priceSol: 0.02, videoSeconds: 30 },
  "2d": { packageType: "2d", rangeDays: 2, priceSol: 0.03, videoSeconds: 60 },
  "3d": { packageType: "3d", rangeDays: 3, priceSol: 0.04, videoSeconds: 90 },
};

export const FINAL_JOB_STATUSES: JobStatus[] = ["complete", "failed"];

export const PUMP_SOURCES = new Set([
  "PUMP_FUN",
  "PUMP",
  "PUMP_AMM",
  "PUMP_SWAP",
]);
