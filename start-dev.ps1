Set-Location $PSScriptRoot
python dev-server.py 8080
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
