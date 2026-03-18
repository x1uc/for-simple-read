import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@/assets/tailwind.css";
import App from "@/entrypoints/options/options";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
