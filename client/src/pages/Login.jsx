import { useState } from "react";
import toast from "react-hot-toast";
import api from "../config/api";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser, setIsLogin } = useAuth();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleClearForm = () => {
    setFormData({ email: "", password: "" });
    setVerificationPending(false); setVerificationCode("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post("/auth/login", formData);
      toast.success(res.data.message);
      sessionStorage.setItem("AppUser", JSON.stringify(res.data.data));
      setUser(res.data.data);
      setIsLogin(true);
      handleClearForm();
      navigate("/chat", { replace: true, state: location.state?.featureTab ? { featureTab: location.state.featureTab } : null });
    } catch (error) {
      console.log(error);
      if (error?.response?.data?.requiresVerification) { setVerificationPending(true); toast.success(error.response.data.message); }
      else toast.error(error?.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await api.post("/auth/verify-email", { email: formData.email, code: verificationCode });
      sessionStorage.setItem("AppUser", JSON.stringify(res.data.data)); setUser(res.data.data); setIsLogin(true);
      navigate("/chat", { replace: true, state: location.state?.featureTab ? { featureTab: location.state.featureTab } : null });
    } catch (error) { toast.error(error?.response?.data?.message || "Email verification failed"); }
    finally { setLoading(false); }
  };

  const resendCode = async () => {
    setLoading(true);
    try { const { data } = await api.post("/auth/resend-verification", formData); toast.success(data.message); }
    catch (error) { toast.error(error?.response?.data?.message || "Could not resend the code"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4 auth-page auth-login-page">
      <div className="w-full max-w-md">
        <div className="card bg-base-100 shadow-xl auth-card">
          <div className="card-body">
            <div className="auth-mark">m<span>✳</span></div>
            <h2 className="card-title text-3xl justify-center text-primary">
              Welcome back
            </h2>
            <p className="text-center text-base-content/70 mb-6">
              Your favorite little corner is waiting. 👋
            </p>

            <form onSubmit={verificationPending ? handleVerify : handleSubmit} onReset={handleClearForm} className="space-y-4">
              {verificationPending ? <>
                <p className="text-center text-base-content/70">Enter the 6-digit code sent to <strong>{formData.email}</strong> to finish signing in.</p>
                <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit email code" className="input input-bordered w-full text-center tracking-[0.4em]" />
              </> : <>
              <input
                type="email"
                name="email"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
                required
                className="input input-bordered w-full"
              />

              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
                required
                className="input input-bordered w-full"
              />
              </>}

              <div className="flex gap-3 pt-4">
                {!verificationPending && <button
                  type="reset"
                  disabled={loading}
                  className="btn btn-secondary btn-outline flex-1"
                >
                  Clear
                </button>}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary flex-1"
                >
                  {loading ? "Please wait…" : verificationPending ? "Verify email and continue" : "Login"}
                </button>
              </div>
              {verificationPending && <div className="flex flex-col gap-2"><button type="button" disabled={loading} onClick={resendCode} className="btn btn-ghost">Resend code</button><button type="button" disabled={loading} onClick={() => setVerificationPending(false)} className="btn btn-ghost">Back to login</button></div>}
            </form>

            <p className="text-center text-sm text-base-content/60 mt-4">
              No account?{" "}
              <Link to="/register" state={location.state} className="text-primary font-semibold">
                Register here
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-base-content/60 mt-6">
          Your data is safe with us 🔐
        </p>
      </div>
    </div>
  );
};

export default Login;
