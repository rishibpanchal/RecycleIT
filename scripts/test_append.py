import urllib.request, json
data = json.dumps({
    'previousQRData': '{"attestation": {"batchId": "INV-102", "stage": 3}}',
    'newBatchId': 'INV-102',
    'newStage': 4,
    'workerName': 'test',
    'warehouseCode': 'test',
    'stepMetadata': {'inputQty': 10, 'outputQty': 9, 'lossPercent': 10, 'remarks': ''},
    'scenario': '1'
}).encode()
req = urllib.request.Request('http://localhost:8000/api/attest/append', data=data, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as resp:
        print(resp.read().decode())
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.read().decode()}")
except Exception as e:
    print(str(e))
