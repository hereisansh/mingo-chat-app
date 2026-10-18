import { useState } from "react";
import toast from "react-hot-toast";
import api from "../config/api";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser, setIsLogin } = useAuth();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    mobileNumber: "",
    password: "",
    confirmPassword: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleClearForm = () => {
    setFormData({
      fullName: "",
      email: "",
      mobileNumber: "",
      password: "",
      confirmPassword: "",
    });
    setValidationError({});
  };

  const validate = () => {
    let Error = {};

    if (formData.fullName.trim().length < 2) {
      Error.fullName = "Enter your name (at least 2 characters)";
    } else if (!/^[\p{L}][\p{L}'’ -]*$/u.test(formData.fullName.trim())) {
      Error.fullName = "Use letters, spaces, apostrophes or hyphens";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      Error.email = "Enter a valid email address";
    }

    if (formData.mobileNumber && !/^\+?[\d ()-]{7,20}$/.test(formData.mobileNumber)) {
      Error.mobileNumber = "Enter a valid phone number, or leave it blank";
    }

    if (formData.password.length < 8) {
      Error.password = "Use at least 8 characters for your password";
    }

    if (formData.password !== formData.confirmPassword) {
      Error.confirmPassword = "Passwords do not match";
    }

    setValidationError(Error);
    return Object.keys(Error).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    if (!validate()) {
      setIsLoading(false);
      toast.error("Fill the form correctly");
      return;
    }

    try {
      const res = await api.post("/auth/register", formData);
      toast.success(res.data.message);
      handleClearForm();
      sessionStorage.setItem("AppUser", JSON.stringify(res.data.data));
      setUser(res.data.data);
      setIsLogin(true);
      navigate("/chat", { replace: true, state: location.state?.featureTab ? { featureTab: location.state.featureTab } : null });
    } catch (error) {
      console.log(error);
      toast.error(error?.response?.data?.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4 auth-page auth-register-page">
      <div className="w-full max-w-xl">
        <div className="card bg-base-100 shadow-xl auth-card">
          <div className="card-body">
            <div className="auth-mark">m<span>✳</span></div>
            <h2 className="card-title text-3xl justify-center text-primary">
              Make your space
            </h2>
            <p className="text-center text-base-content/70 mb-6">
              A little place for your favorite people. ✨
            </p>

            <form onSubmit={handleSubmit} onReset={handleClearForm} className="space-y-4">
              <div>
                <input
                  type="text"
                  name="fullName"
                  placeholder="Full Name"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="input input-bordered w-full"
                />
                {validationError.fullName && (
                  <p className="text-error text-sm mt-1">{validationError.fullName}</p>
                )}
              </div>

              <div>
                <input
                  type="email"
                  name="email"
                  placeholder="Email Address"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="input input-bordered w-full"
                />
                {validationError.email && (
                  <p className="text-error text-sm mt-1">{validationError.email}</p>
                )}
              </div>

              <div>
                <input
                  type="tel"
                  name="mobileNumber"
                  placeholder="Phone Number (optional)"
                  maxLength="10"
                  value={formData.mobileNumber}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="input input-bordered w-full"
                />
                {validationError.mobileNumber && (
                  <p className="text-error text-sm mt-1">{validationError.mobileNumber}</p>
                )}
              </div>

              <input
                type="password"
                name="password"
                placeholder="Create Password"
                required
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
                className="input input-bordered w-full"
              />
              {validationError.password && (
                <p className="text-error text-sm mt-1">{validationError.password}</p>
              )}

              <div>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="input input-bordered w-full"
                />
                {validationError.confirmPassword && (
                  <p className="text-error text-sm mt-1">{validationError.confirmPassword}</p>
                )}
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  type="reset"
                  disabled={isLoading}
                  className="btn btn-secondary btn-outline flex-1"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn btn-primary flex-1"
                >
                  {isLoading ? "Submitting..." : "Register"}
                </button>
              </div>
            </form>

            <p className="text-center text-sm text-base-content/60 mt-4">
              Already have an account?{" "}
              <Link to="/login" state={location.state} className="text-primary font-semibold">
                Login here
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-base-content/60 mt-6">
          We respect your privacy 🔒
        </p>
      </div>
    </div>
  );
};

export default Register;
