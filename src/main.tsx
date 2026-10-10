import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installChunkRecovery } from "./lib/lazyRetry";
import { renderWhenPageStylesReady } from "./lib/homeStyleGate";

installChunkRecovery();
const root = document.getElementById("root")!;
renderWhenPageStylesReady(() => createRoot(root).render(<App />));
