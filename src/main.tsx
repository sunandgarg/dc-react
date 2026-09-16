import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installChunkRecovery } from "./lib/lazyRetry";
import { renderWhenHomeStylesReady } from "./lib/homeStyleGate";

installChunkRecovery();
const root = document.getElementById("root")!;
renderWhenHomeStylesReady(() => createRoot(root).render(<App />));
