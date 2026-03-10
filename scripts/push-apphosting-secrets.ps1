param(
  [string]$ProjectId = "hashart-fun",
  [string]$BackendId = "hashcinema",
  [string]$Location = "us-central1",
  [string]$EnvFile = ".env.local"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

if (-not (Test-Path $EnvFile)) {
  throw "Missing env file: $EnvFile"
}

$envMap = @{}
Get-Content $EnvFile | ForEach-Object {
  if ($_ -match "^\s*#" -or $_ -match "^\s*$") {
    return
  }

  $idx = $_.IndexOf("=")
  if ($idx -lt 1) {
    return
  }

  $key = $_.Substring(0, $idx).Trim()
  $value = $_.Substring($idx + 1)

  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    if ($value.Length -ge 2) {
      $value = $value.Substring(1, $value.Length - 2)
    }
  }

  $envMap[$key] = $value
}

$defaults = @{
  PAYMENT_DERIVATION_PREFIX = "hashcinema-job"
  ALLOW_IN_PROCESS_WORKER = "false"
  JOB_DISPATCH_BATCH_LIMIT = "25"
  VIDEO_RENDER_POLL_INTERVAL_MS = "5000"
  VIDEO_RENDER_MAX_POLL_ATTEMPTS = "2160"
  SWEEP_MIN_LAMPORTS = "5000"
  SWEEP_BATCH_LIMIT = "50"
  WORKER_MAX_BODY_BYTES = "32768"
}

if (-not $envMap.ContainsKey("PAYMENT_MASTER_SEED_HEX")) {
  $null = gcloud secrets describe PAYMENT_MASTER_SEED_HEX --project=$ProjectId --format="value(name)" 2>$null
  if ($LASTEXITCODE -ne 0) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $seedHex = ([BitConverter]::ToString($bytes)).Replace("-", "").ToLowerInvariant()
    $envMap["PAYMENT_MASTER_SEED_HEX"] = $seedHex
    Write-Output "Generated PAYMENT_MASTER_SEED_HEX for App Hosting."
  } else {
    Write-Output "PAYMENT_MASTER_SEED_HEX already exists in Secret Manager; preserving existing value."
  }
}

foreach ($key in $defaults.Keys) {
  if (-not $envMap.ContainsKey($key)) {
    $envMap[$key] = $defaults[$key]
  }
}

$keys = $envMap.Keys | Sort-Object
$created = 0
$updated = 0

foreach ($key in $keys) {
  $value = [string]$envMap[$key]
  $null = gcloud secrets describe $key --project=$ProjectId --format="value(name)" 2>$null

  $tmp = [System.IO.Path]::GetTempFileName()
  [System.IO.File]::WriteAllText($tmp, $value, [System.Text.UTF8Encoding]::new($false))

  if ($LASTEXITCODE -ne 0) {
    gcloud secrets create $key --project=$ProjectId --replication-policy="automatic" --data-file=$tmp --quiet | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Remove-Item $tmp -Force
      throw "Failed to create secret $key"
    }
    $created++
  } else {
    gcloud secrets versions add $key --project=$ProjectId --data-file=$tmp --quiet | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Remove-Item $tmp -Force
      throw "Failed to add version for secret $key"
    }
    $updated++
  }

  Remove-Item $tmp -Force
}

$secretCsv = ($keys -join ",")
firebase apphosting:secrets:grantaccess $secretCsv --project $ProjectId --backend $BackendId --location $Location --non-interactive
if ($LASTEXITCODE -ne 0) {
  throw "Failed to grant App Hosting secret access"
}

Write-Output "Secrets created: $created"
Write-Output "Secrets updated: $updated"
Write-Output "Total secrets targeted: $($keys.Count)"
