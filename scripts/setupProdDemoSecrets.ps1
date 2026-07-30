[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$secretsDirectory = Join-Path $projectRoot '.secrets'
$databaseUrlFile = Join-Path $secretsDirectory 'prod-demo-database-url.txt'
$serviceAccountFile = Join-Path $secretsDirectory 'firebase-admin.json'
$expectedFirebaseProject = 'budget-runner-cyberdeck'

Write-Host 'Preparación local del reset del usuario demo.' -ForegroundColor Cyan
Write-Host 'Ningún secreto se mostrará ni se enviará a un servicio.'
Write-Host ''

$secureDatabaseUrl = Read-Host 'Pega la URL DIRECT de Neon y pulsa Enter' -AsSecureString
$databaseCredential = New-Object System.Management.Automation.PSCredential('unused', $secureDatabaseUrl)
$databaseUrl = $databaseCredential.GetNetworkCredential().Password.Trim()

if (-not $databaseUrl -or $databaseUrl -match '^<.*>$') {
  throw 'No se ha proporcionado una URL real de Neon.'
}

try {
  $databaseUri = [System.Uri]$databaseUrl
} catch {
  throw 'La URL de Neon no tiene un formato válido.'
}

if ($databaseUri.Scheme -notin @('postgres', 'postgresql')) {
  throw 'La URL debe comenzar por postgres:// o postgresql://.'
}
if ($databaseUri.Host -in @('127.0.0.1', 'localhost')) {
  throw 'La URL apunta a PostgreSQL local; se necesita la conexión live de Neon.'
}
if ($databaseUri.Host -match '-pooler(\.|$)') {
  throw 'La URL parece pooled. Copia la conexión direct desde Neon.'
}
if (-not $databaseUri.UserInfo -or $databaseUri.AbsolutePath -eq '/') {
  throw 'La URL de Neon debe incluir usuario, contraseña y base de datos.'
}

$downloadedJsonInput = (Read-Host 'Escribe o arrastra aquí la ruta del JSON descargado de Firebase').Trim()
$downloadedJsonInput = $downloadedJsonInput.Trim('"').Trim("'")
if (-not $downloadedJsonInput -or $downloadedJsonInput -match '^<.*>$') {
  throw 'No se ha proporcionado una ruta real al JSON de Firebase.'
}

$downloadedJsonPath = if ([System.IO.Path]::IsPathRooted($downloadedJsonInput)) {
  $downloadedJsonInput
} else {
  Join-Path $projectRoot $downloadedJsonInput
}
if (-not (Test-Path -LiteralPath $downloadedJsonPath -PathType Leaf)) {
  throw "No existe el archivo indicado: $downloadedJsonPath"
}
$downloadedJsonPath = (Resolve-Path -LiteralPath $downloadedJsonPath).Path

try {
  $serviceAccount = Get-Content -LiteralPath $downloadedJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
  throw 'El archivo indicado no contiene un JSON válido.'
}
if ($serviceAccount.project_id -ne $expectedFirebaseProject) {
  throw "El JSON no pertenece al proyecto Firebase $expectedFirebaseProject."
}
if (-not $serviceAccount.client_email -or -not $serviceAccount.private_key) {
  throw 'El JSON no contiene una cuenta de servicio Firebase Admin completa.'
}

New-Item -ItemType Directory -Force -Path $secretsDirectory | Out-Null
$utf8WithoutBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
[System.IO.File]::WriteAllText($databaseUrlFile, $databaseUrl, $utf8WithoutBom)

$resolvedServiceAccountTarget = [System.IO.Path]::GetFullPath($serviceAccountFile)
if ($downloadedJsonPath -ne $resolvedServiceAccountTarget) {
  Copy-Item -LiteralPath $downloadedJsonPath -Destination $serviceAccountFile -Force
}

$databaseUrl = $null
$databaseCredential = $null
$secureDatabaseUrl = $null

Write-Host ''
Write-Host 'Secretos locales preparados correctamente:' -ForegroundColor Green
Get-Item -LiteralPath $databaseUrlFile, $serviceAccountFile |
  Select-Object Name, Length |
  Format-Table -AutoSize
Write-Host 'Siguiente paso: npm run prod:demo:reset'
