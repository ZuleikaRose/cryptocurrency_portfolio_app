import http.client # Import the http.client module for its connection-error exceptions
import json # Import the JSON module for parsing JSON data
import math # Import the math module for sizing sub-dollar prices
import os # Import the os module for accessing environment variables
import pathlib # Import the pathlib module for locating the local .env file
import urllib.error # Import the urllib.error module for handling HTTP errors
import urllib.request # Import the urllib.request module for making HTTP requests

# The CryptoRank API key lives only in Supabase, as the CRYPTORANK_API_KEY Edge Function secret.
# Supabase never hands a secret back, so this script asks the cryptorank-lookup Edge Function to do
# the lookup with it. Only the project URL and the publishable key are needed here; both are public.
FUNCTION_NAME = "cryptorank-lookup"
BATCH_SIZE = 5 # The function looks up at most 5 symbols per request


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


load_env_file(pathlib.Path(__file__).with_name(".env")) # The .env file is git-ignored

supabase_url = (os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or "").rstrip("/")
publishable_key = os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY")
if not supabase_url or not publishable_key:
    raise RuntimeError("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or their VITE_ versions) in the environment or the .env file first.")

FUNCTION_URL = f"{supabase_url}/functions/v1/{FUNCTION_NAME}"


def to_rank(value): # Convert the rank to an integer; unranked coins come back as None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def to_price(value): # Convert the price to a float; missing or non-numeric prices become None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def best_rank(coin): # Sort key: rank 1 first, unranked coins last
    rank = to_rank(coin.get("rank"))
    return rank if rank is not None else float("inf")


def lookup(batch): # POST up to 5 symbols to the Edge Function and return its list of results
    payload = json.dumps({"symbols": batch}).encode("utf-8")
    request = urllib.request.Request(
        FUNCTION_URL,
        data=payload,
        method="POST",
        headers={"apikey": publishable_key, "Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response: # The function makes up to 6 CryptoRank requests, so allow time
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e: # Bad input, daily budget used up (429), CryptoRank busy (503), and so on
        try:
            message = json.loads(e.read().decode("utf-8", errors="replace")).get("error", e.reason)
        except (ValueError, OSError, AttributeError, http.client.HTTPException):
            message = e.reason
        if e.code == 404:
            message = f"the {FUNCTION_NAME} Edge Function isn't deployed"
        raise SystemExit(f"Lookup error ({e.code}): {message}")
    except (OSError, http.client.HTTPException) as e: # Network down, DNS failure, timeout, or connection reset
        raise SystemExit(f"Could not reach Supabase: {getattr(e, 'reason', e)}")
    except ValueError: # The server answered, but not with valid JSON
        raise SystemExit("The lookup returned a response that isn't valid JSON.")
    results = body.get("results") if isinstance(body, dict) else None
    if not isinstance(results, list): # Valid JSON, but not the shape we expect
        raise SystemExit("The lookup returned an unexpected response format.")
    if body.get("note"): # The function stopped early (daily budget or per-request limit)
        print(f"Note: {body['note']}")
    return results


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
    elif not (symbol_input.isascii() and symbol_input.isalnum()) or len(symbol_input) > 15: # The function accepts 1 to 15 letters or digits
        print("Symbols are 1 to 15 letters or digits, like BTC.")
    elif symbol_input in symbols: # Reject duplicates without using up a slot
        print(f"The symbol {symbol_input} has already been entered.")
    else:
        symbols.append(symbol_input) # Add the symbol to the list

# Print the list of entered cryptocurrency symbols
print("Entered cryptocurrency symbols:", symbols)

data = {} # symbol -> result from the Edge Function
for start in range(0, len(symbols), BATCH_SIZE): # Look the symbols up 5 at a time
    for result in lookup(symbols[start:start + BATCH_SIZE]):
        if isinstance(result, dict) and result.get("symbol") in symbols:
            data[result["symbol"]] = result

found = [symbol for symbol in symbols if data.get(symbol, {}).get("status") == "found"] # Symbols CryptoRank returned data for
missing = [symbol for symbol in symbols if data.get(symbol, {}).get("status") == "not_found"] # Symbols CryptoRank doesn't list
unchecked = [symbol for symbol in symbols if symbol not in found and symbol not in missing] # Skipped by the function's limits

# Sort by CryptoRank rank (1 is best); unranked coins (rank is None) go last
found.sort(key=lambda symbol: best_rank(data[symbol]))

for symbol_data in found: # Iterate over the symbols in rank order
    coin = data[symbol_data] # Get the data for the current symbol
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

for symbol_data in unchecked: # The function stopped before reaching these
    print(f"Not looked up (lookup limit reached): {symbol_data}")
