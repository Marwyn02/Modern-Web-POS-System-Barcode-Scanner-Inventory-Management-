// components/ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";

interface Props {
  children: React.ReactNode;
  requiredRole: AppRole;
}

export function ProtectedRoute({ children, requiredRole }: Props) {
  const { hasMinRole, isLoading, roles } = useUserRole();

  if (isLoading) return <div>Loading...</div>;
  if (roles.length === 0) return <Navigate to="/login" replace />;

  if (!hasMinRole(requiredRole)) return <Navigate to="/unauthorized" replace />;

  return <>{children}</>;
}
