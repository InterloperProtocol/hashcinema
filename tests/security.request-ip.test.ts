import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getRequestIp } from "@/lib/security/request-ip";

describe("request IP extraction", () => {
  it("prefers x-real-ip when present", () => {
    const request = new NextRequest("http://localhost/test", {
      headers: {
        "x-real-ip": "203.0.113.1",
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
      },
    });

    expect(getRequestIp(request)).toBe("203.0.113.1");
  });

  it("uses left-most x-forwarded-for entry as client IP", () => {
    const request = new NextRequest("http://localhost/test", {
      headers: {
        "x-forwarded-for": "198.51.100.9, 203.0.113.44",
      },
    });

    expect(getRequestIp(request)).toBe("198.51.100.9");
  });
});
