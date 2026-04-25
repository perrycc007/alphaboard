$repoRoot = Split-Path -Parent $PSScriptRoot

$pythonCandidates = @(
  'C:\Users\perry\anaconda3\python.exe',
  'C:\Users\perry\miniconda3\python.exe',
  'C:\ProgramData\anaconda3\python.exe',
  'C:\ProgramData\miniconda3\python.exe',
  'C:\Users\perry\AppData\Local\Programs\Python\Python311\python.exe'
)

$pythonExe = $pythonCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $pythonExe) {
  throw "Could not find a usable Python executable."
}

$apiScript = Join-Path $repoRoot 'python setup detector\serve_review.py'
$uiRoot = Join-Path $repoRoot 'review-studio'
$apiCommand = "Set-Location -LiteralPath '$repoRoot'; & '$pythonExe' '$apiScript'"
$uiCommand = "Set-Location -LiteralPath `"$uiRoot`"; npm.cmd run dev -- --host 127.0.0.1 --port 4174"

Start-Process powershell -ArgumentList '-NoExit', '-Command', $apiCommand
Start-Process powershell -ArgumentList '-NoExit', '-Command', $uiCommand

Write-Host "Started review API with $pythonExe"
Write-Host "Started review UI on http://127.0.0.1:4174"
