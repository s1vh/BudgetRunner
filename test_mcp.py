import urllib.request
import json

url = "https://stitch.googleapis.com/mcp"
headers = {
    "X-Goog-Api-Key": "AQ.Ab8RN6LprR5Rij6LJf90gRiNHnuFvY12348JuwdOMHHiaTUauQ",
    "Content-Type": "application/json"
}

# Try listing tools first
data = {
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 1
}

req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method='POST')

try:
    with urllib.request.urlopen(req) as response:
        print("Status Code:", response.getcode())
        print("Response:", response.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)
