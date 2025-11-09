import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { STATES, DEFAULTS } from "./constants.js";
import { getBackoffBase, getMaxRetries } from "./configService.js";

const jobSchema = new mongoose.Schema({
  id: { type: String, default: uuidv4, index: true, unique: true },
  command: { type: String, required: true },
  state: { type: String, default: STATES.pending, index: true },
  attempts: { type: Number, default: 0 },
  max_retries: { type: Number, default: DEFAULTS.max_retries },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  run_at: { type: Date, default: Date.now, index: true },
  next_run_at: { type: Date, default: Date.now, index: true },
  locked_by: { type: String, default: null, index: true },
  locked_at: { type: Date, default: null },
  last_error: { type: String, default: null },
  output: { type: String, default: null },
  priority: { type: Number, default: 0, index: true },
});

const Job = mongoose.model("Job", jobSchema);
const DLQ = mongoose.model("DLQ", jobSchema);

export const enqueueJob = async (jobData) => {
  const maxRetries = jobData.max_retries ?? (await getMaxRetries());
  const job = new Job({
    ...jobData,
    state: STATES.pending,
    attempts: 0,
    max_retries: Number(maxRetries),
    run_at: jobData.run_at ? new Date(jobData.run_at) : new Date(),
    next_run_at: new Date(),
  });
  await job.save();
  console.log(` Enqueued Job: ${job.id}`);
};

export const getJobsByState = async (state) => {
  const jobs = await Job.find({ state }).sort({ updated_at: -1 });
  console.log(jobs);
};

export const moveToDLQ = async (job) => {
  const data = job.toObject ? job.toObject() : job;
  const deadJob = new DLQ({ ...data, state: STATES.dead });
  await deadJob.save();
  await Job.deleteOne({ id: data.id });
  console.log(` Job moved to DLQ: ${data.id}`);
};

export const updateJobState = async (jobId, newState) => {
  await Job.updateOne(
    { id: jobId },
    { $set: { state: newState, updated_at: new Date() } }
  );
};

export const fetchAndLockNextJob = async (workerId) => {
  const now = new Date();
  const job = await Job.findOneAndUpdate(
    {
      state: STATES.pending,
      locked_by: null,
      next_run_at: { $lte: now },
    },
    {
      $set: {
        state: STATES.processing,
        locked_by: workerId,
        locked_at: now,
        updated_at: now,
      },
    },
    { sort: { priority: -1, next_run_at: 1, created_at: 1 }, new: true }
  );
  return job;
};

export const releaseLockToPending = async (job, delayMs) => {
  const nextRun = new Date(Date.now() + delayMs);
  await Job.updateOne(
    { id: job.id },
    {
      $set: {
        state: STATES.pending,
        locked_by: null,
        locked_at: null,
        next_run_at: nextRun,
        updated_at: new Date(),
      },
    }
  );
};

export const completeJob = async (job, output = "") => {
  await Job.updateOne(
    { id: job.id },
    {
      $set: {
        state: STATES.completed,
        locked_by: null,
        locked_at: null,
        output,
        updated_at: new Date(),
      },
    }
  );
};

export const failJobOrDlq = async (job, errorMsg) => {
  const base = await getBackoffBase();
  const updated = await Job.findOne({ id: job.id });
  const attempts = (updated?.attempts ?? job.attempts) + 1;
  const maxRetries = updated?.max_retries ?? job.max_retries ?? DEFAULTS.max_retries;
  if (attempts > maxRetries) {
    await moveToDLQ({ ...job, state: STATES.dead, last_error: errorMsg, attempts });
    return { movedToDlq: true };
  }
  const delayMs = Math.pow(base, attempts) * 1000;
  await Job.updateOne(
    { id: job.id },
    {
      $set: {
        state: STATES.failed,
        last_error: errorMsg,
        attempts,
        locked_by: null,
        locked_at: null,
        next_run_at: new Date(Date.now() + delayMs),
        updated_at: new Date(),
      },
    }
  );
  return { movedToDlq: false, delayMs };
};

export const listDlq = async () => {
  const jobs = await DLQ.find({}).sort({ updated_at: -1 });
  console.log(jobs);
};

export const retryDlqJob = async (jobId) => {
  const dead = await DLQ.findOne({ id: jobId });
  if (!dead) {
    console.log("not found");
    return;
  }
  const copy = new Job({
    id: dead.id,
    command: dead.command,
    state: STATES.pending,
    attempts: 0,
    max_retries: dead.max_retries ?? DEFAULTS.max_retries,
    created_at: dead.created_at || new Date(),
    updated_at: new Date(),
    run_at: new Date(),
    next_run_at: new Date(),
    priority: dead.priority || 0,
  });
  await copy.save();
  await DLQ.deleteOne({ id: jobId });
  console.log(`retried ${jobId}`);
};

export const countByState = async () => {
  const pipeline = [{ $group: { _id: "$state", count: { $sum: 1 } } }];
  const res = await Job.aggregate(pipeline);
  const m = {};
  for (const r of res) m[r._id] = r.count;
  return m;
};
