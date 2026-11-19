import { EUROPE_CODES, getCountryCodeFromRegion } from "@/utils/geo";
import { DEFAULT_PING_LATENCY_THRESHOLDS } from "@/utils/themeSettings";
import type { NodeInfo, PingLatencyMode, PingLatencyThresholds } from "@/types/komari";

function profile(
  label: string,
  excellent: number,
  good: number,
  moderate: number,
  elevated: number,
) {
  return { label, thresholds: { excellent, good, moderate, elevated } };
}

export const PING_LATENCY_PROFILES = {
  mainland: profile("中国大陆", 25, 50, 80, 120),
  hongKongMacau: profile("香港、澳门", 45, 65, 90, 130),
  eastAsia: profile("日本、韩国、台湾", 65, 90, 120, 165),
  southeastAsia: profile("东南亚", 70, 100, 135, 185),
  usWest: profile("美国西部", 145, 175, 205, 250),
  usGeneral: profile("美国（海岸未知）", 175, 210, 245, 290),
  usEast: profile("美国东部", 200, 230, 265, 310),
  europe: profile("欧洲", 150, 190, 235, 285),
  oceania: profile("澳大利亚、新西兰", 150, 200, 250, 310),
  fallback: { label: "未知或未覆盖地区", thresholds: DEFAULT_PING_LATENCY_THRESHOLDS },
} as const satisfies Record<string, { label: string; thresholds: PingLatencyThresholds }>;

export type PingLatencyProfileId = keyof typeof PING_LATENCY_PROFILES;
type NodeLocation = Partial<Pick<NodeInfo, "region" | "name" | "public_remark" | "tags">>;

const EAST_ASIA = new Set(["JP", "KR", "TW"]);
const SOUTHEAST_ASIA = new Set(["BN", "ID", "KH", "LA", "MM", "MY", "PH", "SG", "TH", "TL", "VN"]);
const US_REGION = /^(?:us|usa|united states)(?:\b|$)|^(?:美[国國]|美[东西東西])/iu;
const WEST_HINT = /\b(?:us west|(?:usa|united states) west|west us|west coast|west(?:ern)? region|los angeles|lax|seattle|sea tac|san jose|san francisco|silicon valley|fremont|las vegas)\b|美西|美[国國]西(?:部|海岸)|洛杉矶|洛杉磯|西雅图|西雅圖|圣何塞|聖何塞|旧金山|舊金山|硅谷|矽谷|拉斯维加斯|拉斯維加斯/iu;
const EAST_HINT = /\b(?:us east|(?:usa|united states) east|east us|east coast|east(?:ern)? region|new york|new jersey|ashburn|virginia|miami|boston|atlanta|iad|jfk|ewr)\b|美[东東]|美[国國][东東](?:部|海岸)|纽约|紐約|新泽西|新澤西|弗吉尼亚|維吉尼亞|阿什本|迈阿密|邁阿密|波士顿|波士頓|亚特兰大|亞特蘭大/iu;

function normalizeLocation(value: string | undefined): string {
  return value?.normalize("NFKC").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() ?? "";
}

function getUsCoast(values: Array<string | undefined>): PingLatencyProfileId | null {
  const locations = values.map(normalizeLocation);
  const west = locations.some((value) => WEST_HINT.test(value));
  const east = locations.some((value) => EAST_HINT.test(value));
  if (west === east) return null;
  return west ? "usWest" : "usEast";
}

export function getPingLatencyProfile(node: NodeLocation | undefined): PingLatencyProfileId {
  const country = getCountryCodeFromRegion(node?.region);
  const region = normalizeLocation(node?.region);

  if (country === "US" || (!country && US_REGION.test(region))) {
    const regionWest = WEST_HINT.test(region);
    const regionEast = EAST_HINT.test(region);
    if (regionWest || regionEast) return getUsCoast([region]) ?? "usGeneral";
    return getUsCoast([node?.name, node?.public_remark, node?.tags]) ?? "usGeneral";
  }

  if (!country) return "fallback";
  if (country === "CN") return "mainland";
  if (country === "HK" || country === "MO") return "hongKongMacau";
  if (EAST_ASIA.has(country)) return "eastAsia";
  if (SOUTHEAST_ASIA.has(country)) return "southeastAsia";
  if (EUROPE_CODES.has(country)) return "europe";
  if (country === "AU" || country === "NZ") return "oceania";
  return "fallback";
}

export function resolvePingLatencyThresholds(
  mode: PingLatencyMode,
  customThresholds: PingLatencyThresholds,
  profileId: PingLatencyProfileId,
): PingLatencyThresholds {
  return mode === "custom" ? customThresholds : PING_LATENCY_PROFILES[profileId].thresholds;
}
