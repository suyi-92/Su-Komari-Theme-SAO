import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Dropdown } from "@/components/ui/Dropdown";
import type { HomeInstanceState } from "@/components/node/HomeInstanceLink";
import { useAuth } from "@/hooks/useAuth";
import { useAllNodeMeta, useHomeNodeSummaries } from "@/hooks/useNode";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import { collectMatchingNodeUuids } from "@/utils/nodeIdentity";

export function InstanceSwitcher({ currentUuid }: { currentUuid: string }) {
  const allMeta = useAllNodeMeta();
  const summaries = useHomeNodeSummaries();
  const { hiddenNodes } = useThemeSettings();
  const { data: me } = useAuth();
  const { state } = useLocation();
  const navigate = useNavigate();

  const onlineByUuid = useMemo(
    () => new Map(summaries.map((node) => [node.uuid, node.online] as const)),
    [summaries],
  );

  const hiddenUuids = useMemo(
    () => collectMatchingNodeUuids(allMeta, hiddenNodes),
    [allMeta, hiddenNodes],
  );

  const options = useMemo(
    () =>
      allMeta
        .filter(
          (node) => !hiddenUuids.has(node.uuid) && (me?.logged_in === true || !node.hidden),
        )
        .map((node) => {
          const online = onlineByUuid.get(node.uuid);
          const status = online === true ? "online" : online === false ? "offline" : "unknown";
          return {
            value: node.uuid,
            label: node.name?.trim() || node.uuid,
            description: online === true ? "在线" : online === false ? "离线" : "状态未知",
            adornment: <span className="instance-switcher-dot" data-status={status} aria-hidden />,
          };
        }),
    [allMeta, hiddenUuids, me?.logged_in, onlineByUuid],
  );

  // 只有一个（或没有）节点时没必要显示切换器。
  if (options.length <= 1) return null;

  const select = (uuid: string) => {
    const fromHome: HomeInstanceState | null = state;
    navigate(`/instance/${encodeURIComponent(uuid)}`, {
      state: fromHome?.homeHistorySteps
        ? { ...fromHome, homeHistorySteps: fromHome.homeHistorySteps + 1 }
        : undefined,
    });
  };

  return (
    <Dropdown
      label="切换服务器"
      title="切换服务器"
      value={currentUuid}
      options={options}
      onValueChange={select}
      variant="icon"
    />
  );
}
