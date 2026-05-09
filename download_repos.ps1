$ErrorActionPreference = "Stop"

$root = "C:\Users\Admin\Patient Health Risk Segregation"
New-Item -ItemType Directory -Path $root -Force | Out-Null

$repos = @(
    @{
        Name = "readmission-risk"
        Url = "https://github.com/bayesimpact/readmission-risk.git"
        Reason = "Best mature patient risk model found; includes trained neural-network files and feature extraction code."
    },
    @{
        Name = "Healthcare-Patient-Clustering-Risk-Stratification"
        Url = "https://github.com/bombaypranathi22/Healthcare-Patient-Clustering-Risk-Stratification.git"
        Reason = "Closest clustering-focused reference for patient risk segmentation."
    }
)

foreach ($repo in $repos) {
    $target = Join-Path $root $repo.Name
    if (Test-Path -LiteralPath $target) {
        Write-Host "Skipping existing folder: $target"
        continue
    }

    Write-Host "Downloading $($repo.Name)"
    Write-Host "Reason: $($repo.Reason)"
    git clone --depth 1 $repo.Url $target
}

Write-Host "Done."
