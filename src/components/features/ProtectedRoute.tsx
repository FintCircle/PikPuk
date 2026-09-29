import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, adminOnly = false }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#080402" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ border: "1px solid rgba(196,168,130,0.3)", background: "rgba(20,12,4,0.6)" }}>
            <span className="font-playfair font-bold text-lg" style={{ color: "#d4b896" }}>P</span>
          </div>
          <div className="w-4 h-4 border-2 border-[#c4a882] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/login" replace />;
  if (adminOnly && !user.isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
