import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { DbUserProfile } from "@/types/db";
import { toast } from "sonner";
import { ArrowLeft, Shield, ShieldOff, Ban, CheckCircle, Loader2, Users as UsersIcon } from "lucide-react";

export default function Users() {
  const [users, setUsers] = useState<DbUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("user_profiles").select("*").order("joined_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Failed to load users");
        else setUsers((data ?? []) as DbUserProfile[]);
        setLoading(false);
      });
  }, []);

  const toggleAdmin = async (u: DbUserProfile) => {
    setActionId(u.id);
    const { error } = await supabase.from("user_profiles").update({ is_admin: !u.is_admin }).eq("id", u.id);
    if (error) toast.error("Failed to update");
    else {
      toast.success(u.is_admin ? "Admin access removed" : "Admin access granted");
      setUsers(prev => prev.map(p => p.id === u.id ? { ...p, is_admin: !p.is_admin } : p));
    }
    setActionId(null);
  };

  const toggleBan = async (u: DbUserProfile) => {
    setActionId(u.id);
    const { error } = await supabase.from("user_profiles").update({ is_banned: !u.is_banned }).eq("id", u.id);
    if (error) toast.error("Failed to update");
    else {
      toast.success(u.is_banned ? "User unbanned" : "User banned from uploading");
      setUsers(prev => prev.map(p => p.id === u.id ? { ...p, is_banned: !p.is_banned } : p));
    }
    setActionId(null);
  };

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(28 28% 9%) 0%, #080402 100%)" }}>
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E")`,
        mixBlendMode: "multiply", zIndex: 0,
      }} />
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-8">
          <Link to="/admin" className="flex items-center justify-center w-8 h-8 rounded-full"
            style={{ background: "rgba(196,168,130,0.08)", border: "1px solid rgba(196,168,130,0.15)", color: "#9a7c5a" }}>
            <ArrowLeft size={14} />
          </Link>
          <div>
            <h1 className="font-playfair text-lg font-semibold" style={{ color: "#e8d8c0" }}>User Management</h1>
            <p className="text-xs font-crimson mt-0.5" style={{ color: "#6a5438" }}>Manage roles and access</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin" style={{ color: "#9a7c5a" }} />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2" style={{ border: "1px solid rgba(196,168,130,0.1)", borderRadius: "2px" }}>
            <UsersIcon size={28} style={{ color: "#3a2a1a" }} />
            <p className="font-crimson text-sm" style={{ color: "#6a5438" }}>No users yet.</p>
          </div>
        ) : (
          <div className="rounded-sm overflow-hidden" style={{ border: "1px solid rgba(196,168,130,0.12)" }}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(196,168,130,0.1)", background: "rgba(196,168,130,0.04)" }}>
                  {["USER", "ROLE", "STATUS", "ACTIONS"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-crimson" style={{ color: "#6a5438", letterSpacing: "0.07em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, idx) => (
                  <tr key={u.id} style={{ borderBottom: idx < users.length - 1 ? "1px solid rgba(196,168,130,0.07)" : "none", background: idx % 2 ? "rgba(196,168,130,0.02)" : "transparent" }}>
                    <td className="px-4 py-3">
                      <p className="font-playfair text-sm font-semibold" style={{ color: "#c0a880" }}>{u.display_name || u.username || u.email.split("@")[0]}</p>
                      <p className="text-xs font-crimson mt-0.5" style={{ color: "#5a4030" }}>{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_admin ? (
                        <span className="flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs font-crimson"
                          style={{ background: "rgba(196,168,130,0.12)", border: "1px solid rgba(196,168,130,0.25)", color: "#d4b896" }}>
                          <Shield size={10} /> Admin
                        </span>
                      ) : (
                        <span className="text-xs font-crimson" style={{ color: "#6a5438" }}>Member</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.is_banned ? (
                        <span className="flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs font-crimson"
                          style={{ background: "rgba(192,80,64,0.12)", border: "1px solid rgba(192,80,64,0.25)", color: "#c08070" }}>
                          <Ban size={10} /> Banned
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 w-fit text-xs font-crimson" style={{ color: "#8ab870" }}>
                          <CheckCircle size={10} /> Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleAdmin(u)} disabled={actionId === u.id}
                          title={u.is_admin ? "Remove admin" : "Make admin"}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-crimson rounded-sm transition-colors"
                          style={{ color: "#9a7c5a", border: "1px solid rgba(196,168,130,0.15)" }}
                          onMouseEnter={e => e.currentTarget.style.color = "#d4b896"}
                          onMouseLeave={e => e.currentTarget.style.color = "#9a7c5a"}>
                          {actionId === u.id ? <Loader2 size={11} className="animate-spin" /> : u.is_admin ? <><ShieldOff size={11} /> Demote</> : <><Shield size={11} /> Admin</>}
                        </button>
                        <button onClick={() => toggleBan(u)} disabled={actionId === u.id}
                          title={u.is_banned ? "Unban user" : "Ban user"}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-crimson rounded-sm transition-colors"
                          style={{ color: u.is_banned ? "#8ab870" : "#c08070", border: `1px solid ${u.is_banned ? "rgba(138,184,112,0.2)" : "rgba(192,80,64,0.2)"}` }}>
                          {actionId === u.id ? <Loader2 size={11} className="animate-spin" /> : u.is_banned ? <><CheckCircle size={11} /> Unban</> : <><Ban size={11} /> Ban</>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
