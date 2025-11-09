import { fetchAndLockNextJob, completeJob, failJobOrDlq } from "./jobService.js";
import { execAsync } from "./utils.js";
import { getStopFlag, heartbeat, registerWorker } from "./configService.js";
import { DEFAULTS } from "./constants.js";

const runOne = async (workerId) => {
  const job = await fetchAndLockNextJob(workerId);
  if (!job) return false;
  try {
    const { stdout, stderr } = await execAsync(job.command);
    const out = [stdout, stderr].filter(Boolean).join("\n");
    await completeJob(job, out);
    console.log(`✅ ${job.id}`);
  } catch (e) {
    const msg = e?.stderr || e?.stdout || String(e);
    const r = await failJobOrDlq(job, msg);
    if (r.movedToDlq) console.log(`☠️ ${job.id}`);
    else console.log(`🔁 ${job.id}`);
  }
  return true;
};

export const startWorker = async (opts = {}) => {
  const count = Number(opts.count || 1);
  const workerId = `${process.pid}-${Date.now()}`;
  await registerWorker(workerId);
  let stop = false;
  const beat = setInterval(() => heartbeat(workerId), 2000);
  process.on("SIGINT", () => { stop = true; });
  process.on("SIGTERM", () => { stop = true; });
  const loop = async () => {
    while (!stop && !(await getStopFlag())) {
      const attempts = Array.from({ length: count }, () => runOne(workerId));
      const results = await Promise.all(attempts);
      const did = results.some(Boolean);
      if (!did) await new Promise((r) => setTimeout(r, DEFAULTS.poll_interval_ms));
    }
    clearInterval(beat);
  };
  await loop();
};
