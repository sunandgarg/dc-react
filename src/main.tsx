import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installChunkRecovery } from "./lib/lazyRetry";
import { renderWhenPageStylesReady } from "./lib/homeStyleGate";

installChunkRecovery();
const root = document.getElementById("root")!;
const edgeFallback = document.getElementById("dc-edge-fallback");
if (edgeFallback) {
  const observer = new MutationObserver(() => {
    if (!root.querySelector("main")) return;
    edgeFallback.remove();
    observer.disconnect();
  });
  observer.observe(root, { childList: true, subtree: true });
}
renderWhenPageStylesReady(() => createRoot(root).render(<App />));
