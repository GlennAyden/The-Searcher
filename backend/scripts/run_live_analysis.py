import asyncio
import sys
import os
import logging
from rich.live import Live
from rich.table import Table
from rich.console import Console
from rich.layout import Layout
from rich.panel import Panel
from rich.text import Text

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from stockbit_client import StockbitClient
from accum_dist import TradeAnalyzer

# Configure Logging
logging.basicConfig(level=logging.WARNING)

def generate_table(stats: dict, ticker: str) -> Table:
    table = Table(title=f"Live Analysis: {ticker}", expand=True)
    table.add_column("Metric", justify="right", style="cyan", no_wrap=True)
    table.add_column("Value", style="magenta")

    if not stats:
        return table

    table.add_row("Last Price", f"{stats.get('last_price', 'N/A')}")
    table.add_row("Net Volume", f"[bold]{stats.get('net_vol', 0):,}[/bold]")
    table.add_row("Accum Power", f"[green]{stats.get('buy_power', 50)}%[/green]")
    table.add_row("Dist Power", f"[red]{stats.get('sell_power', 50)}%[/red]")
    table.add_row("Total Buy Vol", f"{stats.get('total_buy_vol', 0):,}")
    table.add_row("Total Sell Vol", f"{stats.get('total_sell_vol', 0):,}")
    table.add_row("Total Value", f"Rp {stats.get('total_value', 0):,.0f}")
    
    return table

async def run_live(ticker="BBCA"):
    client = StockbitClient(headless=True)
    analyzer = TradeAnalyzer()
    
    console = Console()
    
    try:
        with Live(generate_table({}, ticker), refresh_per_second=1) as live:
            while True:
                # Fetch Data
                resp = await client.get_running_trade(ticker)
                
                if "error" in resp:
                    console.print(f"[red]Error fetching data: {resp['error']}[/red]")
                    await asyncio.sleep(2)
                    continue
                
                trades = resp.get("data", {}).get("running_trade", [])
                
                # Analyze
                stats = analyzer.process_trades(trades)
                
                # Update UI
                live.update(generate_table(stats, ticker))
                
                # Poll Rate
                await asyncio.sleep(1) # 1s poll might be aggressive, but for "Real-Time" it's needed.

    except KeyboardInterrupt:
        print("Stopping...")
    finally:
        await client.close()

if __name__ == "__main__":
    import os
    ticker = sys.argv[1] if len(sys.argv) > 1 else "BBCA"
    asyncio.run(run_live(ticker))
