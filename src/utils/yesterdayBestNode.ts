import { getPingOverviewStats, getPublicPingTasks } from "@/services/api";
import type { PingTask, PingTaskStats, YesterdayBestDisplayMode, YesterdayBestScope } from "@/types/komari";
import { detectCarrier, type CarrierType } from "@/utils/carrierLoss";

export interface YesterdayBestNodeResult {
  date: string; // "YYYY-MM-DD"
  timestamp?: number;
  uuid: string;
  name?: string;
  score: number;
  avgLatency: number;
  avgLoss: number;
  cv: number;
  spikeRatio: number;
  p99?: number | null;
  sampleCount: number;
  taskCount?: number;
  scope?: YesterdayBestScope;
  isQualified?: boolean;
  missingCarriers?: CarrierType[];
  coveredCarriers?: CarrierType[];
}

export interface YesterdayLeaderboardItem extends YesterdayBestNodeResult {
  rank: number;
}

const DISPLAY_STORAGE_KEY = "komaritheme:yesterday-best-display";
const LEADERBOARD_STORAGE_KEY = "komaritheme:yesterday-leaderboard";
const CACHE_VERSION = 2;
const CACHE_TTL_MS = 30 * 60 * 1000; // 滚动 24H 缓存 TTL：30 分钟

function getStorageKey(base: string, scope: YesterdayBestScope, includeIpv6: boolean) {
  return `${base}:v${CACHE_VERSION}:${scope}:${includeIpv6 ? "dual" : "ipv4"}`;
}

function getCandidateKey(candidateUuids: string[]) {
  return JSON.stringify(candidateUuids);
}

export interface YesterdayBestDisplayCache {
  date: string;
  timestamp?: number;
  candidateKey: string;
  nodeIndexText: string;
  nodeName: string;
  score: number;
  avgLatency: number;
  avgLoss: number;
  scope?: YesterdayBestScope;
  mode?: YesterdayBestDisplayMode;
  sampleCount?: number;
}

/**
 * 获取当天本地日期字符串 (YYYY-MM-DD)，用于粗粒度按天缓存刷新。
 * 注意：返回的是当天日期（作为滚动 24h 缓存 key），而非"昨天"的日期。
 * 保留旧别名 `getYesterdayTimeWindow` 与旧字段 `yesterdayDateStr` 供外部兼容。
 */
export function getTodayCacheKey(now = Date.now()): {
  todayDateStr: string;
} {
  const d = new Date(now);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const todayDateStr = `${year}-${month}-${day}`;

  return {
    todayDateStr,
  };
}

/** @deprecated 使用 {@link getTodayCacheKey} 代替 */
export function getYesterdayTimeWindow(now = Date.now()): {
  yesterdayDateStr: string;
} {
  const { todayDateStr } = getTodayCacheKey(now);
  return { yesterdayDateStr: todayDateStr };
}

export interface YesterdayBestMetricsInput {
  loss: number;
  avg?: number | null;
  stddev?: number | null;
  p50?: number | null;
  p99?: number | null;
}

/**
 * 纯网络稳定性评分算法（科学平衡物理延迟与真实波动，杜绝“高延迟免死金牌”）：
 * 满分 100 分。针对公网 VPS、跨境优质优化路由（CN2/9929/CMIN2）与绕路普通路由（NTT/163）的
 * 真实网络质量分布进行科学裁决：
 *
 * 1. 丢包惩罚（最高扣 50 分，平滑分段曲线）：
 *    - loss = 0%：满分无惩罚；
 *    - 0% < loss <= 1%（微弱公网自然波动）：每 0.1% 扣 0.4 分（1% 时扣 4 分，保持 ~96 分极优）；
 *    - 1% < loss <= 5%（轻度公网拥塞/普通线路）：基础扣 4 分 + 每 1% 扣 2.5 分（5% 时累计扣 14 分，保持 ~86 分良好）；
 *    - 5% < loss <= 12%（中度拥塞/明显丢包偏科）：基础扣 14 分 + 每 1% 扣 2.3 分（10% 时累计扣 25.5 分，12% 扣 30.1 分）；
 *    - 12% < loss <= 25%（重度拥塞）：基础扣 30.1 分 + 精确系数 19.9/13 ≈ 1.5308/1%（25% 精确扣满 50 分）；
 *    - loss > 25%：严重丢包不可用，直接扣满 50 分。
 *
 * 2. 抖动与离散度惩罚（有效变异系数 + 绝对抖动保真，最高扣 30 分）：
 *    【痛点破除】：若直接使用 CV = stddev / avg，当机器因绕路等原因延迟高达 230ms+ 时，分母过大会产生
 *    “高延迟大分母保护伞”——哪怕全天处于 15ms~20ms 的剧烈锯齿状颠簸，CV 仍被稀释到 0.06，反而比延迟 150ms 且
 *    平直的精品优化线路分高，极不合理！
 *    因此引入：
 *    - 有效基准延迟分母：effAvg = min(max(avg, 60), 160)，把基准分母合理限制在 60ms ~ 160ms 区间；
 *    - 有效变异系数：cvEff = stddev / effAvg；
 *    - 绝对标准差安全阈值：若 stddev <= 4ms（平直如专线），即便 cvEff 稍大也豁免惩罚；
 *    - 阶梯扣分：
 *      - cvEff <= 0.05 或 stddev <= 4ms：0 扣分；
 *      - 0.05 < cvEff <= 0.15：扣 (cvEff - 0.05) * 60；
 *      - 0.15 < cvEff <= 0.35：扣 6 + (cvEff - 0.15) * 70；
 *      - cvEff > 0.35：扣 20 + min(10, (cvEff - 0.35) * 50)（最高扣满 30 分）。
 *
 * 3. 极端尖峰与晚高峰拥塞惩罚（尖峰比 Spike Ratio + 绝对突增量保护，最高扣 20 分）：
 *    - 基准 baseline = max(p50, avg)；
 *    - 绝对突增 delta = p99 - baseline；
 *    - 有效相对倍率：ratio = 1 + (delta / effAvg)；
 *    - 孤立噪点过滤：若 delta <= 8ms，视为合法采样噪点，0 扣分；
 *    - 阶梯扣分：
 *      - ratio <= 1.15：0 扣分；
 *      - 1.15 < ratio <= 1.50：扣 (ratio - 1.15) * 20（1.50 时扣 7 分）；
 *      - 1.50 < ratio <= 2.20：扣 7 + (ratio - 1.50) * 15；
 *      - ratio > 2.20：扣 17.5 + min(2.5, (ratio - 2.20) * 5)（最高扣满 20 分）。
 *
 * 得分范围归一化至 0 ~ 100 分，保留 1 位小数。
 */
export function calculateNodeNetworkScore(input: YesterdayBestMetricsInput | number, legacyLoss?: number): number {
  let loss = 0;
  let avg = 0;
  let stddev = 0;
  let p50 = 0;
  let p99 = 0;

  if (typeof input === "number") {
    // 兼容历史老调用签名: calculateNodeNetworkScore(avgLatency, avgLoss)
    avg = input;
    loss = legacyLoss ?? 0;
    stddev = avg * 0.08;
    p50 = avg;
    p99 = avg * 1.2;
  } else {
    loss = Number.isFinite(input.loss) ? Math.max(0, input.loss) : 0;
    avg = input.avg != null && Number.isFinite(input.avg) && input.avg > 0 ? input.avg : 0;
    stddev = input.stddev != null && Number.isFinite(input.stddev) && input.stddev >= 0 ? input.stddev : 0;
    p50 = input.p50 != null && Number.isFinite(input.p50) && input.p50 > 0 ? input.p50 : avg;
    p99 = input.p99 != null && Number.isFinite(input.p99) && input.p99 > 0 ? input.p99 : (avg > 0 ? avg * 1.2 : 0);
  }

  let score = 100;

  // 1. 丢包惩罚（平滑梯级，最高扣 50 分）
  if (loss > 0) {
    if (loss <= 1) {
      score -= (loss / 0.1) * 0.4; // 1% 时扣 4 分
    } else if (loss <= 5) {
      score -= 4 + (loss - 1) * 2.5; // 5% 时扣 14 分
    } else if (loss <= 12) {
      score -= 14 + (loss - 5) * 2.3; // 12% 时扣 30.1 分
    } else if (loss <= 25) {
      score -= 30.1 + (loss - 12) * (19.9 / 13); // 25% 时精确扣满 50 分
    } else {
      score -= 50; // > 25% 扣满 50 分
    }
  }

  // 科学平衡分母基准：限制在 60ms ~ 160ms 区间，消除“高延迟大分母保护伞”，同时保护美西直连与极低延迟节点不被微小抖动误伤
  const effAvg = avg > 0 ? Math.min(Math.max(avg, 60), 160) : 100;

  // 2. 抖动离散度惩罚（有效变异系数 cvEff，最高扣 30 分）
  if (avg > 0 && stddev > 0) {
    const cvEff = stddev / effAvg;
    // 若绝对标准差 <= 4ms（平直如专线，例如内网或高质量美西优化线），完全豁免抖动扣分
    if (cvEff > 0.05 && stddev > 4) {
      if (cvEff <= 0.15) {
        score -= (cvEff - 0.05) * 60; // 0.15 时扣 6 分
      } else if (cvEff <= 0.35) {
        score -= 6 + (cvEff - 0.15) * 70; // 0.35 时扣 20 分
      } else {
        score -= 20 + Math.min(10, (cvEff - 0.35) * 50); // 最高扣 30 分
      }
    }
  }

  // 3. 极端尖峰与晚高峰拥塞惩罚（最高扣 20 分）
  const baseline = Math.max(p50, avg);
  if (baseline > 0 && p99 > baseline) {
    const delta = p99 - baseline;
    // 若绝对突增量 <= 8ms（属于网络合理采样噪点/毛刺），完全豁免尖峰扣分
    if (delta > 8) {
      const ratio = 1 + (delta / effAvg);
      if (ratio > 1.15) {
        if (ratio <= 1.50) {
          score -= (ratio - 1.15) * 20; // 1.50 时扣 7 分
        } else if (ratio <= 2.20) {
          score -= 7 + (ratio - 1.50) * 15; // 2.20 时扣 17.5 分
        } else {
          score -= 17.5 + Math.min(2.5, (ratio - 2.20) * 5); // 最高扣 20 分
        }
      }
    }
  }

  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

/**
 * 清除旧的昨日最佳 localStorage 缓存
 */
export function clearYesterdayBestNodeCache(): void {
  // 保持空实现
}

/**
 * 从 LocalStorage 读取当前日期的昨日最佳缓存（已弃用持久化，直接走内存）
 */
export function getYesterdayBestNodeCache(
  _candidateUuids?: string[],
  _scopeOrNow: YesterdayBestScope | number = "tri",
  _maybeNow = Date.now(),
): YesterdayBestNodeResult | null {
  return null;
}

/**
 * 保存昨日最佳计算结果到 LocalStorage（已弃用持久化，直接走内存）
 */
export function setYesterdayBestNodeCache(
  _result: YesterdayBestNodeResult,
  _candidateUuids?: string[],
  _scope: YesterdayBestScope = "tri",
): void {
  // 空实现，不落盘 localStorage
}

/**
 * 读取昨日最佳卡片在首屏直接展示的本地缓存，保障首屏 0ms 瞬间回显，绝无横线占位符。
 * 具备完备的字段防御与安全校验，一旦数据有任何损坏或缺失静默返回 null，绝不会引发崩溃。
 */
export function getYesterdayBestDisplayCache(
  candidateUuidsOrScopeOrNow?: string[] | YesterdayBestScope | number,
  scopeOrNow: YesterdayBestScope | number = "tri",
  maybeNow = Date.now(),
  includeIpv6 = false,
  mode?: YesterdayBestDisplayMode,
): YesterdayBestDisplayCache | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    let candidateUuids: string[] | undefined;
    let scope: YesterdayBestScope = "tri";
    let now: number = Date.now();

    if (Array.isArray(candidateUuidsOrScopeOrNow)) {
      candidateUuids = candidateUuidsOrScopeOrNow;
      scope = typeof scopeOrNow === "string" ? scopeOrNow : "tri";
      now = typeof scopeOrNow === "number" ? scopeOrNow : maybeNow;
    } else if (typeof candidateUuidsOrScopeOrNow === "string") {
      scope = candidateUuidsOrScopeOrNow;
      now = typeof scopeOrNow === "number" ? scopeOrNow : maybeNow;
    } else if (typeof candidateUuidsOrScopeOrNow === "number") {
      now = candidateUuidsOrScopeOrNow;
      scope = typeof scopeOrNow === "string" ? scopeOrNow : "tri";
    }

    const raw = window.localStorage.getItem(getStorageKey(DISPLAY_STORAGE_KEY, scope, includeIpv6));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as YesterdayBestDisplayCache;
    const { todayDateStr } = getTodayCacheKey(now);

    // 核心安全校验：类型与必填字段必须合法，日期必须吻合，绝不让脏结构穿透
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.date === todayDateStr &&
      typeof parsed.timestamp === "number" &&
      now - parsed.timestamp < CACHE_TTL_MS &&
      (mode === undefined || parsed.mode === mode) &&
      typeof parsed.score === "number" &&
      Number.isFinite(parsed.score) &&
      typeof parsed.nodeName === "string" &&
      typeof parsed.nodeIndexText === "string"
    ) {
      if (candidateUuids !== undefined && parsed.candidateKey !== getCandidateKey(candidateUuids)) {
        return null;
      }
      return parsed;
    }
  } catch {
    // 忽略异常，安全降级
  }
  return null;
}

/**
 * 写入昨日最佳卡片的首屏展示缓存到 localStorage
 */
export function setYesterdayBestDisplayCache(
  display: {
    nodeIndexText: string;
    nodeName: string;
    score: number;
    avgLatency: number;
    avgLoss: number;
    scope?: YesterdayBestScope;
    mode?: YesterdayBestDisplayMode;
    sampleCount?: number;
  },
  candidateUuids?: string[],
  scopeOrNow: YesterdayBestScope | number = "tri",
  maybeNow = Date.now(),
  includeIpv6 = false,
): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const scope: YesterdayBestScope = typeof scopeOrNow === "string"
      ? scopeOrNow
      : (display.scope || "tri");
    const now: number = typeof scopeOrNow === "number" ? scopeOrNow : maybeNow;
    const { todayDateStr } = getTodayCacheKey(now);
    const candidateKey = candidateUuids ? getCandidateKey(candidateUuids) : "";
    const data: YesterdayBestDisplayCache = {
      date: todayDateStr,
      timestamp: now,
      candidateKey,
      scope,
      ...display,
    };
    window.localStorage.setItem(getStorageKey(DISPLAY_STORAGE_KEY, scope, includeIpv6), JSON.stringify(data));
  } catch {
    // 忽略写入异常
  }
}

/**
 * 清除昨日最佳卡片的首屏展示缓存与内存缓存
 */
export function clearYesterdayBestDisplayCache(scope?: YesterdayBestScope): void {
  memoryBestCache.clear();
  inflightRequests.clear();

  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const scopes: YesterdayBestScope[] = scope ? [scope] : ["tri", "ct", "cu", "cm", "all"];
    for (const base of [DISPLAY_STORAGE_KEY, LEADERBOARD_STORAGE_KEY]) {
      if (!scope) window.localStorage.removeItem(base);
      for (const value of scopes) {
        window.localStorage.removeItem(`${base}:${value}`);
        window.localStorage.removeItem(getStorageKey(base, value, false));
        window.localStorage.removeItem(getStorageKey(base, value, true));
      }
    }
  } catch {
    // 忽略异常
  }
}

/**
 * 获取天梯榜持久化缓存
 */
export function getYesterdayLeaderboardCache(
  scopeOrNow: YesterdayBestScope | number = "tri",
  maybeNow = Date.now(),
  includeIpv6 = false,
  candidateUuids?: string[],
): YesterdayLeaderboardItem[] | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const scope: YesterdayBestScope = typeof scopeOrNow === "string" ? scopeOrNow : "tri";
    const now: number = typeof scopeOrNow === "number" ? scopeOrNow : maybeNow;
    const raw = window.localStorage.getItem(getStorageKey(LEADERBOARD_STORAGE_KEY, scope, includeIpv6));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const { todayDateStr } = getTodayCacheKey(now);
    if (
      parsed &&
      parsed.date === todayDateStr &&
      typeof parsed.timestamp === "number" &&
      now - parsed.timestamp < CACHE_TTL_MS &&
      Array.isArray(parsed.leaderboard) &&
      (candidateUuids === undefined || parsed.candidateKey === getCandidateKey(candidateUuids))
    ) {
      return parsed.leaderboard;
    }
  } catch {
    // 忽略异常
  }
  return null;
}

/**
 * 写入天梯榜持久化缓存
 */
export function setYesterdayLeaderboardCache(
  leaderboard: YesterdayLeaderboardItem[],
  scopeOrNow: YesterdayBestScope | number = "tri",
  maybeNow = Date.now(),
  includeIpv6 = false,
  candidateUuids?: string[],
): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const scope: YesterdayBestScope = typeof scopeOrNow === "string" ? scopeOrNow : "tri";
    const now: number = typeof scopeOrNow === "number" ? scopeOrNow : maybeNow;
    const { todayDateStr } = getTodayCacheKey(now);
    window.localStorage.setItem(getStorageKey(LEADERBOARD_STORAGE_KEY, scope, includeIpv6), JSON.stringify({
      date: todayDateStr,
      timestamp: now,
      leaderboard,
      candidateKey: candidateUuids ? getCandidateKey(candidateUuids) : undefined,
    }));
  } catch {
    // 忽略写入异常
  }
}

export interface YesterdayLeaderboardResult {
  best: YesterdayBestNodeResult | null;
  leaderboard: YesterdayLeaderboardItem[];
}

interface YesterdayLeaderboardOptions {
  signal?: AbortSignal;
  now?: number;
  tasksOverride?: number[];
  scope?: YesterdayBestScope;
  includeIpv6?: boolean;
}

// 每个赛道和协议组合只保留最近一次的候选集结果。
const memoryBestCache = new Map<string, {
  requestKey: string;
  timestamp: number;
  result: YesterdayLeaderboardResult;
}>();
const inflightRequests = new Map<string, Promise<YesterdayLeaderboardResult>>();

export function getMemoryYesterdayLeaderboardResult(
  candidateUuids: string[],
  { scope = "tri", includeIpv6 = false, now = Date.now() }: Pick<YesterdayLeaderboardOptions, "scope" | "includeIpv6" | "now"> = {},
): YesterdayLeaderboardResult | undefined {
  const { yesterdayDateStr } = getYesterdayTimeWindow(now);
  const entry = memoryBestCache.get(`${scope}:${includeIpv6}`);
  if (entry?.requestKey === `${yesterdayDateStr}:${getCandidateKey(candidateUuids)}` && now - entry.timestamp < CACHE_TTL_MS) {
    return entry.result;
  }
  return undefined;
}

function detectPingTaskFamily(task: PingTask, name: string): 4 | 6 {
  for (const value of [
    task.ip_version, task.ipVersion, task.address_family, task.addressFamily,
    task.ip_family, task.ipFamily, task.family,
  ]) {
    if (typeof value !== "string" && typeof value !== "number") continue;
    const family = String(value).trim().toLowerCase();
    if (/^(?:6|ipv?6|v6|(?:af[_-]?)?inet6)$/.test(family)) return 6;
    if (/^(?:4|ipv?4|v4|(?:af[_-]?)?inet4?)$/.test(family)) return 4;
  }

  const target = task.target.trim();
  if (target) {
    // URL 的主机名解析能区分 IP 字面量和普通域名加端口。
    const url = target.includes("://") ? target : `http://${target}`;
    for (const candidate of target.includes(":") ? [url, `http://[${target}]`] : [url]) {
      try {
        const { hostname } = new URL(candidate);
        if (hostname.startsWith("[")) return 6;
        if (/^\d+(?:\.\d+){3}$/.test(hostname)) return 4;
        break;
      } catch {
        // 裸 IPv6 地址需要加方括号后再解析。
      }
    }
  }

  const type = /^(?:icmp|ping|tcp|udp|https?)[-_ ]?(?:ipv?|v)?([46])$/i.exec(task.type.trim());
  if (type) return type[1] === "6" ? 6 : 4;

  // Komari 的公开任务可省略目标地址，使用任务名中的独立协议标记。
  return /(?:^|[^a-z0-9])(?:ip[-_ ]?v?|v)6(?![a-z0-9])/i.test(name) ? 6 : 4;
}

/**
 * 计算选定节点列表中的昨日表现最佳节点以及完整天梯榜单
 */
export async function calculateYesterdayBestLeaderboard(
  candidateUuids: string[],
  options?: YesterdayLeaderboardOptions,
): Promise<YesterdayLeaderboardResult> {
  const now = options?.now ?? Date.now();
  const { yesterdayDateStr } = getYesterdayTimeWindow(now);
  const scope: YesterdayBestScope = options?.scope ?? "tri";
  const includeIpv6 = options?.includeIpv6 === true;
  const hasTaskOverride = Boolean(options?.tasksOverride?.length);
  const cached = !hasTaskOverride && getMemoryYesterdayLeaderboardResult(candidateUuids, { scope, includeIpv6, now });
  if (cached) return cached;

  const selectionKey = `${scope}:${includeIpv6}`;
  const requestKey = `${yesterdayDateStr}:${getCandidateKey(candidateUuids)}`;
  const inflightKey = `${selectionKey}:${requestKey}:${JSON.stringify(options?.tasksOverride ?? [])}`;
  const inflight = inflightRequests.get(inflightKey);
  if (inflight) return inflight;

  const promise = (async () => {
    // 1. 获取任务列表并识别运营商，根据 scope 筛选出合规的任务集合
    let publicTasks: PingTask[] = [];
    try {
      publicTasks = await getPublicPingTasks({ signal: options?.signal });
    } catch (error) {
      if (options?.signal?.aborted) throw error;
    }

    const taskCarrierMap = new Map<number, CarrierType>();
    const excludedTaskIds = new Set<number>();
    const targetTaskSet = new Set<number>();

    for (const t of publicTasks) {
      if (!Number.isInteger(t.id) || t.id <= 0) continue;
      // 兼容 CTv6、CUIPv6 等紧凑命名，同时保留运营商缩写的单词边界。
      const name = t.name.replace(/\b(ct|cu|cm)(?=(?:ip[-_ ]?v?|v)[46](?![a-z0-9]))/gi, "$1-");
      if (!includeIpv6 && detectPingTaskFamily(t, name) === 6) {
        excludedTaskIds.add(t.id);
        continue;
      }
      const carrier = detectCarrier(name);
      taskCarrierMap.set(t.id, carrier);
      if (scope === "all" || scope === carrier || (scope === "tri" && carrier !== "unknown")) {
        targetTaskSet.add(t.id);
      }
    }

    const allowedTaskSet = options?.tasksOverride?.length
      ? new Set(options.tasksOverride.filter((id) => Number.isInteger(id) && id > 0 && !excludedTaskIds.has(id)))
      : targetTaskSet;

    // 2. 直接单次请求近 24 小时饱满统计数据 (hours: 24)
    // 探针后端物理保留 24 小时时序，直接获取饱满的 1440 个采样点（~7KB 极速加载）
    // 配合多线路组内方差加权 (Within-group Pooled Variance)，既杜绝了历史差分因下午老数据滚出导致的
    // 样本缩水与漂移，又不会因三网路由天然延迟落差而误伤平直稳定的节点！
    let statsTotal: PingTaskStats[] = [];
    if (allowedTaskSet.size > 0) {
      try {
        statsTotal = await getPingOverviewStats(24, [...allowedTaskSet], {
          entityIds: candidateUuids,
          signal: options?.signal,
        });
      } catch (error) {
        if (options?.signal?.aborted) throw error;
      }
    }

    if (!statsTotal || statsTotal.length === 0) {
      return { best: null, leaderboard: [] };
    }

    // 3. 按 uuid 汇聚每个节点的平均延迟、丢包率、抖动方差与尖峰
    interface TaskPureItem {
      taskId: number;
      carrier?: CarrierType;
      valid: number;
      avg: number;
      stddev: number;
      loss: number;
      p50: number;
      p99: number;
    }

    interface NodeAgg {
      uuid: string;
      tasks: Set<number>;
      coveredCarriers: Set<CarrierType>;
      items: TaskPureItem[];
    }

    const map = new Map<string, NodeAgg>();
    const candidateSet = new Set(candidateUuids); // P7: O(1) 查找替代 O(n) includes

    for (const s of statsTotal) {
      if (!candidateSet.has(s.client)) continue;
      // 严格剥离不属于当前 scope 答卷范围的任务
      if (!allowedTaskSet.has(s.taskId)) continue;

      let agg = map.get(s.client);
      if (!agg) {
        agg = {
          uuid: s.client,
          tasks: new Set<number>(),
          coveredCarriers: new Set<CarrierType>(),
          items: [],
        };
        map.set(s.client, agg);
      }

      agg.tasks.add(s.taskId);
      const carrier = taskCarrierMap.get(s.taskId);
      if (carrier && carrier !== "unknown") {
        agg.coveredCarriers.add(carrier);
      }

      const pureAvg = s.avg ?? 0;
      const pureLoss = s.loss ?? 0;
      const pureP50 = s.p50 ?? pureAvg;
      const pureP99 = s.p99 ?? (pureAvg > 0 ? pureAvg * 1.2 : 0);
      const pureStddev = s.stddev ?? 0;
      const pureSamples = s.valid || s.total || 0;

      agg.items.push({
        taskId: s.taskId,
        carrier,
        valid: pureSamples,
        avg: pureAvg,
        stddev: pureStddev,
        loss: pureLoss,
        p50: pureP50,
        p99: pureP99,
      });
    }

    const calculatedList: YesterdayBestNodeResult[] = [];

    for (const [uuid, agg] of map.entries()) {
      if (agg.items.length === 0) continue;

      // 统计学严格的多任务样本加权聚合
      const totalValid = agg.items.reduce((acc, it) => acc + Math.max(1, it.valid), 0);
      const avgLatency = agg.items.reduce((acc, it) => acc + Math.max(1, it.valid) * it.avg, 0) / totalValid;
      // 丢包率采用平等权重（各有效线路算术平均），绝对杜绝中途解绑或炸线导致的样本稀释作弊！
      // 若按 valid 加权，当某条线路被解绑或严重丢包导致有效包极少时，其高丢包率会被直接稀释抹除。
      const avgLoss = agg.items.reduce((acc, it) => acc + it.loss, 0) / agg.items.length;

      // P1: 组内方差加权平均（Within-group Pooled Variance），而非全局方差展开
      // 全局 Var(X) = E[X²]-(E[X])² 会把三网物理路由天然延迟落差（组间方差）
      // 误计为网络抖动，导致路由差异大但各线路自身平直的节点被严重误伤。
      // 正确做法：只惩罚每条线路自身的波动（组内方差），三网路由落差不应计入抖动。
      const withinVariance = agg.items.reduce((acc, it) => acc + Math.max(1, it.valid) * (it.stddev ** 2), 0) / totalValid;
      const withinStddev = Math.sqrt(withinVariance);
      const cv = avgLatency > 0 ? withinStddev / avgLatency : 0;

      // P6: P50 采用各线路 P50 的样本加权平均（而非用 avgLatency 替代），
      // 保留延迟分布偏态信息，使尖峰比计算更准确
      const weightedP50 = agg.items.reduce((acc, it) => acc + Math.max(1, it.valid) * it.p50, 0) / totalValid;

      // 晚高峰 P99 采用木桶最短板（各线路最高峰值 P99），真实暴露晚高峰最差线路的劣化
      const maxP99 = Math.max(...agg.items.map((it) => it.p99));
      const baseline = avgLatency;
      const spikeRatio = baseline > 0 ? maxP99 / baseline : 1;

      const score = calculateNodeNetworkScore({
        loss: avgLoss,
        avg: avgLatency,
        stddev: withinStddev,
        p50: weightedP50,
        p99: maxP99,
      });

      // 资格与防缺考偷塔判定
      let isQualified = true;
      const missingCarriers: CarrierType[] = [];
      const coveredCarriers = Array.from(agg.coveredCarriers);

      if (scope === "tri") {
        if (!agg.coveredCarriers.has("ct")) missingCarriers.push("ct");
        if (!agg.coveredCarriers.has("cu")) missingCarriers.push("cu");
        if (!agg.coveredCarriers.has("cm")) missingCarriers.push("cm");
        isQualified = missingCarriers.length === 0;
      } else if (scope === "ct") {
        isQualified = agg.coveredCarriers.has("ct");
        if (!isQualified) missingCarriers.push("ct");
      } else if (scope === "cu") {
        isQualified = agg.coveredCarriers.has("cu");
        if (!isQualified) missingCarriers.push("cu");
      } else if (scope === "cm") {
        isQualified = agg.coveredCarriers.has("cm");
        if (!isQualified) missingCarriers.push("cm");
      } else {
        isQualified = true;
      }

      calculatedList.push({
        date: yesterdayDateStr,
        uuid,
        score,
        avgLatency: Math.round(avgLatency * 10) / 10,
        avgLoss: Math.round(avgLoss * 10) / 10,
        cv: Math.round(cv * 1000) / 1000,
        spikeRatio: Math.round(spikeRatio * 100) / 100,
        p99: Math.round(maxP99 * 10) / 10,
        sampleCount: totalValid,
        taskCount: agg.tasks.size > 0 ? agg.tasks.size : agg.items.length,
        scope,
        isQualified,
        missingCarriers,
        coveredCarriers,
      });
    }

    // 4. 决胜链（Tie-breaking Chain）排序（资格绝对优先，防缺考偷塔！）：
    calculatedList.sort((a, b) => {
      // 0) 资格优先：合格未缺考节点排在前面，缺考节点排在后面！
      const qA = a.isQualified ? 1 : 0;
      const qB = b.isQualified ? 1 : 0;
      if (qB !== qA) return qB - qA;

      // 1) 稳定性得分最高 (降序)
      if (b.score !== a.score) return b.score - a.score;
      // 2) 抖动变异系数 CV 最低 (升序)
      if (Math.abs(a.cv - b.cv) > 0.0001) return a.cv - b.cv;
      // 3) 晚高峰尖峰比 spikeRatio 最低 (升序)
      if (Math.abs(a.spikeRatio - b.spikeRatio) > 0.01) return a.spikeRatio - b.spikeRatio;
      // 4) 平均物理延迟最低 (升序)
      if (Math.abs(a.avgLatency - b.avgLatency) > 0.1) return a.avgLatency - b.avgLatency;
      const idxA = candidateUuids.indexOf(a.uuid);
      const idxB = candidateUuids.indexOf(b.uuid);
      return idxA - idxB;
    });

    const leaderboard: YesterdayLeaderboardItem[] = calculatedList.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    // 只有合格未缺考的节点，才有资格当选昨日最佳总冠军！
    const bestNode = leaderboard.find((item) => item.isQualified) || null;

    return { best: bestNode, leaderboard };
  })();

  inflightRequests.set(inflightKey, promise);

  try {
    const result = await promise;
    if (!hasTaskOverride && !options?.signal?.aborted && inflightRequests.get(inflightKey) === promise) {
      memoryBestCache.set(selectionKey, { requestKey, timestamp: now, result });
      setYesterdayLeaderboardCache(result.leaderboard, scope, now, includeIpv6, candidateUuids);
    }
    return result;
  } finally {
    if (inflightRequests.get(inflightKey) === promise) {
      inflightRequests.delete(inflightKey);
    }
  }
}

export interface YesterdayAverageResult {
  score: number;
  avgLatency: number;
  avgLoss: number;
  nodeCount: number;
  qualifiedCount: number;
}

/**
 * 从天梯榜中计算参评节点的综合平均分数（反映集群整体健康度大盘基线）
 * 优先计算具备评分资格的节点平均值；若均未齐备则计算全量参评节点的平均值。
 */
export function calculateYesterdayAverageScore(
  leaderboard: YesterdayLeaderboardItem[],
): YesterdayAverageResult | null {
  if (!leaderboard || leaderboard.length === 0) return null;
  const qualifiedList = leaderboard.filter((item) => item.isQualified);
  const targetList = qualifiedList.length > 0 ? qualifiedList : leaderboard;

  const totalScore = targetList.reduce((acc, cur) => acc + cur.score, 0);
  const totalLatency = targetList.reduce((acc, cur) => acc + cur.avgLatency, 0);
  const totalLoss = targetList.reduce((acc, cur) => acc + cur.avgLoss, 0);
  const count = targetList.length;

  return {
    score: Number((totalScore / count).toFixed(1)),
    avgLatency: Number((totalLatency / count).toFixed(1)),
    avgLoss: Number((totalLoss / count).toFixed(2)),
    nodeCount: count,
    qualifiedCount: qualifiedList.length,
  };
}

/**
 * 计算选定节点列表中的昨日表现最佳节点
 */
export async function calculateYesterdayBestNode(
  candidateUuids: string[],
  options?: YesterdayLeaderboardOptions,
): Promise<YesterdayBestNodeResult | null> {
  const result = await calculateYesterdayBestLeaderboard(candidateUuids, options);
  return result.best;
}

