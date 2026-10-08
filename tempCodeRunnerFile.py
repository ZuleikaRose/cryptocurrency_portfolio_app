import json
import urllib.parse
import urllib.request
import os

api_key = os.getenv("CMC_API_KEY")
if not api_key:
    raise RuntimeError("Set the CMC_API_KEY environment variable first.")

symbols = ["BTC", "ETH", "LTC", "XRP"]

params = urllib.parse.urlencode({"symbol": ",".join(symbols), "convert": "USD"})
request = urllib.request.Request(
    "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?" + params,
    headers={"X-CMC_PRO_API_KEY": api_key, "Accept": "application/json"},
)

with urllib.request.urlopen(request, timeout=10) as response:
    data = json.loads(response.read().decode("utf-8"))["data"]

for symbol in symbols:
    coin = data.get(symbol)
    if coin:
        rank = coin["quote"]["USD"]["price"]["rank"]
        print(f"{coin['name']} ({symbol}): Rank {rank}")