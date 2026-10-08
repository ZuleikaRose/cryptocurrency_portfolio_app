import json # Import the JSON module for parsing JSON data
import os # Import the os module for accessing environment variables
import urllib.error # Import the urllib.error module for handling HTTP errors
import urllib.parse # Import the urllib.parse module for URL encoding
import urllib.request # Import the urllib.request module for making HTTP requests

api_key = os.getenv("CMC_API_KEY")
if not api_key:
    raise RuntimeError("Set the CMC_API_KEY environment variable first.")

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

params = urllib.parse.urlencode({"symbol": ",".join(symbols), "convert": "USD"}) # URL encode the query parameters for the API request
request = urllib.request.Request(
    "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?" + params, # Construct the full URL for the API request with the query parameters
    headers={"X-CMC_PRO_API_KEY": api_key, "Accept": "application/json"}, # Set the request headers with the API key and accept JSON response
)

try:
    with urllib.request.urlopen(request, timeout=10) as response: # Make the API request and open the response
        data = json.loads(response.read().decode("utf-8"))["data"] # Parse the JSON response and extract the "data" field
except urllib.error.HTTPError as e: # The API returns an error status for things like invalid symbols or a bad API key
    error = json.loads(e.read().decode("utf-8")).get("status", {}).get("error_message", e.reason)
    raise SystemExit(f"API error ({e.code}): {error}")

for symbol in symbols: # Iterate over the list of entered cryptocurrency symbols
    coin = data.get(symbol) # Get the data for the current symbol from the API response
    if coin: # Check if the data for the symbol exists
        rank = int(coin["cmc_rank"]) # Get the rank of the cryptocurrency
        print(f"Rank {rank} {coin['name']} ({symbol}): ${coin['quote']['USD']['price']:,.2f}") # Print the rank, name, symbol, and price of the cryptocurrency
    else: # If no data is found for the symbol
        print(f"No data found for symbol: {symbol}") # Print a message if no data is found for the symbol
