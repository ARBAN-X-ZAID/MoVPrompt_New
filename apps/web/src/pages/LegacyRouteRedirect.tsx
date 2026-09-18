import { Navigate, useLocation, useParams } from "react-router-dom";
import { legacyRouteTarget, type LegacyRouteKind } from "./legacyRouteTarget";

export default function LegacyRouteRedirect({ kind }: { kind: LegacyRouteKind }) {
  const location = useLocation();
  const { sessionId } = useParams();
  return <Navigate to={legacyRouteTarget(kind, location.search, sessionId)} replace />;
}
