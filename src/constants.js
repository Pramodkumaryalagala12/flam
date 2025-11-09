
 export const STATES = {
   pending: "pending",
   processing: "processing",
   completed: "completed",
   failed: "failed",
   dead: "dead",
 };
 
 export const DEFAULTS = {
   max_retries: 3,
   backoff_base: 2,
   poll_interval_ms: 500,
 };
 
 export const COLLECTIONS = {
   jobs: "Job",
   dlq: "DLQ",
   config: "Config",
   workers: "Worker",
   control: "Control",
 };

