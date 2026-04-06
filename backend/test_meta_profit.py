import urllib.request
import urllib.error
import urllib.parse
import json

base_url = "http://localhost:8000"

def test_meta_profit():
    url = f"{base_url}/meta-profit/compute"
    data = {
        "batch_data": [
            {
                "batch_id": "B102",
                "material_type": "PET",
                "vendor": "Vendor A",
                "stage": "collection",
                "quantity_in": 500,
                "quantity_out": 480,
                "timestamp": "2026-01-01T10:00:00"
            },
            {
                "batch_id": "B102",
                "material_type": "PET",
                "vendor": "Vendor A",
                "stage": "dispatch",
                "quantity_in": 480,
                "quantity_out": 480,
                "timestamp": "2026-01-01T12:00:00"
            }
        ]
    }
    
    req = urllib.request.Request(url, method='POST')
    req.add_header('Content-Type', 'application/json')
    jsondata = json.dumps(data).encode('utf-8')
    try:
        response = urllib.request.urlopen(req, data=jsondata)
        res = json.loads(response.read().decode('utf-8'))
        with open("test_out.json", "w") as f:
            json.dump({"meta_profit": res}, f, indent=2)
    except urllib.error.URLError as e:
        print("Meta Profit Error:", e)

def test_fingerprint():
    url = f"{base_url}/fingerprint/compute"
    data = {
        "data": [
            {
                "batch_id": "B103",
                "material_type": "HDPE",
                "vendor": "Vendor B",
                "stage": "collection",
                "quantity_in": 1000,
                "quantity_out": 950,
                "timestamp": "2026-02-01T08:00:00"
            },
            {
                "batch_id": "B103",
                "material_type": "HDPE",
                "vendor": "Vendor B",
                "stage": "sorting",
                "quantity_in": 950,
                "quantity_out": 900,
                "timestamp": "2026-02-01T10:00:00"
            },
            {
                "batch_id": "B103",
                "material_type": "HDPE",
                "vendor": "Vendor B",
                "stage": "dispatch",
                "quantity_in": 900,
                "quantity_out": 880,
                "timestamp": "2026-02-01T12:00:00"
            }
        ]
    }
    
    req = urllib.request.Request(url, method='POST')
    req.add_header('Content-Type', 'application/json')
    jsondata = json.dumps(data).encode('utf-8')
    try:
        response = urllib.request.urlopen(req, data=jsondata)
        res = json.loads(response.read().decode('utf-8'))
        with open("test_out.json", "a") as f:
            f.write("\n")
            json.dump({"fingerprint": res}, f, indent=2)
    except urllib.error.URLError as e:
        print("Fingerprint Error:", e)

if __name__ == "__main__":
    import os
    if os.path.exists("test_out.json"):
        os.remove("test_out.json")
    test_meta_profit()
    test_fingerprint()

