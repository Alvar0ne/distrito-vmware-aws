$ErrorActionPreference = "Stop"

$app = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $app

$env:NODE_ENV = "production"
$env:PORT = "3000"

npm run start *> "$app\prod.server.log"
