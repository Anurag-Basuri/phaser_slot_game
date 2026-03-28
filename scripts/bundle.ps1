# Sweet Cluster 1000 — Deployment Bundle Script
# Creates a ZIP archive ready for Stake Engine ACP upload
# Run: powershell -ExecutionPolicy Bypass -File scripts/bundle.ps1

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Sweet Cluster 1000 — Build & Bundle" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Clean previous builds
Write-Host "[1/5] Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path "bundle") { Remove-Item -Recurse -Force "bundle" }
if (Test-Path "sweet_cluster_1000.zip") { Remove-Item -Force "sweet_cluster_1000.zip" }

# 2. Build frontend
Write-Host "[2/5] Building frontend..." -ForegroundColor Yellow
npx vite build
if ($LASTEXITCODE -ne 0) {
    Write-Host "BUILD FAILED!" -ForegroundColor Red
    exit 1
}
Write-Host "  Frontend built successfully." -ForegroundColor Green

# 3. Create bundle directory
Write-Host "[3/5] Creating bundle..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "bundle" -Force | Out-Null
Copy-Item -Recurse "dist/*" "bundle/"

# 4. Copy math engine outputs
Write-Host "[4/5] Copying math engine outputs..." -ForegroundColor Yellow
if (Test-Path "math-engine/output") {
    New-Item -ItemType Directory -Path "bundle/math" -Force | Out-Null
    Copy-Item "math-engine/output/game_config.json" "bundle/math/"
    Copy-Item "math-engine/output/rtp_report.txt" "bundle/math/" -ErrorAction SilentlyContinue
    if (Test-Path "math-engine/output/simulation_results.csv") {
        Copy-Item "math-engine/output/simulation_results.csv" "bundle/math/"
    }
    Write-Host "  Math outputs copied." -ForegroundColor Green
} else {
    Write-Host "  WARNING: No math-engine/output found. Run the simulation first!" -ForegroundColor Red
}

# 5. Create ZIP
Write-Host "[5/5] Creating ZIP archive..." -ForegroundColor Yellow
Compress-Archive -Path "bundle/*" -DestinationPath "sweet_cluster_1000.zip" -Force
$zipSize = (Get-Item "sweet_cluster_1000.zip").Length / 1MB
Write-Host "  Created: sweet_cluster_1000.zip ($([math]::Round($zipSize, 2)) MB)" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Bundle ready for Stake Engine upload!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Upload Instructions:" -ForegroundColor Yellow
Write-Host "  1. Log in to Stake Engine ACP" -ForegroundColor White
Write-Host "  2. Go to Games > Upload" -ForegroundColor White
Write-Host "  3. Upload sweet_cluster_1000.zip" -ForegroundColor White
Write-Host "  4. Upload math/game_config.json separately if required" -ForegroundColor White
Write-Host "  5. Submit for review" -ForegroundColor White
