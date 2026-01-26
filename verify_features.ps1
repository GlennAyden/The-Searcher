# verify_features.ps1
# Feature-level API smoke tests for Project Searcher.
# Safe by default (read-only). Use -IncludeWrites to run write operations.

param(
    [string]$BackendUrl = "http://localhost:8000",
    [string]$FrontendUrl = "http://localhost:3000",
    [switch]$CheckFrontendRoutes,
    [switch]$IncludeWrites
)

$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$reportPath = Join-Path $PSScriptRoot "feature_test_report_$timestamp.txt"
Start-Transcript -Path $reportPath | Out-Null

try {

$passCount = 0
$warnCount = 0
$failCount = 0

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " $Title" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Add-Result {
    param([string]$Status, [string]$Message)
    switch ($Status) {
        "PASS" {
            $script:passCount += 1
            Write-Host "[PASS] $Message" -ForegroundColor Green
        }
        "WARN" {
            $script:warnCount += 1
            Write-Host "[WARN] $Message" -ForegroundColor Yellow
        }
        "FAIL" {
            $script:failCount += 1
            Write-Host "[FAIL] $Message" -ForegroundColor Red
        }
    }
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Url,
        [object]$Body = $null
    )

    $content = ""
    $status = $null
    try {
        if ($Method -eq "GET") {
            $resp = Invoke-WebRequest -Uri $Url -Method Get -UseBasicParsing -TimeoutSec 30
        } else {
            $json = ""
            if ($Body -ne $null) {
                $json = $Body | ConvertTo-Json -Depth 8
            }
            $resp = Invoke-WebRequest -Uri $Url -Method $Method -Body $json -ContentType "application/json" -UseBasicParsing -TimeoutSec 30
        }
        $status = [int]$resp.StatusCode
        $content = $resp.Content
    } catch {
        if ($_.Exception.Response) {
            try {
                $status = [int]$_.Exception.Response.StatusCode.value__
                $reader = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
                $content = $reader.ReadToEnd()
                $reader.Close()
            } catch {
                $content = ""
            }
        }
        return @{
            Status = $status
            Raw    = $content
            Body   = $null
            Error  = $_.Exception.Message
        }
    }

    $body = $null
    if ($content) {
        try {
            $body = $content | ConvertFrom-Json -ErrorAction Stop
        } catch {
            $body = $null
        }
    }

    return @{
        Status = $status
        Raw    = $content
        Body   = $body
        Error  = $null
    }
}

function Get-ArrayCount {
    param([object]$Value)
    if ($Value -is [System.Array]) {
        return $Value.Count
    }
    return 0
}

function Test-JsonKeyList {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Key,
        [bool]$AllowEmpty = $true
    )
    $resp = Invoke-Api -Method "GET" -Url $Url
    if ($resp.Status -ne 200) {
        if ($resp.Status -eq 404) {
            Add-Result "WARN" "$Name returned 404 (no data)."
        } else {
            Add-Result "FAIL" "$Name failed with status $($resp.Status)."
        }
        return $resp
    }

    if (-not $resp.Body -or -not ($resp.Body.PSObject.Properties.Name -contains $Key)) {
        Add-Result "FAIL" "$Name response missing key '$Key'."
        return $resp
    }

    $count = Get-ArrayCount $resp.Body.$Key
    if ($count -eq 0 -and -not $AllowEmpty) {
        Add-Result "WARN" "$Name returned empty list for '$Key'."
    } else {
        Add-Result "PASS" "$Name ok."
    }

    return $resp
}

function Test-JsonObjectKeys {
    param(
        [string]$Name,
        [string]$Url,
        [string[]]$Keys = @()
    )
    $resp = Invoke-Api -Method "GET" -Url $Url
    if ($resp.Status -ne 200) {
        if ($resp.Status -eq 404) {
            Add-Result "WARN" "$Name returned 404 (no data)."
        } else {
            Add-Result "FAIL" "$Name failed with status $($resp.Status)."
        }
        return $resp
    }

    if (-not $resp.Body) {
        Add-Result "FAIL" "$Name did not return JSON."
        return $resp
    }

    $missing = @()
    foreach ($key in $Keys) {
        if (-not ($resp.Body.PSObject.Properties.Name -contains $key)) {
            $missing += $key
        }
    }
    if ($missing.Count -gt 0) {
        Add-Result "FAIL" "$Name missing keys: $($missing -join ', ')."
    } else {
        Add-Result "PASS" "$Name ok."
    }
    return $resp
}

function Test-JsonArray {
    param(
        [string]$Name,
        [string]$Url,
        [bool]$AllowEmpty = $true
    )
    $resp = Invoke-Api -Method "GET" -Url $Url
    if ($resp.Status -ne 200) {
        if ($resp.Status -eq 404) {
            Add-Result "WARN" "$Name returned 404 (no data)."
        } else {
            Add-Result "FAIL" "$Name failed with status $($resp.Status)."
        }
        return $resp
    }

    if ($null -eq $resp.Body -or -not ($resp.Body -is [System.Array])) {
        Add-Result "FAIL" "$Name did not return a JSON array."
        return $resp
    }

    if ($resp.Body.Count -eq 0 -and -not $AllowEmpty) {
        Add-Result "WARN" "$Name returned empty list."
    } else {
        Add-Result "PASS" "$Name ok."
    }
    return $resp
}

function Test-PostJson {
    param(
        [string]$Name,
        [string]$Url,
        [object]$Body
    )
    $resp = Invoke-Api -Method "POST" -Url $Url -Body $Body
    if ($resp.Status -ne 200) {
        if ($resp.Status -eq 404) {
            Add-Result "WARN" "$Name returned 404 (no data)."
        } else {
            Add-Result "FAIL" "$Name failed with status $($resp.Status)."
        }
        return $resp
    }
    Add-Result "PASS" "$Name ok."
    return $resp
}

Write-Section "Backend Health"
$health = Invoke-Api -Method "GET" -Url "$BackendUrl/"
if ($health.Status -ne 200) {
    Add-Result "FAIL" "Backend health check failed. Status: $($health.Status)."
    Write-Host "Stopping tests due to backend unavailability." -ForegroundColor Red
    throw "Backend unavailable"
}
Add-Result "PASS" "Backend health check ok."

$today = (Get-Date).ToString("yyyy-MM-dd")

Write-Section "Discover Sample Ticker"
$issuerResp = Test-JsonKeyList -Name "Issuer tickers" -Url "$BackendUrl/api/issuer-tickers" -Key "tickers" -AllowEmpty $true
$ticker = $null
if ($issuerResp.Body -and $issuerResp.Body.tickers -and $issuerResp.Body.tickers.Count -gt 0) {
    $ticker = $issuerResp.Body.tickers[0]
}
if (-not $ticker) {
    $neoTickersResp = Invoke-Api -Method "GET" -Url "$BackendUrl/api/neobdm-tickers"
    if ($neoTickersResp.Status -eq 200 -and $neoTickersResp.Body -and $neoTickersResp.Body.tickers -and $neoTickersResp.Body.tickers.Count -gt 0) {
        $ticker = $neoTickersResp.Body.tickers[0]
    }
}
if (-not $ticker) {
    $newsTickersResp = Invoke-Api -Method "GET" -Url "$BackendUrl/api/tickers"
    if ($newsTickersResp.Status -eq 200 -and $newsTickersResp.Body -and $newsTickersResp.Body.tickers -and $newsTickersResp.Body.tickers.Count -gt 0) {
        $ticker = $newsTickersResp.Body.tickers[0]
    }
}
if (-not $ticker) {
    $ticker = "BBCA"
    Add-Result "WARN" "No tickers found in DB. Using fallback ticker BBCA."
} else {
    Add-Result "PASS" "Using sample ticker: $ticker"
}

Write-Section "Dashboard"
Test-JsonObjectKeys -Name "Dashboard stats" -Url "$BackendUrl/api/dashboard-stats" -Keys @("price", "mood_score", "correlation", "volume")
Test-JsonArray -Name "Market data" -Url "$BackendUrl/api/market-data" -AllowEmpty $true
Test-JsonArray -Name "Sentiment data" -Url "$BackendUrl/api/sentiment-data" -AllowEmpty $true
Test-JsonKeyList -Name "Dashboard tickers" -Url "$BackendUrl/api/tickers" -Key "tickers" -AllowEmpty $true

Write-Section "News Library"
Test-JsonArray -Name "News list" -Url "$BackendUrl/api/news" -AllowEmpty $true
Test-JsonObjectKeys -Name "Brief news" -Url "$BackendUrl/api/brief-news" -Keys @("brief")
$briefTitle = [System.Uri]::EscapeDataString("Test headline for brief")
Test-JsonObjectKeys -Name "Brief single" -Url "$BackendUrl/api/brief-single?title=$briefTitle&ticker=$ticker" -Keys @("brief")
Test-JsonObjectKeys -Name "Ticker counts" -Url "$BackendUrl/api/ticker-counts" -Keys @("counts")
Test-JsonObjectKeys -Name "Wordcloud" -Url "$BackendUrl/api/wordcloud" -Keys @("image")
Test-JsonObjectKeys -Name "Story finder keywords" -Url "$BackendUrl/api/story-finder/keywords" -Keys @("keywords")
Test-JsonObjectKeys -Name "Story finder" -Url "$BackendUrl/api/story-finder?keywords=dividen" -Keys @("stories", "total")

Write-Section "IDX Disclosures + RAG Chat"
$disclosuresResp = Test-JsonArray -Name "Disclosures list" -Url "$BackendUrl/api/disclosures" -AllowEmpty $true
if ($disclosuresResp.Body -and $disclosuresResp.Body.Count -gt 0) {
    $doc = $disclosuresResp.Body[0]
    $chatBody = @{
        doc_id    = $doc.id
        doc_title = $doc.title
        prompt    = "Ringkas isi dokumen ini dalam 1 kalimat."
    }
    $chatResp = Invoke-Api -Method "POST" -Url "$BackendUrl/api/chat" -Body $chatBody
    if ($chatResp.Status -eq 200) {
        Add-Result "PASS" "RAG chat ok."
    } else {
        Add-Result "WARN" "RAG chat failed (status $($chatResp.Status))."
    }
} else {
    Add-Result "WARN" "No disclosures available for chat test."
}

if ($IncludeWrites) {
    $syncResp = Invoke-Api -Method "POST" -Url "$BackendUrl/api/sync-disclosures" -Body @{}
    if ($syncResp.Status -eq 200) {
        Add-Result "PASS" "Sync disclosures ok."
    } else {
        Add-Result "WARN" "Sync disclosures failed (status $($syncResp.Status))."
    }
} else {
    Write-Host "[INFO] Skipping sync disclosures (IncludeWrites not set)." -ForegroundColor DarkGray
}

Write-Section "NeoBDM Summary"
Test-JsonObjectKeys -Name "NeoBDM summary (daily)" -Url "$BackendUrl/api/neobdm-summary?method=m&period=d" -Keys @("scraped_at", "data")
Test-JsonObjectKeys -Name "NeoBDM summary (cumulative)" -Url "$BackendUrl/api/neobdm-summary?method=m&period=c" -Keys @("scraped_at", "data")
Test-JsonKeyList -Name "NeoBDM dates" -Url "$BackendUrl/api/neobdm-dates" -Key "dates" -AllowEmpty $true
$hotResp = Test-JsonObjectKeys -Name "NeoBDM hot list" -Url "$BackendUrl/api/neobdm-hot" -Keys @("signals")
Test-JsonKeyList -Name "NeoBDM tickers" -Url "$BackendUrl/api/neobdm-tickers" -Key "tickers" -AllowEmpty $true

Write-Section "NeoBDM Tracker"
Test-JsonObjectKeys -Name "NeoBDM history" -Url "$BackendUrl/api/neobdm-history?symbol=$ticker&method=m&period=c&limit=30" -Keys @("symbol", "history")

Write-Section "Broker Summary"
$datesResp = Invoke-Api -Method "GET" -Url "$BackendUrl/api/neobdm-broker-summary/available-dates/$ticker"
$brokerDate = $today
if ($datesResp.Status -eq 200 -and $datesResp.Body -and $datesResp.Body.available_dates -and $datesResp.Body.available_dates.Count -gt 0) {
    $brokerDate = $datesResp.Body.available_dates[0]
    Add-Result "PASS" "Broker summary dates ok."
} elseif ($datesResp.Status -eq 200) {
    Add-Result "WARN" "Broker summary dates empty."
} else {
    Add-Result "WARN" "Broker summary dates failed (status $($datesResp.Status))."
}

$brokerSummaryResp = Invoke-Api -Method "GET" -Url "$BackendUrl/api/neobdm-broker-summary?ticker=$ticker&trade_date=$brokerDate"
if ($brokerSummaryResp.Status -eq 200) {
    Add-Result "PASS" "Broker summary ok."
} elseif ($brokerSummaryResp.Status -eq 404) {
    Add-Result "WARN" "Broker summary no data."
} else {
    Add-Result "FAIL" "Broker summary failed (status $($brokerSummaryResp.Status))."
}

Test-JsonObjectKeys -Name "Broker summary top holders" -Url "$BackendUrl/api/neobdm-broker-summary/top-holders/$ticker?limit=3" -Keys @("ticker", "top_holders")
$floorResp = Invoke-Api -Method "GET" -Url "$BackendUrl/api/neobdm-broker-summary/floor-price/$ticker?days=30"
if ($floorResp.Status -eq 200) {
    if ($floorResp.Body.confidence -eq "NO_DATA") {
        Add-Result "WARN" "Floor price returned NO_DATA."
    } else {
        Add-Result "PASS" "Floor price ok."
    }
} else {
    Add-Result "FAIL" "Floor price failed (status $($floorResp.Status))."
}
Test-JsonObjectKeys -Name "Broker summary alternate endpoint" -Url "$BackendUrl/api/broker-summary?ticker=$ticker&trade_date=$brokerDate" -Keys @("ticker", "trade_date", "buy", "sell")
Test-JsonObjectKeys -Name "Broker five list" -Url "$BackendUrl/api/broker-five?ticker=$ticker" -Keys @("items")

$journeyBroker = "YP"
if ($brokerSummaryResp.Body -and $brokerSummaryResp.Body.buy -and $brokerSummaryResp.Body.buy.Count -gt 0) {
    $journeyBroker = $brokerSummaryResp.Body.buy[0].broker
}
$journeyBody = @{
    ticker = $ticker
    brokers = @($journeyBroker)
    start_date = $brokerDate
    end_date = $brokerDate
}
Test-PostJson -Name "Broker journey" -Url "$BackendUrl/api/neobdm-broker-summary/journey" -Body $journeyBody

if ($IncludeWrites) {
    $batchBody = @(
        @{
            ticker = $ticker
            dates = @($brokerDate)
        }
    )
    $batchResp = Invoke-Api -Method "POST" -Url "$BackendUrl/api/neobdm-broker-summary-batch" -Body $batchBody
    if ($batchResp.Status -eq 200) {
        Add-Result "PASS" "Broker summary batch ok."
    } else {
        Add-Result "WARN" "Broker summary batch failed (status $($batchResp.Status))."
    }
} else {
    Write-Host "[INFO] Skipping broker summary batch (IncludeWrites not set)." -ForegroundColor DarkGray
}

Write-Section "Price & Volume"
$pvExistsResp = Invoke-Api -Method "GET" -Url "$BackendUrl/api/price-volume/$ticker/exists"
$pvExists = $false
if ($pvExistsResp.Status -eq 200 -and $pvExistsResp.Body -and $pvExistsResp.Body.exists -eq $true) {
    $pvExists = $true
    Add-Result "PASS" "Price-volume exists check ok."
} elseif ($pvExistsResp.Status -eq 200) {
    Add-Result "WARN" "Price-volume data not found for ticker."
} else {
    Add-Result "FAIL" "Price-volume exists check failed (status $($pvExistsResp.Status))."
}

if ($pvExists) {
    Test-JsonObjectKeys -Name "Price-volume data" -Url "$BackendUrl/api/price-volume/$ticker?months=1" -Keys @("ticker", "data", "records_count")
    Test-JsonObjectKeys -Name "Spike markers" -Url "$BackendUrl/api/price-volume/$ticker/spike-markers" -Keys @("ticker", "markers")
    Test-JsonObjectKeys -Name "Compression" -Url "$BackendUrl/api/price-volume/$ticker/compression" -Keys @("ticker")
    Test-JsonObjectKeys -Name "Flow impact" -Url "$BackendUrl/api/price-volume/$ticker/flow-impact" -Keys @("ticker", "date")
    Test-JsonObjectKeys -Name "Market cap" -Url "$BackendUrl/api/price-volume/$ticker/market-cap" -Keys @("ticker", "current_market_cap")
} else {
    Add-Result "WARN" "Skipping ticker-specific price-volume tests (no data)."
}

Test-JsonObjectKeys -Name "Unusual volume scan" -Url "$BackendUrl/api/price-volume/unusual/scan" -Keys @("unusual_volumes", "total_tickers_scanned")
Test-JsonObjectKeys -Name "Anomaly scan" -Url "$BackendUrl/api/price-volume/anomaly/scan" -Keys @("anomalies", "stats")

Write-Section "Alpha Hunter"
Test-JsonObjectKeys -Name "Alpha Hunter stage1 scan" -Url "$BackendUrl/api/alpha-hunter/stage1/scan?min_score=45" -Keys @("signals", "filtered_count")
Test-JsonObjectKeys -Name "Alpha Hunter legacy scan" -Url "$BackendUrl/api/alpha-hunter/scan?min_score=60" -Keys @("results", "count")
Test-JsonObjectKeys -Name "Alpha Hunter flow" -Url "$BackendUrl/api/alpha-hunter/flow/$ticker?days=7" -Keys @("ticker", "data_available")
Test-JsonObjectKeys -Name "Alpha Hunter supply" -Url "$BackendUrl/api/alpha-hunter/supply/$ticker" -Keys @("ticker")
Test-JsonObjectKeys -Name "Alpha Hunter watchlist" -Url "$BackendUrl/api/alpha-hunter/watchlist" -Keys @("watchlist")

if ($pvExists) {
    $vpaResp = Invoke-Api -Method "GET" -Url "$BackendUrl/api/alpha-hunter/stage2/vpa/$ticker"
    if ($vpaResp.Status -eq 200) {
        Add-Result "PASS" "Alpha Hunter stage2 VPA ok."
    } elseif ($vpaResp.Status -eq 404) {
        Add-Result "WARN" "Alpha Hunter stage2 VPA no data."
    } else {
        Add-Result "FAIL" "Alpha Hunter stage2 VPA failed (status $($vpaResp.Status))."
    }
    $visResp = Invoke-Api -Method "GET" -Url "$BackendUrl/api/alpha-hunter/stage2/visualization/$ticker"
    if ($visResp.Status -eq 200) {
        Add-Result "PASS" "Alpha Hunter stage2 visualization ok."
    } elseif ($visResp.Status -eq 404) {
        Add-Result "WARN" "Alpha Hunter stage2 visualization no data."
    } else {
        Add-Result "FAIL" "Alpha Hunter stage2 visualization failed (status $($visResp.Status))."
    }
} else {
    Add-Result "WARN" "Skipping Alpha Hunter stage2 checks (no price-volume data)."
}

if ($IncludeWrites) {
    $watchBody = @{
        ticker = $ticker
        action = "add"
        scan_data = @{
            total_score = 0
            breakdown = @{ spike_date = $today }
        }
    }
    $watchAdd = Invoke-Api -Method "POST" -Url "$BackendUrl/api/alpha-hunter/watchlist" -Body $watchBody
    if ($watchAdd.Status -eq 200) {
        Add-Result "PASS" "Alpha Hunter watchlist add ok."
        $watchRemove = Invoke-Api -Method "POST" -Url "$BackendUrl/api/alpha-hunter/watchlist" -Body @{ ticker = $ticker; action = "remove" }
        if ($watchRemove.Status -eq 200) {
            Add-Result "PASS" "Alpha Hunter watchlist remove ok."
        } else {
            Add-Result "WARN" "Alpha Hunter watchlist remove failed (status $($watchRemove.Status))."
        }
    } else {
        Add-Result "WARN" "Alpha Hunter watchlist add failed (status $($watchAdd.Status))."
    }
} else {
    Write-Host "[INFO] Skipping Alpha Hunter watchlist write tests (IncludeWrites not set)." -ForegroundColor DarkGray
}

Write-Section "Done Detail"
$historyResp = Invoke-Api -Method "GET" -Url "$BackendUrl/api/done-detail/history"
$doneTicker = $ticker
$doneDate = $today
if ($historyResp.Status -eq 200 -and $historyResp.Body -and $historyResp.Body.history -and $historyResp.Body.history.Count -gt 0) {
    $doneTicker = $historyResp.Body.history[0].ticker
    $doneDate = $historyResp.Body.history[0].trade_date
    Add-Result "PASS" "Done detail history ok."
} elseif ($historyResp.Status -eq 200) {
    Add-Result "WARN" "Done detail history empty."
} else {
    Add-Result "FAIL" "Done detail history failed (status $($historyResp.Status))."
}

Test-JsonObjectKeys -Name "Done detail status" -Url "$BackendUrl/api/done-detail/status" -Keys @("data")
Test-JsonObjectKeys -Name "Done detail exists" -Url "$BackendUrl/api/done-detail/exists/$doneTicker/$doneDate" -Keys @("exists", "ticker")
Test-JsonObjectKeys -Name "Done detail data" -Url "$BackendUrl/api/done-detail/data/$doneTicker/$doneDate" -Keys @("records", "count")
Test-JsonObjectKeys -Name "Done detail sankey" -Url "$BackendUrl/api/done-detail/sankey/$doneTicker/$doneDate" -Keys @("nodes", "links")
Test-JsonObjectKeys -Name "Done detail inventory" -Url "$BackendUrl/api/done-detail/inventory/$doneTicker/$doneDate?interval=1" -Keys @("brokers", "timeSeries", "priceData")
Test-JsonObjectKeys -Name "Done detail analysis" -Url "$BackendUrl/api/done-detail/analysis/$doneTicker/$doneDate" -Keys @("status")
Test-JsonObjectKeys -Name "Done detail imposter" -Url "$BackendUrl/api/done-detail/imposter/$doneTicker?start_date=$doneDate&end_date=$doneDate" -Keys @("ticker", "date_range")
Test-JsonObjectKeys -Name "Done detail speed" -Url "$BackendUrl/api/done-detail/speed/$doneTicker?start_date=$doneDate&end_date=$doneDate" -Keys @("ticker", "date_range")
Test-JsonObjectKeys -Name "Done detail combined" -Url "$BackendUrl/api/done-detail/combined/$doneTicker?start_date=$doneDate&end_date=$doneDate" -Keys @("ticker", "date_range")
Test-JsonObjectKeys -Name "Done detail broker profile" -Url "$BackendUrl/api/done-detail/broker/$doneTicker/YP?start_date=$doneDate&end_date=$doneDate" -Keys @("broker", "status")
Test-JsonObjectKeys -Name "Done detail range analysis" -Url "$BackendUrl/api/done-detail/range-analysis/$doneTicker?start_date=$doneDate&end_date=$doneDate" -Keys @("ticker")

Write-Section "Scraper Engine (Optional)"
if ($IncludeWrites) {
    $scrapeBody = @{
        source = "EmitenNews"
        start_date = $today
        end_date = $today
        ticker = $ticker
        scrape_all_history = $false
    }
    $scrapeResp = Invoke-Api -Method "POST" -Url "$BackendUrl/api/scrape" -Body $scrapeBody
    if ($scrapeResp.Status -eq 200) {
        Add-Result "PASS" "Scrape endpoint ok."
    } else {
        Add-Result "WARN" "Scrape endpoint failed (status $($scrapeResp.Status))."
    }
} else {
    Write-Host "[INFO] Skipping scraper endpoint (IncludeWrites not set)." -ForegroundColor DarkGray
}

if ($CheckFrontendRoutes) {
    Write-Section "Frontend Routes"
    $routes = @(
        "/dashboard",
        "/news-library",
        "/rag-chat",
        "/neobdm-summary",
        "/neobdm-tracker",
        "/broker-summary",
        "/price-volume",
        "/alpha-hunter",
        "/done-detail",
        "/broker-stalker"
    )

    foreach ($route in $routes) {
        $url = "$FrontendUrl$route"
        $resp = Invoke-Api -Method "GET" -Url $url
        if ($resp.Status -eq 200) {
            Add-Result "PASS" "Frontend route ok: $route"
        } elseif ($resp.Status -eq $null) {
            Add-Result "WARN" "Frontend route unreachable: $route"
        } else {
            Add-Result "WARN" "Frontend route returned status $($resp.Status): $route"
        }
    }
} else {
    Write-Section "Frontend Routes"
    Write-Host "[INFO] Skipping frontend route checks (CheckFrontendRoutes not set)." -ForegroundColor DarkGray
}

Write-Section "Summary"
Write-Host "Passed: $passCount"
Write-Host "Warnings: $warnCount"
Write-Host "Failed: $failCount"

if ($failCount -gt 0) {
    exit 1
}
exit 0
} finally {
    try {
        Stop-Transcript | Out-Null
        Write-Host ""
        Write-Host "Report saved to: $reportPath" -ForegroundColor Cyan
    } catch {
        # If transcript failed to stop, ignore to preserve exit code.
    }
}
