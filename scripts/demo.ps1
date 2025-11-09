param()

npm link | Out-Null

queuectl config set max_retries 2
queuectl config set backoff_base 2

queuectl enqueue '{"id":"ok1","command":"echo demo ok"}'
queuectl enqueue '{"id":"bad1","command":"nonexistent_cmd"}'

Start-Job -ScriptBlock { queuectl worker:start --count 2 } | Out-Null
Start-Sleep -Seconds 6

queuectl status
queuectl list --state completed
queuectl list --state failed
queuectl dlq list

queuectl worker:stop
Start-Sleep -Seconds 2

$dlq = queuectl dlq list
queuectl dlq retry bad1

Start-Job -ScriptBlock { queuectl worker:start --count 1 } | Out-Null
Start-Sleep -Seconds 5

queuectl status
