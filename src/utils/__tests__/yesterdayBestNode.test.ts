import { describe, expect, it, vi, beforeEach } from "vitest";
import { getPingOverviewStats, getPublicPingTasks } from "@/services/api";
import { PingTaskSchema, type PingTaskStats } from "@/types/komari";
import {
  getYesterdayTimeWindow,
  calculateNodeNetworkScore,
  getYesterdayBestDisplayCache,
  setYesterdayBestDisplayCache,
  clearYesterdayBestDisplayCache,
  getYesterdayLeaderboardCache,
  setYesterdayLeaderboardCache,
  calculateYesterdayAverageScore,
  calculateYesterdayBestLeaderboard,
  getMemoryYesterdayLeaderboardResult,
} from "../yesterdayBestNode";

vi.mock("@/services/api", () => ({
  getPublicPingTasks: vi.fn(),
  getPingOverviewStats: vi.fn(),
}));

const scoreNow = new Date(2026, 10, 19, 15).getTime();

function scoreStat(taskId: number, client = "node-a", loss = 0): PingTaskStats {
  return {
    taskId, client, loss, avg: 100, p50: 100, p99: 100, stddev: 0,
    name: "", type: "icmp", interval: 60, total: 100, valid: 100,
    min: 100, max: 100, latest: 100, p99P50Ratio: 1,
  };
}

describe("yesterdayBestNode utils", () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    const localStorageMock = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
    vi.stubGlobal("window", { localStorage: localStorageMock });
    vi.stubGlobal("localStorage", localStorageMock);
    clearYesterdayBestDisplayCache();
    vi.resetAllMocks();
  });

  it("calculates window date string accurately", () => {
    // 假设当前时间是 2026-11-08 14:30:00 (本地时间)
    const fixedNow = new Date(2026, 10, 8, 14, 30, 0).getTime();
    const windowInfo = getYesterdayTimeWindow(fixedNow);

    expect(windowInfo.yesterdayDateStr).toBe("2026-11-08");
  });

  it("calculates network performance score based on pure stability (loss, jitter CV, spike ratio)", () => {
    // 1. 亚太节点（低延迟 20ms）完美平稳零丢包：100 分
    const scoreApacPerfect = calculateNodeNetworkScore({
      loss: 0,
      avg: 20,
      stddev: 0.8, // CV = 0.04 <= 0.05
      p50: 20,
      p99: 22, // ratio = 1.1 <= 1.15
    });
    expect(scoreApacPerfect).toBe(100);

    // 2. 美西节点（高延迟 160ms）同样完美平稳零丢包：同样是 100 分满分，排除物理距离歧视
    const scoreUsPerfect = calculateNodeNetworkScore({
      loss: 0,
      avg: 160,
      stddev: 6.4, // CV = 0.04 <= 0.05
      p50: 160,
      p99: 176, // ratio = 1.1 <= 1.15
    });
    expect(scoreUsPerfect).toBe(100);

    // 3. 轻微公网自然抖动与丢包 0.5%：仅扣 2 分，得分 98 分（仍属于极优）
    const scoreLightLoss = calculateNodeNetworkScore({
      loss: 0.5,
      avg: 20,
      stddev: 0.5,
      p50: 20,
      p99: 22,
    });
    expect(scoreLightLoss).toBe(98);

    // 4. 普通公网中度丢包 5%：处于良好区间，得分 ~86 分，不再像旧算法一样腰斩
    const scoreModerateLoss = calculateNodeNetworkScore({
      loss: 5,
      avg: 20,
      stddev: 0.5,
      p50: 20,
      p99: 22,
    });
    expect(scoreModerateLoss).toBe(86);

    // 5. 严重丢包 30%：扣满 50 分
    const scoreSevereLoss = calculateNodeNetworkScore({
      loss: 30,
      avg: 20,
      stddev: 0.5,
      p50: 20,
      p99: 22,
    });
    expect(scoreSevereLoss).toBe(50);

    // 6. 核心公平性裁决（彻底消除高延迟大分母保护伞）：
    // US·Pro-VMS（CN2 GIA/9929/CMIN2 直连优化，156ms，平直极稳，stddev=3.2ms，p99=175ms，loss=0%）
    const scoreProVms = calculateNodeNetworkScore({
      loss: 0,
      avg: 156,
      stddev: 3.2,
      p50: 156,
      p99: 175,
    });

    // US·Max-NTT（联通绕路 231ms，全天锯齿剧烈颠簸，stddev=15.8ms，p99=268ms，移动丢包 0.5%）
    const scoreMaxNtt = calculateNodeNetworkScore({
      loss: 0.5,
      avg: 231,
      stddev: 15.8,
      p50: 230,
      p99: 268,
    });

    // 科学断言：平直平稳的精品优化线路（US·Pro-VMS）必须显著高于绕路心电图抖动线路（US·Max-NTT）
    expect(scoreProVms).toBeGreaterThan(scoreMaxNtt);
    expect(scoreProVms).toBeGreaterThanOrEqual(98.0);
    expect(scoreMaxNtt).toBeLessThan(94.0);
  });

  it("persists display cache for 0ms initial render with safe validation", () => {
    const fixedNow = new Date(2026, 10, 8, 14, 30, 0).getTime();
    const display = {
      nodeIndexText: "#1",
      nodeName: "US•Pro-VMR",
      score: 99.9,
      avgLatency: 28.4,
      avgLoss: 0,
    };

    setYesterdayBestDisplayCache(display, ["uuid-1", "uuid-2"], "tri", fixedNow);
    const cached = getYesterdayBestDisplayCache(["uuid-1", "uuid-2"], "tri", fixedNow);
    expect(cached).not.toBeNull();
    expect(cached?.nodeIndexText).toBe("#1");
    expect(cached?.nodeName).toBe("US•Pro-VMR");
    expect(cached?.score).toBe(99.9);

    clearYesterdayBestDisplayCache();
    expect(getYesterdayBestDisplayCache(["uuid-1", "uuid-2"], "tri", fixedNow)).toBeNull();
  });

  it("safely restores leaderboard cache from localStorage", () => {
    const fixedNow = new Date(2026, 10, 8, 14, 30, 0).getTime();
    const leaderboard = [
      {
        date: "2026-11-08",
        uuid: "uuid-1",
        score: 99.9,
        avgLatency: 28.4,
        avgLoss: 0,
        cv: 0.02,
        spikeRatio: 1.05,
        sampleCount: 1440,
        rank: 1,
      },
    ];

    setYesterdayLeaderboardCache(leaderboard, "tri", fixedNow);
    const cached = getYesterdayLeaderboardCache("tri", fixedNow);
    expect(cached).toHaveLength(1);
    expect(cached?.[0].uuid).toBe("uuid-1");
    expect(cached?.[0].rank).toBe(1);
  });

  it("keeps IPv4 and dual-stack display and leaderboard caches independent and skips old mixed entries", () => {
    const nodes = ["node-a"];
    const v4Display = { nodeIndexText: "#1", nodeName: "Node A", score: 100, avgLatency: 100, avgLoss: 0 };
    const dualDisplay = { ...v4Display, score: 50, avgLoss: 50 };
    const v4Board = [{ ...scoreStat(1), ...v4Display, uuid: "node-a", date: "2026-11-19", cv: 0, spikeRatio: 1, sampleCount: 100, rank: 1 }];
    store["komaritheme:yesterday-best-display:tri"] = JSON.stringify({ ...dualDisplay, date: "2026-11-19", candidateKey: "node-a" });
    store["komaritheme:yesterday-leaderboard:tri"] = JSON.stringify({ leaderboard: v4Board, date: "2026-11-19" });

    expect(getYesterdayBestDisplayCache(nodes, "tri", scoreNow)).toBeNull();
    expect(getYesterdayLeaderboardCache("tri", scoreNow)).toBeNull();

    setYesterdayBestDisplayCache(v4Display, nodes, "tri", scoreNow);
    setYesterdayLeaderboardCache(v4Board, "tri", scoreNow, false, nodes);
    expect(getYesterdayBestDisplayCache(nodes, "tri", scoreNow, true)).toBeNull();
    expect(getYesterdayLeaderboardCache("tri", scoreNow, true, nodes)).toBeNull();

    setYesterdayBestDisplayCache(dualDisplay, nodes, "tri", scoreNow, true);
    expect(getYesterdayBestDisplayCache(nodes, "tri", scoreNow, true)?.score).toBe(50);
    expect(getYesterdayBestDisplayCache(nodes, "tri", scoreNow)?.score).toBe(100);
    expect(getYesterdayLeaderboardCache("tri", scoreNow, false, ["node-b"])).toBeNull();
  });

  it("filters each scoring track by protocol before requesting 24h stats and qualifying nodes", async () => {
    vi.mocked(getPublicPingTasks).mockResolvedValue([
      { id: 11, name: "电信" },
      { id: 12, name: "联通-IPv4" },
      { id: 13, name: "移动" },
      { id: 21, name: "电信-IPv6" },
      { id: 22, name: "CUIPv6" },
      { id: 23, name: "移动v6" },
      { id: 31, name: "教育网", target: "https://[2001:db8::1]:8443/ping" },
      { id: 32, name: "海外", target: "2001:db8::2" },
      { id: 33, name: "海外", type: "icmp6" },
      { id: 34, name: "海外", address_family: "AF_INET6" },
      { id: 35, name: "海外 SRv6", target: "host.example:443" },
      { id: 36, name: "海外 [IPv6]", ip_version: 4 },
      { id: 37, name: "海外 [IPv6]", target: "http://192.0.2.8:8080/ping" },
    ].map((task) => PingTaskSchema.parse(task)));
    vi.mocked(getPingOverviewStats).mockResolvedValue([
      ...[11, 12, 13, 21, 22, 23, 31, 32, 33, 34, 35, 36, 37].map((id) => scoreStat(id, "node-a", id >= 21 && id <= 34 ? 100 : 0)),
      ...[11, 12, 23].map((id) => scoreStat(id, "node-b")),
      scoreStat(999, "node-a", 100),
      scoreStat(11, "outside-candidates"),
    ]);
    const candidates = ["node-a", "node-b"];
    const ipv4 = await calculateYesterdayBestLeaderboard(candidates, { now: scoreNow });
    expect(getPingOverviewStats).toHaveBeenLastCalledWith(24, [11, 12, 13], { entityIds: candidates, signal: undefined });
    expect(ipv4.best).toMatchObject({ uuid: "node-a", score: 100, taskCount: 3 });
    expect(ipv4.leaderboard[1]).toMatchObject({ uuid: "node-b", isQualified: false, missingCarriers: ["cm"] });

    const dual = await calculateYesterdayBestLeaderboard(candidates, { now: scoreNow, includeIpv6: true });
    expect(getPingOverviewStats).toHaveBeenLastCalledWith(24, [11, 12, 13, 21, 22, 23], expect.anything());
    expect(dual.best).toMatchObject({ uuid: "node-b", isQualified: true });
    expect(dual.leaderboard[1]).toMatchObject({ uuid: "node-a", score: 50, taskCount: 6 });

    await calculateYesterdayBestLeaderboard(candidates, { now: scoreNow, scope: "ct" });
    expect(getPingOverviewStats).toHaveBeenLastCalledWith(24, [11], expect.anything());
    await calculateYesterdayBestLeaderboard(candidates, { now: scoreNow, scope: "ct", includeIpv6: true });
    expect(getPingOverviewStats).toHaveBeenLastCalledWith(24, [11, 21], expect.anything());
    await calculateYesterdayBestLeaderboard(candidates, { now: scoreNow, scope: "all" });
    expect(getPingOverviewStats).toHaveBeenLastCalledWith(24, [11, 12, 13, 35, 36, 37], expect.anything());
    await calculateYesterdayBestLeaderboard(candidates, { now: scoreNow, scope: "all", includeIpv6: true });
    expect(getPingOverviewStats).toHaveBeenLastCalledWith(24, [11, 12, 13, 21, 22, 23, 31, 32, 33, 34, 35, 36, 37], expect.anything());
  });

  it("skips the stats call when the only public tasks are IPv6 and the switch is off", async () => {
    vi.mocked(getPublicPingTasks).mockResolvedValue([PingTaskSchema.parse({ id: 21, name: "电信-IPv6" })]);
    const result = await calculateYesterdayBestLeaderboard(["node-a"], { now: scoreNow, scope: "ct" });
    expect(result).toEqual({ best: null, leaderboard: [] });
    expect(getPingOverviewStats).not.toHaveBeenCalled();
  });

  it("deduplicates in-flight requests within a protocol without reusing the other protocol outcome", async () => {
    vi.mocked(getPublicPingTasks).mockResolvedValue([
      PingTaskSchema.parse({ id: 11, name: "电信" }),
      PingTaskSchema.parse({ id: 21, name: "电信-IPv6" }),
    ]);
    let releaseIpv4!: (stats: PingTaskStats[]) => void;
    const ipv4Stats = new Promise<PingTaskStats[]>((resolve) => {
      releaseIpv4 = resolve;
    });
    vi.mocked(getPingOverviewStats).mockImplementation((_hours, ids) => (
      ids.includes(21) ? Promise.resolve([scoreStat(11), scoreStat(21, "node-a", 100)]) : ipv4Stats
    ));
    const candidates = ["node-a"];
    const options = { now: scoreNow, scope: "ct" as const };
    const ipv4 = calculateYesterdayBestLeaderboard(candidates, options);
    const dual = calculateYesterdayBestLeaderboard(candidates, { ...options, includeIpv6: true });
    const sameIpv4 = calculateYesterdayBestLeaderboard(candidates, options);

    expect((await dual).best?.score).toBe(50);
    releaseIpv4([scoreStat(11)]);
    expect((await ipv4).best?.score).toBe(100);
    expect(await sameIpv4).toBe(await ipv4);
    expect(getPingOverviewStats).toHaveBeenCalledTimes(2);
    expect(getMemoryYesterdayLeaderboardResult(candidates, options)?.best?.score).toBe(100);
    expect(getMemoryYesterdayLeaderboardResult(candidates, { ...options, includeIpv6: true })?.best?.score).toBe(50);
  });

  it("safely ignores malformed or corrupt cache without crashing", () => {
    const fixedNow = new Date(2026, 10, 8, 14, 30, 0).getTime();
    store["komaritheme:yesterday-best-display:tri"] = JSON.stringify({
      date: "2026-11-08",
      score: "not-a-number", // 脏数据
      nodeName: null,
    });

    const cached = getYesterdayBestDisplayCache(["uuid-1"], "tri", fixedNow);
    expect(cached).toBeNull();
  });

  it("cleans up any legacy localStorage caches when clearYesterdayBestDisplayCache is invoked", () => {
    store["komaritheme:yesterday-best-display"] = "legacy";
    store["komaritheme:yesterday-best-display:tri"] = "legacy-tri";
    store["komaritheme:yesterday-leaderboard:tri"] = "legacy-lb";

    clearYesterdayBestDisplayCache();

    expect(store["komaritheme:yesterday-best-display"]).toBeUndefined();
    expect(store["komaritheme:yesterday-best-display:tri"]).toBeUndefined();
    expect(store["komaritheme:yesterday-leaderboard:tri"]).toBeUndefined();
  });

  it("calculates cluster average score accurately for baseline overview", () => {
    const mockBoard = [
      {
        uuid: "node-1",
        date: "2026-11-08",
        score: 99.0,
        avgLatency: 20,
        avgLoss: 0,
        cv: 0.02,
        spikeRatio: 1.05,
        sampleCount: 1440,
        rank: 1,
        isQualified: true,
      },
      {
        uuid: "node-2",
        date: "2026-11-08",
        score: 95.0,
        avgLatency: 30,
        avgLoss: 0.2,
        cv: 0.04,
        spikeRatio: 1.1,
        sampleCount: 1440,
        rank: 2,
        isQualified: true,
      },
      {
        uuid: "node-3",
        date: "2026-11-08",
        score: 82.0,
        avgLatency: 70,
        avgLoss: 1.6,
        cv: 0.1,
        spikeRatio: 1.3,
        sampleCount: 1440,
        rank: 3,
        isQualified: true,
      },
    ];

    const avgResult = calculateYesterdayAverageScore(mockBoard);
    expect(avgResult).not.toBeNull();
    // (99 + 95 + 82) / 3 = 276 / 3 = 92.0
    expect(avgResult?.score).toBe(92.0);
    // (20 + 30 + 70) / 3 = 40.0
    expect(avgResult?.avgLatency).toBe(40.0);
    // (0 + 0.2 + 1.6) / 3 = 0.6
    expect(avgResult?.avgLoss).toBe(0.6);
    expect(avgResult?.nodeCount).toBe(3);
    expect(avgResult?.qualifiedCount).toBe(3);
  });
});

