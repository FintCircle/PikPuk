import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight, Loader2, ArrowLeft } from "lucide-react";
import { AuthUser } from "@/types/auth";

type Step = "email" | "otp" | "password";
type Mode = "login" | "register";

async function mapUserFull(userId: string, email: string): Promise<AuthUser> {
  const { data } = await supabase
    .from("user_profiles")
    .select("is_admin, is_banned, display_name, username")
    .eq("id", userId)
    .single();
  return {
    id: userId,
    email,
    username: data?.display_name || data?.username || email.split("@")[0],
    isAdmin: data?.is_admin ?? false,
    isBanned: data?.is_banned ?? false,
  };
}

export default function Login() {
  const navigate = useNavigate();
  const { login, user, loading } = useAuth();
  const [step, setStep] = useState<Step>("email");
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [pageLoading, setPageLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/account", { replace: true });
  }, [user, loading, navigate]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setPageLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (error && (error.message.toLowerCase().includes("not found") || error.message.toLowerCase().includes("signup"))) {
          toast.error("No account found. Please register first.");
          setPageLoading(false);
          return;
        }
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
      }
      toast.success("Verification code sent to your email");
      setStep("otp");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPageLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setPageLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
      if (error) throw error;
      if (mode === "register") {
        setStep("password");
        setPageLoading(false);
        return;
      }
      if (data.user) {
        const mapped = await mapUserFull(data.user.id, data.user.email!);
        if (mapped.isBanned) {
          toast.error("Your account has been suspended.");
          await supabase.auth.signOut();
          setPageLoading(false);
          return;
        }
        login(mapped);
        navigate("/account");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
      setPageLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setPageLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        password,
        data: { username: email.split("@")[0] },
      });
      if (error) throw error;
      if (data.user) {
        const mapped = await mapUserFull(data.user.id, data.user.email!);
        login(mapped);
        navigate("/account");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to set password");
      setPageLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-auto py-8"
      style={{ background: "radial-gradient(ellipse at 50% 30%, hsl(28 32% 10%) 0%, #080402 100%)" }}
    >
      <div className="fixed inset-0 pointer-events-none opacity-40" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.1'/%3E%3C/svg%3E")`,
        mixBlendMode: "multiply",
      }} />

      <div className="relative w-full max-w-sm mx-4">
        <Link to="/" className="flex items-center gap-1.5 mb-6 text-xs font-crimson" style={{ color: "#6a5438" }}>
          <ArrowLeft size={12} /> Back to archive
        </Link>

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
            style={{ background: "rgba(20,12,4,0.8)", border: "1px solid rgba(196,168,130,0.35)", boxShadow: "0 0 32px rgba(196,168,130,0.08)" }}>
            <span className="font-playfair font-bold text-2xl" style={{ color: "#d4b896" }}>P</span>
          </div>
          <h1 className="font-playfair text-xl font-semibold" style={{ color: "#e8d8c0" }}>PikPuk</h1>
          <p className="mt-1 text-sm font-crimson italic" style={{ color: "#6a5438" }}>
            {mode === "login" ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        {/* Mode toggle */}
        {step === "email" && (
          <div className="flex gap-1 mb-5 p-1 rounded-sm" style={{ background: "rgba(196,168,130,0.06)", border: "1px solid rgba(196,168,130,0.12)" }}>
            {(["login", "register"] as Mode[]).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className="flex-1 py-1.5 text-sm font-crimson rounded-sm transition-all"
                style={{
                  background: mode === m ? "rgba(196,168,130,0.18)" : "transparent",
                  border: mode === m ? "1px solid rgba(196,168,130,0.25)" : "1px solid transparent",
                  color: mode === m ? "#d4b896" : "#6a5438",
                }}>
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-sm px-6 py-7"
          style={{ background: "rgba(20,12,4,0.75)", border: "1px solid rgba(196,168,130,0.15)", backdropFilter: "blur(12px)" }}>

          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-crimson mb-1.5" style={{ color: "#9a7c5a", letterSpacing: "0.07em" }}>EMAIL ADDRESS</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#6a5438" }} />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required
                    className="w-full pl-9 pr-4 py-2.5 text-sm font-crimson rounded-sm outline-none"
                    style={{ background: "rgba(196,168,130,0.06)", border: "1px solid rgba(196,168,130,0.2)", color: "#e8d8c0" }}
                    onFocus={e => e.currentTarget.style.borderColor = "rgba(196,168,130,0.45)"}
                    onBlur={e => e.currentTarget.style.borderColor = "rgba(196,168,130,0.2)"} />
                </div>
              </div>
              <button type="submit" disabled={pageLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-crimson rounded-sm transition-all"
                style={{ background: pageLoading ? "rgba(196,168,130,0.08)" : "rgba(196,168,130,0.18)", border: "1px solid rgba(196,168,130,0.3)", color: pageLoading ? "#6a5438" : "#d4b896" }}>
                {pageLoading ? <Loader2 size={14} className="animate-spin" /> : <><span>Continue</span><ArrowRight size={14} /></>}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <p className="text-sm font-crimson" style={{ color: "#9a7c5a" }}>
                Enter the 4-digit code sent to <span style={{ color: "#c4a882" }}>{email}</span>
              </p>
              <div>
                <label className="block text-xs font-crimson mb-1.5" style={{ color: "#9a7c5a", letterSpacing: "0.07em" }}>VERIFICATION CODE</label>
                <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="0000" required maxLength={4}
                  className="w-full px-4 py-2.5 text-center text-xl font-playfair tracking-widest rounded-sm outline-none"
                  style={{ background: "rgba(196,168,130,0.06)", border: "1px solid rgba(196,168,130,0.2)", color: "#e8d8c0" }}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(196,168,130,0.45)"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(196,168,130,0.2)"} />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setStep("email"); setOtp(""); }}
                  className="flex-1 py-2.5 text-sm font-crimson rounded-sm"
                  style={{ background: "transparent", border: "1px solid rgba(196,168,130,0.15)", color: "#6a5438" }}>Back</button>
                <button type="submit" disabled={pageLoading || otp.length < 4}
                  className="flex-[2] flex items-center justify-center gap-2 py-2.5 text-sm font-crimson rounded-sm"
                  style={{ background: pageLoading ? "rgba(196,168,130,0.08)" : "rgba(196,168,130,0.18)", border: "1px solid rgba(196,168,130,0.3)", color: pageLoading ? "#6a5438" : "#d4b896" }}>
                  {pageLoading ? <Loader2 size={14} className="animate-spin" /> : "Verify"}
                </button>
              </div>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <p className="text-sm font-crimson" style={{ color: "#9a7c5a" }}>Set a password for your account.</p>
              <div>
                <label className="block text-xs font-crimson mb-1.5" style={{ color: "#9a7c5a", letterSpacing: "0.07em" }}>PASSWORD</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#6a5438" }} />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters" required minLength={6}
                    className="w-full pl-9 pr-4 py-2.5 text-sm font-crimson rounded-sm outline-none"
                    style={{ background: "rgba(196,168,130,0.06)", border: "1px solid rgba(196,168,130,0.2)", color: "#e8d8c0" }}
                    onFocus={e => e.currentTarget.style.borderColor = "rgba(196,168,130,0.45)"}
                    onBlur={e => e.currentTarget.style.borderColor = "rgba(196,168,130,0.2)"} />
                </div>
              </div>
              <button type="submit" disabled={pageLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-crimson rounded-sm"
                style={{ background: pageLoading ? "rgba(196,168,130,0.08)" : "rgba(196,168,130,0.18)", border: "1px solid rgba(196,168,130,0.3)", color: pageLoading ? "#6a5438" : "#d4b896" }}>
                {pageLoading ? <Loader2 size={14} className="animate-spin" /> : "Create Account"}
              </button>
            </form>
          )}
        </div>
        <p className="text-center mt-4 text-xs font-crimson" style={{ color: "#3a2a1a" }}>PikPuk · Photograph Archive</p>
      </div>
    </div>
  );
}
