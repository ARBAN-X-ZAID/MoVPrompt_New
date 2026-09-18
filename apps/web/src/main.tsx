import { createRoot } from "react-dom/client";
import { LanguageProvider } from "./i18n/LanguageContext";
import { ThemeProvider } from "./components/ThemeProvider";
import App from "./App.tsx";
import "./index.css";
import { captureRefFromUrl } from "./lib/referrals";
import { installDebugRecorder } from "./lib/debugRecorder";

installDebugRecorder();
captureRefFromUrl();

// Hide splash screen once React mounts
const splash = document.getElementById("splash");
if (splash) {
  splash.style.transition = "opacity 0.4s ease-out";
  requestAnimationFrame(() => {
    splash.style.opacity = "0";
    setTimeout(() => splash.remove(), 400);
  });
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </ThemeProvider>
);
