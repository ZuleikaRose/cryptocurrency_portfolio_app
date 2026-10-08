from itertools import count # Import the count function from the itertools module
import json # Import the JSON module for parsing JSON data
import urllib.parse # Import the urllib.parse module for URL encoding
import urllib.request # Import the urllib.request module for making HTTP requests
import os # Import the os module for accessing environment variables

api_key = os.getenv("CMC_API_KEY")
if not api_key:
    raise RuntimeError("Set the CMC_API_KEY environment variable first.")

symbols = [" "]

ticker_amount = input("How many cryptocurrency symbols are currently being tracked? ")
ticker_amount = int(ticker_amount)
# How many symbols are currently being tracked
for _ in range(ticker_amount):
    symbol_input = input("Input a Cryptocurrency symbol to look up: ").upper().strip() # Get user input for a cryptocurrency symbol
    i = symbols.count(symbol_input)  # Count how many times the symbol appears in the list
    if symbol_input not in symbols:
        symbols.append(symbol_input) # Add the symbol to the list if it is not already present
    elif i > 0:
        print(f"The symbol {symbol_input} has already been entered.")
# Print the list of entered cryptocurrency symbols
print("Entered cryptocurrency symbols:", symbols[1:])

if len(symbols) == 1: # Check if no cryptocurrency symbols were entered
    raise RuntimeError("No cryptocurrency symbols were entered.")
elif len(symbols) > ticker_amount + 1: # Check if more symbols were entered than expected
    raise RuntimeError("More cryptocurrency symbols were entered than expected.")


params = urllib.parse.urlencode({"symbol": ",".join(symbols), "convert": "USD"}) # URL encode the query parameters for the API request
request = urllib.request.Request(
    "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?" + params, # Construct the full URL for the API request with the query parameters
    headers={"X-CMC_PRO_API_KEY": api_key, "Accept": "application/json"}, # Set the request headers with the API key and accept JSON response
)

with urllib.request.urlopen(request, timeout=10) as response: # Make the API request and open the response
    data = json.loads(response.read().decode("utf-8"))["data"] # Parse the JSON response and extract the "data" field

for symbol in symbols: # Iterate over the list of entered cryptocurrency symbols
    coin = data.get(symbol) # Get the data for the current symbol from the API response
    if coin: # Check if the data for the symbol exists
        rank = int(coin["cmc_rank"]) # Get the rank of the cryptocurrency
        print(f"Rank {rank} {coin['name']} ({symbol}): ${coin['quote']['USD']['price']:,.2f}") # Print the rank, name, symbol, and price of the cryptocurrency
    if not coin: # Check if no data is found for the symbol
        print(f"No data found for symbol: {symbol}") # Print a message if no data is found for the symbol
