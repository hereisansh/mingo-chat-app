import { useEffect, useState } from "react";
import { applyMingoTheme } from "../config/theme";

const options = [["light", "Soft light"], ["dark", "Dark"], ["black", "Black"], ["spotify", "Spotify"], ["claude", "Claude"], ["corporate", "Corporate"], ["ghibli", "Ghibli"], ["halloween", "Halloween"], ["futuristic", "Futuristic"]];

export default function ThemePicker({ compact = false }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("mingoTheme") || "light");
  useEffect(() => {
    applyMingoTheme(theme);
    const sync = (event) => setTheme(event.detail);
    window.addEventListener("mingo:theme", sync);
    return () => window.removeEventListener("mingo:theme", sync);
  }, [theme]);
  return <select className={`site-theme-select ${compact ? "theme-picker-compact" : ""}`} aria-label="App color theme" title="Change the app theme" value={theme} onChange={(event) => { setTheme(event.target.value); applyMingoTheme(event.target.value); }}>
    {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
  </select>;
}
