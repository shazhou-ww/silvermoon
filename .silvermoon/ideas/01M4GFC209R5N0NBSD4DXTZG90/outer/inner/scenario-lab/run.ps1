$ErrorActionPreference = "Stop"

$labDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryRoot = (git -C $labDirectory rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repositoryRoot)) {
    throw "Cannot resolve the Silvermoon checkout for the scenario lab."
}

$env:SCENARIO_SOURCE_REVISION = (git -C $repositoryRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Cannot resolve the Silvermoon checkout revision."
}
$sourceChanges = git -C $repositoryRoot status --porcelain
if ($LASTEXITCODE -ne 0) {
    throw "Cannot inspect Silvermoon checkout changes."
}
$env:SCENARIO_SOURCE_DIRTY = if ($sourceChanges) { "true" } else { "false" }

$composeFile = Join-Path $labDirectory "compose.yaml"
$bundlePath = Join-Path $labDirectory "source.bundle"
try {
    git -C $repositoryRoot bundle create $bundlePath HEAD
    if ($LASTEXITCODE -ne 0) {
        throw "Cannot create the current HEAD bundle for the scenario lab."
    }
    docker compose --project-directory $labDirectory -f $composeFile run --build --rm corpus
    if ($LASTEXITCODE -ne 0) {
        throw "Docker scenario collection failed with exit code $LASTEXITCODE."
    }
}
finally {
    if (Test-Path $bundlePath) {
        Remove-Item -LiteralPath $bundlePath
    }
}
