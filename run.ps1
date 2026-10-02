param([ValidateSet('start','build','test','install','format')][string]$Task='start')
$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
$gpsNode=(Get-Command node -ErrorAction SilentlyContinue).Source
$gpsBundled=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
if((!$gpsNode -or (& $gpsNode --version) -ne 'v24.19.0') -and (Test-Path -LiteralPath $gpsBundled)){$gpsNode=$gpsBundled}
if(!$gpsNode -or (& $gpsNode --version) -ne 'v24.19.0'){throw 'Установите Node.js 24.19.0 (см. .nvmrc).'}
$env:PATH=(Split-Path $gpsNode)+';'+$env:PATH
switch($Task){
 'start' { & $gpsNode node_modules/@angular/cli/bin/ng.js serve --host 127.0.0.1 }
 'build' { & $gpsNode node_modules/@angular/cli/bin/ng.js build }
 'test' { & $gpsNode node_modules/@playwright/test/cli.js test }
 'format' { & $gpsNode node_modules/prettier/bin/prettier.cjs --write src tests '*.json' '*.cjs' README.md }
 'install' { $gpsNpm=Join-Path (Split-Path (Get-Command npm).Source) 'node_modules/npm/bin/npm-cli.js'; & $gpsNode $gpsNpm ci }
}
exit $LASTEXITCODE
