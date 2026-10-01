import { Navigate } from "react-router-dom";

/** Templates is the front door for guests and signed-in people. */
export default function RootRoute() {
  return <Navigate to="/templates" replace />;
}
