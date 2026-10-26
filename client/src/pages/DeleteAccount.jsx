import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../config/api";

const DeleteAccount = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!confirmed) return;
    setBusy(true); setError("");
    try {
      await api.post("/auth/login", { email, password });
      await api.delete("/user/account", { data: { password } });
      setPassword(""); setDone(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "We couldn't verify this account. Please try again.");
    } finally { setBusy(false); }
  };

  return <main className="privacy-page delete-account-page"><Link to="/privacy" className="privacy-back">← Privacy Policy</Link><p className="eyebrow">MINGO · ACCOUNT</p><h1>Delete your account</h1>{done ? <p>Your Mingo account and associated data have been deleted.</p> : <><p>Enter the email and password for your Mingo account. After verification, your account and associated data will be permanently deleted.</p>{error && <p role="alert" className="delete-account-error">{error}</p>}<form className="delete-account-form" onSubmit={submit}><label>Email address<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="delete-account-confirm"><input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I understand this permanently deletes my account and associated data.</label><button type="submit" disabled={busy || !confirmed}>{busy ? "Deleting account…" : "Permanently delete account"}</button></form></>}<p><Link to="/">Back to Mingo</Link></p></main>;
};

export default DeleteAccount;
