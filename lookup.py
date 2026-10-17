import http.client # Import the http.client module for its connection-error exceptions
import json # Import the JSON module for parsing JSON data
import math # Import the math module for sizing sub-dollar prices
import os # Import the os module for accessing environment variables
import pathlib # Import the pathlib module for locating the local .env file
import time # Import the time module for waiting out the API's rate limit
import urllib.error # Import the urllib.error module for handling HTTP errors
import urllib.parse # Import the urllib.parse module for URL encoding
import urllib.request # Import the urllib.request module for making HTTP requests

RANKED_PAGES = 3 # How many rank-sorted pages (100 coins each) to scan before falling back to the full symbol map
MAX_CANDIDATES = 5 # How many same-ticker coins to look up individually in the fallback
MAX_RETRIES = 3 # How many times to retry after "429 Rate limit exceeded"


def load_env_file(path): # Read KEY=value lines from a .env file into os.environ without overwriting real environment variables
    if not path.exists(): # Nothing to load when the file is missing
        return
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as e: # Unreadable file: fall back to the shell environment only
        print(f"Warning: could not read {path.name}: {e}")
        return
    for line in text.splitlines(): # Go through the file one line at a time
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line: # Skip blank lines, comments, and malformed lines
            continue
        key, value = line.split("=", 1) # Split on the first "=" only, so values may contain "="
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'")) # A variable already set in the shell wins


load_env_file(pathlib.Path(__file__).with_name(".env")) # The .env file is git-ignored, so the key never reaches the repository

api_key = os.getenv("CRYPTORANK_API_KEY")
if not api_key:
    raise RuntimeError("Set the CRYPTORANK_API_KEY environment variable (or add it to the .env file) first.")

API_URL = os.getenv("API_V3_URL", "https://api.cryptorank.io/v3").rstrip("/") # CryptoRank v3 base URL (overridable in .env)


def to_rank(value): # Convert the API's rank to an integer; unranked coins come back as None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def to_price(value): # Convert the API's price to a float; missing or non-numeric prices become None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def best_rank(coin): # Sort key: rank 1 first, unranked coins last
    rank = to_rank(coin.get("rank"))
    return rank if rank is not None else float("inf")


def api_get(path, params=None): # GET {API_URL}/{path} and return the "data" field of the JSON body
    url = f"{API_URL}/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params) # URL encode the query parameters for the API request
    request = urllib.request.Request(url, headers={"X-Api-Key": api_key, "Accept": "application/json"}) # Send the API key in a header, never in the URL
    for attempt in range(MAX_RETRIES + 1):
        try:
            with urllib.request.urlopen(request, timeout=30) as response: # Make the API request and open the response
                body = json.loads(response.read().decode("utf-8")) # Parse the JSON response
            break
        except urllib.error.HTTPError as e: # The API returns an error status for things like a bad API key or too many requests
            if e.code == 429 and attempt < MAX_RETRIES: # Rate limited: wait (honouring Retry-After when it's a number), then try again
                retry_after = e.headers.get("Retry-After", "")
                time.sleep(int(retry_after) if retry_after.isdigit() else 2 ** (attempt + 1))
                continue
            try:
                error_body = json.loads(e.read().decode("utf-8", errors="replace"))
            except (ValueError, OSError, http.client.HTTPException): # HTML error pages (e.g. from the proxy), or the body couldn't be read
                error_body = None
            error = error_body.get("error", error_body) if isinstance(error_body, dict) else None # v3 nests the message under "error"
            message = error.get("message", e.reason) if isinstance(error, dict) else e.reason
            raise SystemExit(f"API error ({e.code}): {message}") # Exit the program with an error message if the API request fails
        except (OSError, http.client.HTTPException) as e: # Network down, DNS failure, timeout, connection reset, or a truncated body
            raise SystemExit(f"Could not reach the CryptoRank API: {getattr(e, 'reason', e)}")
        except ValueError: # The server answered, but not with valid JSON
            raise SystemExit("The CryptoRank API returned a response that isn't valid JSON.")

    data = body.get("data") if isinstance(body, dict) else None # Extract the "data" field
    if data is None: # Valid JSON, but not the shape we expect
        raise SystemExit("The CryptoRank API returned an unexpected response format.")
    return data


_ranked_pages = {} # page number -> list of coins, so several symbols share the same requests
_symbol_map = None # Every currency's id and symbol, fetched once on first use


def ranked_page(page): # One page of 100 coins sorted by rank (page 1 = ranks 1-100)
    if page not in _ranked_pages:
        coins = api_get("currencies/list", {"sortBy": "rank", "page": page})
        _ranked_pages[page] = [coin for coin in coins if isinstance(coin, dict)] if isinstance(coins, list) else []
    return _ranked_pages[page]


def symbol_map():
    global _symbol_map
    if _symbol_map is None:
        entries = api_get("currencies/map")
        _symbol_map = [entry for entry in entries if isinstance(entry, dict)] if isinstance(entries, list) else []
    return _symbol_map


def matches_symbol(coin, symbol):
    return str(coin.get("symbol", "")).upper() == symbol


def fetch_currency(symbol): # Look up one symbol and return the best-ranked coin that uses it
    # v3 has no symbol filter, so scan the top of the rank-sorted list first: the first hit is the best-ranked coin
    for page in range(1, RANKED_PAGES + 1):
        for coin in ranked_page(page):
            if matches_symbol(coin, symbol):
                return coin

    # Not in the top ranks: find every coin with this ticker (copycats included) and keep the best-ranked one
    ids = [entry.get("id") for entry in symbol_map() if matches_symbol(entry, symbol) and entry.get("id") is not None]
    candidates = []
    for coin_id in ids[:MAX_CANDIDATES]:
        coin = api_get(f"currencies/{urllib.parse.quote(str(coin_id))}")
        if isinstance(coin, dict):
            candidates.append(coin)
    return min(candidates, key=best_rank) if candidates else None


symbols = [] # List of cryptocurrency symbols entered by the user

# How many symbols are currently being tracked
while True:
    try:
        ticker_amount = int(input("How many cryptocurrency symbols are currently being tracked? "))
        if ticker_amount > 0:
            break
        print("Please enter a number greater than 0.")
    except ValueError:
        print("Please enter a whole number.")

while len(symbols) < ticker_amount: # Keep asking until we have the requested number of unique symbols
    symbol_input = input("Input a Cryptocurrency symbol to look up: ").upper().strip() # Get user input for a cryptocurrency symbol
    if not symbol_input: # Ignore empty input
        print("Symbol cannot be empty.")
    elif symbol_input in symbols: # Reject duplicates without using up a slot
        print(f"The symbol {symbol_input} has already been entered.")
    else:
        symbols.append(symbol_input) # Add the symbol to the list

# Print the list of entered cryptocurrency symbols
print("Entered cryptocurrency symbols:", symbols)

data = {symbol: fetch_currency(symbol) for symbol in symbols} # Map each symbol to its coin data, or None when not found

found = [symbol for symbol in symbols if data[symbol]] # Symbols the API returned data for
missing = [symbol for symbol in symbols if not data[symbol]] # Symbols the API returned no data for

# Sort by CryptoRank rank (1 is best); unranked coins (rank is None) go last
found.sort(key=lambda symbol: best_rank(data[symbol]))

for symbol_data in found: # Iterate over the symbols in rank order
    coin = data[symbol_data] # Get the data for the current symbol from the API response
    rank = to_rank(coin.get("rank")) # The rank as an integer, or None when the coin is unranked
    price = to_price(coin.get("price")) # None for coins without a current (or numeric) price
    if price is None: # Only format the price when it exists
        price_text = "price unavailable"
    elif price >= 1 or price <= 0:
        price_text = f"${price:,.2f}"
    else: # Sub-dollar coins keep 4 significant digits instead of showing $0.00 (e.g. $0.00002371)
        price_text = f"${price:.{3 - math.floor(math.log10(price))}f}"
    rank_text = f"Rank {rank}" if rank is not None else "Unranked"
    print(f"{rank_text} {coin.get('name', symbol_data)} ({symbol_data}): {price_text}") # Print the rank, name, symbol, and price of the cryptocurrency

for symbol_data in missing: # Report symbols with no data after the ranked ones
    print(f"No data found for symbol: {symbol_data}") # Print a message if no data is found for the symbol
