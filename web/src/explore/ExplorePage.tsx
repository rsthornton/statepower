import { useEffect, useState } from "react";
import { loadCommon } from "./data";
import FreightMap from "./FreightMap";

export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function Fallback({ reason }: { reason: string }) {
  return (
    <main style={{ maxWidth: 640, margin: "64px auto", padding: "0 16px", font: "16px/1.5 system-ui, sans-serif" }} data-testid="explore-fallback">
      <h1 style={{ fontSize: 24 }}>The 3-D map can't run here</h1>
      <p>{reason}</p>
      <p>
        The <a href="/findings">findings</a> give the results in text and tables, and every figure on the map is in the{" "}
        <a href="/data">data downloads</a>.
      </p>
    </main>
  );
}

export default function ExplorePage() {
  const [gl] = useState(webglAvailable);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!gl) return;
    loadCommon().then(() => setReady(true)).catch((e: Error) => setError(e.message));
  }, [gl]);
  if (!gl) return <Fallback reason="This browser does not provide WebGL, which the 3-D map needs." />;
  if (error) return <Fallback reason={`The map's data could not be loaded: ${error}.`} />;
  return ready ? <FreightMap /> : null;
}
