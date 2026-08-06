import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { StyleProfileProvider } from "./lib/StyleProfileContext";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element");
}

// StyleProfileProvider wraps the whole router so both the AdminLayout-nested
// routes and the standalone /scout route fetch+apply the active StyleProfile
// exactly once, via the shared applyStyleProfile mapping (see
// frontend/src/lib/applyStyleProfile.ts).
createRoot(root).render(
  <StrictMode>
    <StyleProfileProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StyleProfileProvider>
  </StrictMode>
);
