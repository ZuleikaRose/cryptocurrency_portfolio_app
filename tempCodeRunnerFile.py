import requests
import json
import subprocess

def clear_screen():
    subprocess.run("cls", shell=True, check=False)
    # For Unix/Linux/MacOS, use "clear" instead of "cls"
    # subprocess.run("clear", shell=True, check=False)

api_request = requests.get("https://api.coinmarketcap.com/v1/ticker")
api = json.loads(api_request.content)

currencies = ["BTC", "ETH", "LTC", "XRP"]