param([string]$JavaExe)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$server = Join-Path $root '.local/server'
$jar = Join-Path $server 'minecraft-server-26.1.jar'
$properties = Join-Path $server 'server.properties'
if (-not (Test-Path -LiteralPath $jar -PathType Leaf) -or -not (Test-Path -LiteralPath $properties -PathType Leaf)) {
    throw 'Ejecuta scripts/prepare-server.ps1 antes de iniciar el servidor.'
}

$config = Get-Content -LiteralPath $properties
foreach ($setting in @('server-ip=127.0.0.1', 'server-port=25566')) {
    $key = $setting.Split('=')[0]
    $entries = @($config -match "^\s*$key(?:\s|[=:]|$)")
    if ($entries.Count -ne 1 -or $entries[0] -cne $setting) {
        throw "Configura una sola entrada '$setting' en $properties."
    }
}

if (-not $JavaExe) {
    $currentJdk = Join-Path $root '.local/java/current.txt'
    $JavaExe = if (Test-Path -LiteralPath $currentJdk -PathType Leaf) {
        (Get-Content -LiteralPath $currentJdk -Raw).Trim()
    } else {
        (Get-Command java -CommandType Application -ErrorAction Stop).Source
    }
}
$JavaExe = (Get-Command $JavaExe -CommandType Application -ErrorAction Stop).Source
$javaVersion = & $JavaExe --version
if ($LASTEXITCODE -ne 0 -or $javaVersion[0] -notmatch '^(openjdk|java) 25(?:[.\s+\-]|$)') {
    throw 'Se requiere Java 25. Usa el JDK local o indica su ejecutable con -JavaExe.'
}

Push-Location -LiteralPath $server
try {
    & $JavaExe '-Xms512M' '-Xmx2G' -jar $jar nogui
    if ($LASTEXITCODE -ne 0) { throw "El servidor termino con codigo $LASTEXITCODE." }
} finally {
    Pop-Location
}
