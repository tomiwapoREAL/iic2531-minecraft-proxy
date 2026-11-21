$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$version = '26.1'
$root = Split-Path -Parent $PSScriptRoot
$local = Join-Path $root '.local'
$server = Join-Path $local 'server'
$java = Join-Path $local 'java'
$downloads = Join-Path $local 'downloads'
New-Item -ItemType Directory -Force -Path $server, $java, $downloads | Out-Null

function Get-VerifiedFile {
    param([string]$Uri, [string]$Path, [string]$Algorithm, [string]$Hash)

    if ((Test-Path -LiteralPath $Path -PathType Leaf) -and
        ((Get-FileHash -LiteralPath $Path -Algorithm $Algorithm).Hash -eq $Hash)) {
        return
    }

    $partial = "$Path.partial"
    Invoke-WebRequest -Uri $Uri -OutFile $partial -UseBasicParsing -TimeoutSec 300
    if ((Get-FileHash -LiteralPath $partial -Algorithm $Algorithm).Hash -ne $Hash) {
        throw "La descarga no coincide con el hash $Algorithm publicado para $Uri."
    }
    Move-Item -LiteralPath $partial -Destination $Path -Force
}

$manifestUri = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
$manifest = Invoke-RestMethod -Uri $manifestUri -TimeoutSec 30
$release = $manifest.versions | Where-Object id -eq $version
if (-not $release -or $release.type -ne 'release') {
    throw "El manifiesto de Mojang no contiene la version release $version."
}

$metadataPath = Join-Path $downloads "$version.json"
Get-VerifiedFile -Uri $release.url -Path $metadataPath -Algorithm SHA1 -Hash $release.sha1
$metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
if ($metadata.id -ne $version -or $metadata.javaVersion.majorVersion -ne 25) {
    throw 'La version de Minecraft o la version de Java no coincide con la esperada.'
}

$jarPath = Join-Path $server "minecraft-server-$version.jar"
Get-VerifiedFile -Uri $metadata.downloads.server.url -Path $jarPath -Algorithm SHA1 -Hash $metadata.downloads.server.sha1
Write-Host "Minecraft $version SHA-1: $($metadata.downloads.server.sha1)"

$properties = Join-Path $server 'server.properties'
if (-not (Test-Path -LiteralPath $properties)) {
    Copy-Item -LiteralPath (Join-Path $root 'config/server.properties.example') -Destination $properties
}

$architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
if ($architecture -notin 'x64', 'arm64') {
    throw "Windows $architecture requiere indicar manualmente una instalacion de Java 25 al arrancar."
}

$jdkUri = "https://aka.ms/download-jdk/microsoft-jdk-25-windows-$architecture.zip"
$jdkChecksum = (Invoke-WebRequest -Uri "$jdkUri.sha256sum.txt" -UseBasicParsing -TimeoutSec 30).Content
if ($jdkChecksum -is [byte[]]) {
    $jdkChecksum = [System.Text.Encoding]::UTF8.GetString($jdkChecksum)
}
if ($jdkChecksum -notmatch '(?i)^\s*([0-9a-f]{64})(?:\s|$)') {
    throw 'Microsoft no devolvio un checksum SHA-256 valido.'
}
$jdkHash = $Matches[1].ToLowerInvariant()
$jdkArchive = Join-Path $downloads "jdk-$architecture.zip"
Get-VerifiedFile -Uri $jdkUri -Path $jdkArchive -Algorithm SHA256 -Hash $jdkHash

$jdkDirectory = Join-Path $java $jdkHash
$ready = Join-Path $jdkDirectory '.ready'
if (-not (Test-Path -LiteralPath $ready)) {
    Expand-Archive -LiteralPath $jdkArchive -DestinationPath $jdkDirectory -Force
}
$javaExecutable = @(Get-ChildItem -LiteralPath $jdkDirectory -Recurse -File -Filter 'java.exe')
if ($javaExecutable.Count -ne 1) {
    throw 'La descarga de Microsoft debe contener un unico binario java.exe.'
}

& $javaExecutable[0].FullName --version
if ($LASTEXITCODE -ne 0) { throw 'No se pudo ejecutar Java 25.' }
New-Item -ItemType File -Force -Path $ready | Out-Null
Set-Content -LiteralPath (Join-Path $java 'current.txt') -Value $javaExecutable[0].FullName -Encoding UTF8
Write-Host "OpenJDK 25 SHA-256: $jdkHash"
Write-Host 'Preparacion lista. Inicia el servidor con scripts/start-server.ps1.'
