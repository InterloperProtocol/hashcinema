import { assertTransition, canTransition } from "@/lib/jobs/state-machine";

describe("job state machine", () => {
  it("allows valid transitions", () => {
    expect(canTransition("awaiting_payment", "payment_detected")).toBe(true);
    expect(canTransition("payment_detected", "payment_confirmed")).toBe(true);
    expect(canTransition("payment_confirmed", "processing")).toBe(true);
    expect(canTransition("processing", "complete")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("awaiting_payment", "complete")).toBe(false);
    expect(() => assertTransition("complete", "processing")).toThrow();
    expect(() => assertTransition("failed", "processing")).toThrow();
  });
});

