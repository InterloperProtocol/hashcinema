import {
  buildSweepSummary,
  sweepDedicatedPaymentAddressForJob,
  sweepDedicatedPaymentAddresses,
  SweepSummary,
} from "./sweep-payments";

export interface WorkerCommandPayload {
  jobId?: string;
  limit?: number;
}

export async function executeSweepCommand(
  payload: WorkerCommandPayload,
): Promise<SweepSummary> {
  if (typeof payload.jobId === "string" && payload.jobId.trim().length > 0) {
    const jobId = payload.jobId.trim();
    const result = await sweepDedicatedPaymentAddressForJob(jobId);
    return buildSweepSummary(1, [result]);
  }

  return sweepDedicatedPaymentAddresses(payload.limit);
}
