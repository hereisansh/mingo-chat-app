const themeValues = ["light", "dark", "black", "spotify", "claude", "corporate", "ghibli", "halloween"];

export const applyMingoTheme = (theme) => {
  const safeTheme = themeValues.includes(theme) ? theme : "light";
  document.documentElement.dataset.theme = safeTheme;
  localStorage.setItem("mingoTheme", safeTheme);
  window.dispatchEvent(new CustomEvent("mingo:theme", { detail: safeTheme }));
};
