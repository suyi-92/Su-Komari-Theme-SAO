import { Link, useLocation, type LinkProps } from "react-router-dom";

export interface HomeInstanceState {
  homeHistorySteps: number;
  homeSearch: string;
  homeHash: string;
}

type HomeInstanceLinkProps = Omit<LinkProps, "to" | "state"> & { uuid: string };

export function HomeInstanceLink({ uuid, ...props }: HomeInstanceLinkProps) {
  const { search, hash } = useLocation();
  const state: HomeInstanceState = { homeHistorySteps: 1, homeSearch: search, homeHash: hash };
  return (
    <Link
      {...props}
      to={`/instance/${encodeURIComponent(uuid)}`}
      state={state}
    />
  );
}
