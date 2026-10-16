$url = "https://civicconnect-hi53.onrender.com/healthz"
$requests = 50
Write-Host "Starting load test: $requests requests to $url"
$time = Measure-Command {
    for ($i=1; $i -le $requests; $i++) {
        Invoke-RestMethod -Uri $url -Method Get | Out-Null
        Write-Host -NoNewline "."
    }
}
Write-Host "
Test complete!"
Write-Host "Total Time: $($time.TotalSeconds) seconds"
Write-Host "Average Response Time: $($time.TotalMilliseconds / $requests) ms"
