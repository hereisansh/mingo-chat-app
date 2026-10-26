import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api, { assetUrl } from "../config/api";
import { useNavigate } from "react-router-dom";
import { FiCamera, FiUsers, FiHeart } from "react-icons/fi";
import { Link } from "react-router-dom";

const UserDashboard = () => {
  const { user, isLogin, setUser, setIsLogin } = useAuth();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [followStats, setFollowStats] = useState({ followers: 0, following: 0 });
  const [formData, setFormData] = useState(() => ({
    fullName: user?.fullName || "",
    email: user?.email || "",
    mobileNumber: user?.mobileNumber || "",
  }));

  useEffect(() => { api.get("/user/follow-stats").then(({ data }) => setFollowStats(data.data || { followers: 0, following: 0 })).catch(() => {}); }, []);

  if (!isLogin) {
    return (
      <div className="container mx-auto mt-10 px-4">
        <h1 className="text-3xl font-bold mb-4 text-error">Unauthorized</h1>
        <p className="text-lg">Please log in to access the dashboard.</p>
      </div>
    );
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleEdit = () => {
    setIsEditing(true);
    setError("");
    setSuccess("");
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      fullName: user.fullName || "",
      email: user.email || "",
      mobileNumber: user.mobileNumber || "",
    });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.put("/user/profile", {
        fullName: formData.fullName,
        email: formData.email,
        mobileNumber: formData.mobileNumber,
      });

      if (response.data.data) {
        const updatedUser = { ...user, ...response.data.data };
        setUser(updatedUser);
        sessionStorage.setItem("AppUser", JSON.stringify(updatedUser));
        setSuccess(response.data.message || "Profile updated successfully!");
        setIsEditing(false);
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(err.response?.data?.message || "Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatar = async (event) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 900_000) { setError("Choose a JPG, PNG, or WebP photo under 900 KB."); return; }
    setAvatarBusy(true); setError(""); setSuccess("");
    try {
      const form = new FormData(); form.append("avatar", file);
      const { data } = await api.put("/user/avatar", form);
      const updatedUser = { ...user, ...data.data }; setUser(updatedUser); sessionStorage.setItem("AppUser", JSON.stringify(updatedUser)); setSuccess("Your profile photo is updated.");
    } catch (err) { setError(err.response?.data?.message || "Couldn't update your photo."); }
    finally { setAvatarBusy(false); }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true); setError("");
    try { const { data } = await api.delete("/user/avatar"); const updatedUser = { ...user, ...data.data }; setUser(updatedUser); sessionStorage.setItem("AppUser", JSON.stringify(updatedUser)); setSuccess("Profile photo removed."); }
    catch (err) { setError(err.response?.data?.message || "Couldn't remove your photo."); }
    finally { setAvatarBusy(false); }
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem("AppUser");
    setIsLogin(false);
    navigate("/login");
  };

  const deleteAccount = async () => {
    if (!deletePassword || !window.confirm("Delete your Mingo account and its associated data permanently?")) return;
    setDeletingAccount(true); setError("");
    try {
      await api.delete("/user/account", { data: { password: deletePassword } });
      sessionStorage.removeItem("AppUser"); setUser(null); setIsLogin(false); navigate("/", { replace: true });
    } catch (err) { setError(err.response?.data?.message || "Couldn't delete your account. Please try again."); }
    finally { setDeletingAccount(false); }
  };

  return (
    <div className="container mx-auto mt-10 mb-10 max-w-2xl px-4 profile-page">
      <h1 className="text-4xl font-bold mb-8 text-center">User Dashboard</h1>

      {error && (
        <div className="alert alert-error mb-6">
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success mb-6">
          <span>{success}</span>
        </div>
      )}

      <div className="profile-hero"><div className="profile-photo-wrap"><div className="profile-photo">{user?.avatar ? <img src={assetUrl(user.avatar)} alt={`${user.fullName}'s profile`}/> : <span>{user?.fullName?.split(" ").map((part) => part[0]).slice(0,2).join("").toUpperCase() || "M"}</span>}</div><label className="profile-photo-change" title="Change profile photo"><FiCamera/><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatar} disabled={avatarBusy}/></label></div><div className="profile-hero-copy"><span className="eyebrow">YOUR MINGO PROFILE</span><h2>{user?.fullName || "Your profile"}</h2><p>A little space for the details your friends see.</p></div></div>
      <div className="profile-social-stats"><div><FiHeart/><strong>{followStats.followers}</strong><span>followers</span></div><div><FiUsers/><strong>{followStats.following}</strong><span>following</span></div></div>

      {!isEditing ? (
        <div className="card bg-base-100 shadow-lg p-8">
          <h2 className="text-2xl font-semibold mb-6">Profile Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-base-200 p-4 rounded-lg">
              <label className="text-sm font-semibold uppercase text-base-content/60">Full Name</label>
              <p className="text-lg mt-2">{user?.fullName || "Not provided"}</p>
            </div>

            <div className="bg-base-200 p-4 rounded-lg">
              <label className="text-sm font-semibold uppercase text-base-content/60">Email</label>
              <p className="text-lg mt-2">{user?.email || "Not provided"}</p>
            </div>

            <div className="bg-base-200 p-4 rounded-lg">
              <label className="text-sm font-semibold uppercase text-base-content/60">Mobile Number</label>
              <p className="text-lg mt-2">{user?.mobileNumber || "Not provided"}</p>
            </div>

            {user?.createdAt && (
              <div className="bg-base-200 p-4 rounded-lg">
                <label className="text-sm font-semibold uppercase text-base-content/60">Account Created</label>
                <p className="text-lg mt-2">
                  {new Date(user.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {user?.avatar && <button onClick={removeAvatar} disabled={avatarBusy} className="btn btn-ghost w-full">{avatarBusy ? "Updating photo…" : "Remove profile photo"}</button>}
            <button onClick={handleEdit} className="btn btn-primary w-full">
              Edit Profile
            </button>
            <button onClick={handleLogout} className="btn btn-error btn-outline w-full">
              Logout
            </button>
          </div>
          <section className="account-delete-box" aria-labelledby="delete-account-title">
            <h3 id="delete-account-title">Delete account</h3>
            <p>This permanently removes your Mingo profile and associated account data. Enter your password to continue.</p>
            <input type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} className="input input-bordered w-full" placeholder="Current password" aria-label="Current password" />
            <button onClick={deleteAccount} disabled={!deletePassword || deletingAccount} className="btn btn-error btn-outline w-full">{deletingAccount ? "Deleting account…" : "Delete my account"}</button>
          </section>
          <p className="profile-privacy-link"><Link to="/privacy">Mingo Privacy Policy</Link></p>
        </div>
      ) : (
        <div className="card bg-base-100 shadow-lg p-8">
          <h2 className="text-2xl font-semibold mb-6">Edit Profile</h2>
          <p className="profile-edit-tip">Tap the camera badge above to choose a profile photo. JPG, PNG, or WebP up to 900 KB.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-2">Full Name</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                className="input input-bordered w-full"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="input input-bordered w-full"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Mobile Number</label>
              <input
                type="tel"
                name="mobileNumber"
                value={formData.mobileNumber}
                onChange={handleInputChange}
                className="input input-bordered w-full"
                placeholder="Enter your mobile number"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-success flex-1"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="btn btn-ghost flex-1"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
