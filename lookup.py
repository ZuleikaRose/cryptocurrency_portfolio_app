import http.client # Import the http.client module for its connection-error exceptions
import json # Import the JSON module for parsing JSON data
import os # Import the os module for accessing environment variables
import pathlib # Import the pathlib module for locating the local .env file
import urllib.error # Import the urllib.error module for handling HTTP errors
import urllib.parse # Import the urllib.parse module for URL encoding
import urllib.request # Import the urllib.request module for making HTTP requests

API_URL = "https://api.cryptorank.io/v2/currencies" # CryptoRank v2 endpoint that lists currencies with their rank


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


def fetch_currency(symbol): # Look up one symbol and return the best-ranked coin that uses it
    params = urllib.parse.urlencode({"symbol": symbol, "limit": 100}) # URL encode the query parameters for the API request
    request = urllib.request.Request(
        f"{API_URL}?{params}", # Construct the full URL for the API request with the query parameters
        headers={"X-Api-Key": api_key, "Accept": "application/json"}, # Send the API key in a header, never in the URL
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response: # Make the API request and open the response
            body = json.loads(response.read().decode("utf-8")) # Parse the JSON response
    except urllib.error.HTTPError as e: # The API returns an error status for things like a bad API key or too many requests
        try:
            error_body = json.loads(e.read().decode("utf-8", errors="replace"))
        except (ValueError, OSError, http.client.HTTPException): # HTML error pages (e.g. from the proxy), or the body couldn't be read
            error_body = None
        error = error_body.get("message", e.reason) if isinstance(error_body, dict) else e.reason
        raise SystemExit(f"API error ({e.code}): {error}") # Exit the program with an error message if the API request fails
    except (OSError, http.client.HTTPException) as e: # Network down, DNS failure, timeout, connection reset, or a truncated body
        raise SystemExit(f"Could not reach the CryptoRank API: {getattr(e, 'reason', e)}")
    except ValueError: # The server answered, but not with valid JSON
        raise SystemExit("The CryptoRank API returned a response that isn't valid JSON.")

    coins = body.get("data") if isinstance(body, dict) else None # Extract the "data" list
    if not isinstance(coins, list): # Valid JSON, but not the shape we expect
        raise SystemExit("The CryptoRank API returned an unexpected response format.")

    matches = [coin for coin in coins if isinstance(coin, dict) and str(coin.get("symbol", "")).upper() == symbol] # Copycat tokens can share a ticker
    if not matches:
        return None
    return min(matches, key=lambda coin: to_rank(coin.get("rank")) or float("inf")) # The best-ranked match is the real coin


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
found.sort(key=lambda symbol: to_rank(data[symbol].get("rank")) or float("inf"))

for symbol_data in found: # Iterate over the symbols in rank order
    coin = data[symbol_data] # Get the data for the current symbol from the API response
    rank = to_rank(coin.get("rank")) # The rank as an integer, or None when the coin is unranked
    price = to_price(coin.get("price")) # None for coins without a current (or numeric) price
    price_text = f"${price:,.2f}" if price is not None else "price unavailable" # Only format the price when it exists
    rank_text = f"Rank {rank}" if rank is not None else "Unranked"
    print(f"{rank_text} {coin.get('name', symbol_data)} ({symbol_data}): {price_text}") # Print the rank, name, symbol, and price of the cryptocurrency

for symbol_data in missing: # Report symbols with no data after the ranked ones
    print(f"No data found for symbol: {symbol_data}") # Print a message if no data is found for the symbol
