#!/usr/bin/env node
import { Command } from "commander";
import connectDB from "./db.js";
import { enqueueJob, getJobsByState, countByState, listDlq, retryDlqJob } from "./jobService.js";
import { startWorker } from "./worker.js";
import { getBackoffBase, getMaxRetries, setConfig, getConfig, setStopFlag, listWorkers } from "./configService.js";

const program = new Command();

await connectDB();

program
  .command("enqueue <jobData>")
  .description("Add a job to the queue")
  .action(async (jobData) => {
    const job = JSON.parse(jobData);
    await enqueueJob(job);
    process.exit(0);
  });

program
  .command("worker:start")
  .description("Start worker to process jobs")
  .option("--count <n>", "Number of concurrent jobs per loop", "1")
  .action(async (opts) => {
    await setStopFlag(false);
    await startWorker({ count: opts.count });
  });

program
  .command("worker:stop")
  .description("Signal workers to stop gracefully")
  .action(async () => {
    await setStopFlag(true);
    console.log("stop signaled");
    process.exit(0);
  });

program
  .command("list")
  .option("--state <state>", "Filter jobs by state", "pending")
  .action(async (opts) => {
    await getJobsByState(opts.state);
    process.exit(0);
  });

program
  .command("status")
  .description("Show summary of job states & active workers")
  .action(async () => {
    const counts = await countByState();
    const workers = await listWorkers();
    console.log({ counts, workers });
    process.exit(0);
  });

const dlq = program.command("dlq").description("Dead letter queue operations");
dlq
  .command("list")
  .action(async () => {
    await listDlq();
    process.exit(0);
  });
dlq
  .command("retry <jobId>")
  .action(async (jobId) => {
    await retryDlqJob(jobId);
    process.exit(0);
  });

const config = program.command("config").description("Manage configuration");
config
  .command("get <key>")
  .action(async (key) => {
    const v = await getConfig(key, null);
    console.log({ [key]: v });
    process.exit(0);
  });
config
  .command("set <key> <value>")
  .action(async (key, value) => {
    const num = isNaN(Number(value)) ? value : Number(value);
    await setConfig(key, num);
    console.log("ok");
    process.exit(0);
  });

program.parse(process.argv);
