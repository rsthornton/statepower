import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found");

// Each page loads only its own code and styles.
const path = location.pathname.replace(/\/+$/, "");
// "/" and "/explore" are the map. "/classic" was retired at release (2026-11-04); vercel.json redirects it home.
const Page = lazy(() =>
  path === "/findings" ? import("./explore/FindingsPage")
  : path === "/data" ? import("./explore/DataPage")
  : path === "/methods" ? import("./explore/MethodsPage")
  : import("./explore/ExplorePage"),
);

createRoot(rootElement).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  </StrictMode>,
);
