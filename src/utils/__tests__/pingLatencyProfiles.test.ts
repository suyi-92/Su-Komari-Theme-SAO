import { describe, expect, it } from "vitest";
import { resolveCustomLatencyColor } from "@/utils/metricTone";
import {
  getPingLatencyProfile,
  PING_LATENCY_PROFILES,
  resolvePingLatencyThresholds,
} from "@/utils/pingLatencyProfiles";
import {
  DEFAULT_PING_LATENCY_COLORS,
  DEFAULT_PING_LATENCY_THRESHOLDS,
} from "@/utils/themeSettings";

describe("mainland China latency reference profiles", () => {
  it.each([
    [{ region: "🇭🇰 Hong Kong", name: "LA Edge" }, "hongKongMacau"],
    [{ region: "Macau" }, "hongKongMacau"],
    [{ region: "Macao" }, "hongKongMacau"],
    [{ region: "中国香港" }, "hongKongMacau"],
    [{ region: "中國澳門" }, "hongKongMacau"],
    [{ region: "🇲🇴" }, "hongKongMacau"],
    [{ region: "China" }, "mainland"],
    [{ region: "JP" }, "eastAsia"],
    [{ region: "SG" }, "southeastAsia"],
    [{ region: "GB" }, "europe"],
    [{ region: "NZ" }, "oceania"],
    [{ region: "US" }, "usGeneral"],
    [{ region: "US", name: "Dallas Premium" }, "usGeneral"],
    [{ region: "US", name: "LAXative" }, "usGeneral"],
    [{ region: "US", name: "LA" }, "usGeneral"],
    [{ region: "US", name: "Los Angeles 01" }, "usWest"],
    [{ region: "us-west-2" }, "usWest"],
    [{ region: "🇺🇸", public_remark: "机房位于纽约" }, "usEast"],
    [{ region: "US", name: "Seattle", tags: "New York<Green>" }, "usGeneral"],
    [{ region: "US-East", name: "Los Angeles Relay" }, "usEast"],
    [{ region: "", name: "LAX" }, "fallback"],
    [{ region: "BR" }, "fallback"],
  ] as const)("selects a reference for %o", (node, profile) => {
    expect(getPingLatencyProfile(node)).toBe(profile);
  });

  it("rates 150 ms independently for Hong Kong and the US West Coast", () => {
    const fallback = DEFAULT_PING_LATENCY_THRESHOLDS;
    const hongKong = resolvePingLatencyThresholds("regional", fallback, "hongKongMacau");
    const westCoast = resolvePingLatencyThresholds("regional", fallback, "usWest");
    expect(resolveCustomLatencyColor(150, hongKong)).toBe(DEFAULT_PING_LATENCY_COLORS.critical);
    expect(resolveCustomLatencyColor(150, westCoast)).toBe(DEFAULT_PING_LATENCY_COLORS.good);
    expect(resolvePingLatencyThresholds("regional", fallback, "fallback")).toBe(fallback);
  });

  it("uses custom thresholds instead of any reference and keeps the supplied colors", () => {
    const custom = { excellent: 20, good: 50, moderate: 155, elevated: 180 };
    const colors = { ...DEFAULT_PING_LATENCY_COLORS, moderate: "#123456" };
    for (const profile of ["hongKongMacau", "usWest"] as const) {
      const thresholds = resolvePingLatencyThresholds("custom", custom, profile);
      expect(thresholds).toBe(custom);
      expect(resolveCustomLatencyColor(150, thresholds, colors)).toBe("#123456");
    }
  });

  it("uses monotonically increasing thresholds with distinct US references", () => {
    for (const { thresholds: { excellent, good, moderate, elevated } } of Object.values(PING_LATENCY_PROFILES)) {
      expect(excellent).toBeLessThan(good);
      expect(good).toBeLessThan(moderate);
      expect(moderate).toBeLessThan(elevated);
    }
    expect(PING_LATENCY_PROFILES.usWest.thresholds.good).toBeLessThan(PING_LATENCY_PROFILES.usGeneral.thresholds.good);
    expect(PING_LATENCY_PROFILES.usGeneral.thresholds.good).toBeLessThan(PING_LATENCY_PROFILES.usEast.thresholds.good);
  });
});
