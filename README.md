# queuectl

CLI background job queue built with Node.js and MongoDB.

## Setup
- Prerequisites
  - Node.js 18+
  - MongoDB running locally at mongodb://127.0.0.1:27017
- Install
  - npm install
  - npm link

## Usage
- Enqueue
  - queuectl enqueue '{"command":"echo hello"}'
  - queuectl enqueue '{"id":"job1","command":"sleep 2"}'
- Start workers
  - queuectl worker:start --count 3
- Stop workers gracefully
  - queuectl worker:stop
- Status
  - queuectl status
- List jobs by state
  - queuectl list --state pending
  - queuectl list --state processing
  - queuectl list --state completed
  - queuectl list --state failed
- DLQ
  - queuectl dlq list
  - queuectl dlq retry job1
- Config
  - queuectl config set max_retries 3
  - queuectl config set backoff_base 2
  - queuectl config get max_retries

## Architecture Overview
- Storage: MongoDB collections for jobs, DLQ, config, workers, and control flags
- Job schema: id, command, state, attempts, max_retries, timestamps, run_at/next_run_at, Priority, locking fields
- Workflow
  - enqueue inserts a pending job
  - worker loops: fetches and atomically locks one pending job, executes command, completes or retries with exponential backoff
  - failed beyond max_retries moves to DLQ
  - worker heartbeat is recorded; a global stop flag enables graceful stop
- Exponential backoff: delay = base^attempts seconds; base is configurable
- Persistence: All data stored in MongoDB, survives restarts

## Testing
- Run MongoDB
- Run demo script on Windows PowerShell
  - powershell -ExecutionPolicy Bypass -File scripts/demo.ps1

## Assumptions & Trade-offs
- Single MongoDB instance for persistence
- Concurrency ensured via atomic findOneAndUpdate lock
- No job timeouts by default; can be added
- Priority supported as integer (higher first)

## Expected Scenarios
- Successful job completes and shows in completed
- Failing command retries and moves to DLQ after max attempts
- Multiple workers process without overlap
- Invalid commands fail and retry
- Data remains after restart
