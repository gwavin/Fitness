param(
    [string]$SdkPath = "$env:LOCALAPPDATA\Android\Sdk",
    [string]$JdkPath = "$env:ProgramFiles\Android\Android Studio\jbr"
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath "$JdkPath\bin\java.exe")) { throw 'Set -JdkPath to a JDK 17 installation.' }
if (-not (Test-Path -LiteralPath "$SdkPath\platforms\android-34\android.jar")) { throw 'Install Android SDK platform 34 or set -SdkPath.' }
$env:JAVA_HOME = $JdkPath
$env:ANDROID_HOME = $SdkPath
Push-Location $PSScriptRoot
try {
    & .\gradlew.bat --no-daemon :app:assembleDebug :app:assembleDebugAndroidTest
    if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
    & "$SdkPath\build-tools\34.0.0\apksigner.bat" verify --verbose app\build\outputs\apk\debug\app-debug.apk
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
    $previewDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\plans\fitness-v2\downloads'))
    New-Item -ItemType Directory -Path $previewDirectory -Force | Out-Null
    $preview = Join-Path $previewDirectory 'fitness-clock-bridge-preview.apk'
    Copy-Item -LiteralPath app\build\outputs\apk\debug\app-debug.apk -Destination $preview
    $previewHash = Get-FileHash -LiteralPath $preview -Algorithm SHA256
    ($previewHash.Hash.ToLowerInvariant() + '  fitness-clock-bridge-preview.apk') | Set-Content -LiteralPath "$preview.sha256" -Encoding ascii
    $previewHash
} finally { Pop-Location }
