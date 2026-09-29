import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { AuthUser } from "@/types/auth";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";

type Step = "email" | "otp" | "password";

async function mapUser(userId: string, email: string): Promise<AuthUser> {
  const { data } = await supabase.from("user_profiles").select("is_admin, is_banned, display_name, username").eq("id", userId).single();
  return {
    id: userId,
    email,
    username: data?.display_name || data?.username || email.split("@")[0],
    isAdmin: data?.is_admin ?? false,
    isBanned: data?.is_banned ?? false,
  };
}

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  // Step 1: check if existing user — try password login first
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      // Try to determine if user exists by sending OTP
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error && error.message.includes("not found")) {
        setIsNewUser(true);
        // Send OTP for registration
        const { error: regError } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
        });
        if (regError) throw regError;
        toast.success("Verification code sent to your email");
        setStep("otp");
      } else if (error) {
        throw error;
      } else {
        setIsNewUser(false);
        toast.success("Verification code sent to your email");
        setStep("otp");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: verify OTP
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });
      if (error) throw error;
      if (isNewUser) {
        setStep("password");
        setLoading(false);
      } else {
        if (data.user) {
          const mapped = await mapUser(data.user.id, data.user.email!);
          if (!mapped.isAdmin) { toast.error("Access denied. Admin only."); await supabase.auth.signOut(); setLoading(false); return; }
          login(mapped);
          navigate("/admin");
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid code";
      toast.error(message);
      setLoading(false);
    }
  };

  // Step 3: set password (new user only)
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        password,
        data: { username: email.split("@")[0] },
      });
      if (error) throw error;
      if (data.user) {
        const mapped = await mapUser(data.user.id, data.user.email!);
        if (!mapped.isAdmin) { toast.error("Access denied. Admin only."); await supabase.auth.signOut(); setLoading(false); return; }
        login(mapped);
        navigate("/admin");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to set password";
      toast.error(message);
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-auto py-8"
      style={{
        background: "radial-gradient(ellipse at 50% 30%, hsl(28 32% 10%) 0%, #080402 100%)",
      }}
    >
      {/* Film grain */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.1'/%3E%3C/svg%3E")`,
          mixBlendMode: "multiply",
        }}
      />

      <div className="relative w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
            style={{
              background: "rgba(20,12,4,0.8)",
              border: "1px solid rgba(196,168,130,0.35)",
              boxShadow: "0 0 32px rgba(196,168,130,0.08)",
            }}
          >
            <span className="font-playfair font-bold text-2xl" style={{ color: "#d4b896" }}>P</span>
          </div>
          <h1 className="font-playfair text-xl font-semibold" style={{ color: "#e8d8c0" }}>
            PikPuk Admin
          </h1>
          <p className="mt-1 text-sm font-crimson italic" style={{ color: "#6a5438" }}>
            Photograph Archive Management
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-sm px-6 py-7"
          style={{
            background: "rgba(20,12,4,0.75)",
            border: "1px solid rgba(196,168,130,0.15)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {(["email", "otp", ...(isNewUser ? ["password"] : [])] as Step[]).map((s, i, arr) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{
                    background: s === step ? "rgba(196,168,130,0.25)" : "rgba(196,168,130,0.08)",
                    border: `1px solid ${s === step ? "rgba(196,168,130,0.5)" : "rgba(196,168,130,0.15)"}`,
                    color: s === step ? "#d4b896" : "#6a5438",
                  }}
                >
                  {i + 1}
                </div>
                {i < arr.length - 1 && (
                  <div className="w-8 h-px" style={{ background: "rgba(196,168,130,0.15)" }} />
                )}
              </div>
            ))}
          </div>

          {/* Email step */}
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-crimson mb-1.5" style={{ color: "#9a7c5a", letterSpacing: "0.07em" }}>
                  EMAIL ADDRESS
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#6a5438" }} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                    className="w-full pl-9 pr-4 py-2.5 text-sm font-crimson rounded-sm outline-none transition-colors"
                    style={{
                      background: "rgba(196,168,130,0.06)",
                      border: "1px solid rgba(196,168,130,0.2)",
                      color: "#e8d8c0",
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = "rgba(196,168,130,0.45)"}
                    onBlur={e => e.currentTarget.style.borderColor = "rgba(196,168,130,0.2)"}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-crimson rounded-sm transition-all"
                style={{
                  background: loading ? "rgba(196,168,130,0.12)" : "rgba(196,168,130,0.18)",
                  border: "1px solid rgba(196,168,130,0.3)",
                  color: loading ? "#6a5438" : "#d4b896",
                }}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <><span>Continue</span><ArrowRight size={14} /></>}
              </button>
            </form>
          )}

          {/* OTP step */}
          {step === "otp" && (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <p className="text-sm font-crimson" style={{ color: "#9a7c5a" }}>
                Enter the {4}-digit code sent to <span style={{ color: "#c4a882" }}>{email}</span>
              </p>
              <div>
                <label className="block text-xs font-crimson mb-1.5" style={{ color: "#9a7c5a", letterSpacing: "0.07em" }}>
                  VERIFICATION CODE
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="0000"
                  required
                  maxLength={4}
                  className="w-full px-4 py-2.5 text-center text-xl font-playfair tracking-widest rounded-sm outline-none transition-colors"
                  style={{
                    background: "rgba(196,168,130,0.06)",
                    border: "1px solid rgba(196,168,130,0.2)",
                    color: "#e8d8c0",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(196,168,130,0.45)"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(196,168,130,0.2)"}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="flex-1 py-2.5 text-sm font-crimson rounded-sm"
                  style={{ background: "transparent", border: "1px solid rgba(196,168,130,0.15)", color: "#6a5438" }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || otp.length < 4}
                  className="flex-[2] flex items-center justify-center gap-2 py-2.5 text-sm font-crimson rounded-sm transition-all"
                  style={{
                    background: loading ? "rgba(196,168,130,0.08)" : "rgba(196,168,130,0.18)",
                    border: "1px solid rgba(196,168,130,0.3)",
                    color: loading ? "#6a5438" : "#d4b896",
                  }}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : "Verify"}
                </button>
              </div>
            </form>
          )}

          {/* Password step (new user) */}
          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <p className="text-sm font-crimson" style={{ color: "#9a7c5a" }}>
                Set a password for your admin account.
              </p>
              <div>
                <label className="block text-xs font-crimson mb-1.5" style={{ color: "#9a7c5a", letterSpacing: "0.07em" }}>
                  PASSWORD
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#6a5438" }} />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    required
                    minLength={6}
                    className="w-full pl-9 pr-4 py-2.5 text-sm font-crimson rounded-sm outline-none transition-colors"
                    style={{
                      background: "rgba(196,168,130,0.06)",
                      border: "1px solid rgba(196,168,130,0.2)",
                      color: "#e8d8c0",
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = "rgba(196,168,130,0.45)"}
                    onBlur={e => e.currentTarget.style.borderColor = "rgba(196,168,130,0.2)"}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-crimson rounded-sm transition-all"
                style={{
                  background: loading ? "rgba(196,168,130,0.08)" : "rgba(196,168,130,0.18)",
                  border: "1px solid rgba(196,168,130,0.3)",
                  color: loading ? "#6a5438" : "#d4b896",
                }}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : "Create Account & Enter"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center mt-4 text-xs font-crimson" style={{ color: "#3a2a1a" }}>
          PikPuk · Photograph Archive
        </p>
      </div>
    </div>
  );
}
