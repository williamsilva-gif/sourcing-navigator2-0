// Process exactly one job from the existing queue and exit (manual POC run).
import { runOnce } from "./index.js";

runOnce()
  .then((r) => {
    console.log(r ? "result posted" : "queue empty");
    process.exit(0);
  })
  .catch((e) => {
    console.error("run-once failed:", String(e?.message ?? e).slice(0, 300));
    process.exit(1);
  });
