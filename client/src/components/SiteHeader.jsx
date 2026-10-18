import { FiArrowUpRight, FiMessageCircle } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemePicker from "./ThemePicker";

const SiteHeader = () => {
  const { user, isLogin } = useAuth();
  const navigate = useNavigate();
  return <header className="site-header">
    <button className="site-brand" onClick={() => navigate("/")} aria-label="Mingo home"><span className="site-brand-mark">m<i>✳</i></span><span><strong>mingo</strong><small>a little closer, always</small></span></button>
    <nav className="site-header-actions" aria-label="Main navigation">
      <ThemePicker/>
      {isLogin ? <><button className="site-nav-link" onClick={() => navigate("/chat")}><FiMessageCircle/> My chats</button><button className="site-user-chip" onClick={() => navigate("/dashboard")}><span>{user?.fullName?.slice(0, 1) || "♡"}</span>{user?.fullName?.split(" ")[0] || "My profile"}</button></> : <><button className="site-nav-link" onClick={() => navigate("/login")}>Log in</button><button className="site-signup" onClick={() => navigate("/register")}>Make your space <FiArrowUpRight/></button></>}
    </nav>
  </header>;
};

export default SiteHeader;
