$ErrorActionPreference = 'Stop'
$origin = [Uri]'https://build-2611-11.jobability.co.kr/'
$destination = Join-Path $PSScriptRoot 'public'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$queue = [Collections.Generic.Queue[string]]::new()
$seen = [Collections.Generic.HashSet[string]]::new()
$queue.Enqueue('index.html')
while ($queue.Count -gt 0) {
    $relative = $queue.Dequeue()
    if (-not $seen.Add($relative)) { continue }
    $uri = [Uri]::new($origin, $relative)
    if ($uri.Host -ne $origin.Host) { continue }
    $relative = $uri.AbsolutePath.TrimStart('/')
    $target = Join-Path $destination $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
    try {
        Invoke-WebRequest -Uri $uri.AbsoluteUri -UseBasicParsing -OutFile $target
    } catch {
        Write-Warning "Unavailable: $relative"
        continue
    }
    Write-Output $relative
    if ($relative -match '\.(html|css|js)$') {
        $source = [IO.File]::ReadAllText($target)
        $pattern = '(?:src|href)\s*=\s*["'']([^"''#?]+)|url\(\s*["'']?([^\)"'']+)'
        foreach ($match in [regex]::Matches($source, $pattern)) {
            $link = if ($match.Groups[1].Success) { $match.Groups[1].Value } else { $match.Groups[2].Value }
            if ($link -match '^(https?:|//|data:|mailto:|tel:|#)') { continue }
            $next = [Uri]::new($uri, $link)
            if ($next.Host -eq $origin.Host -and $next.AbsolutePath -match '\.(html|css|js|svg|png|jpg|jpeg|webp|woff2?|ico|xlsx|pdf|docx)$') {
                $queue.Enqueue($next.AbsolutePath.TrimStart('/'))
            }
        }
    }
}
