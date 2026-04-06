import urllib.request
import urllib.error
import urllib.parse
import json

base_url = "http://localhost:8000"

def test_fingerprint():
    url = f"{base_url}/fingerprint/compute"
    data = {"data": [{"batch_id": "B103", "material_type": "HDPE", "vendor": "Vendor B", "stage": "collection", "quantity_in": 1000, "quantity_out": 950, "timestamp": "2026-02-01T08:00:00"}, {"batch_id": "B103", "material_type": "HDPE", "vendor": "Vendor B", "stage": "sorting", "quantity_in": 950, "quantity_out": 900, "timestamp": "2026-02-01T10:00:00"}, {"batch_id": "B103", "material_type": "HDPE", "vendor": "Vendor B", "stage": "dispatch", "quantity_in": 900, "quantity_out": 880, "timestamp": "2026-02-01T12:00:00"}]}
    
    req = urllib.request.Request(url, method='POST')
    req.add_header('Content-Type', 'application/json')
    jsondata = json.dumps(data).encode('utf-8')
    try:
        response = urllib.request.urlopen(req, data=jsondata)
        res = json.loads(response.read().decode('utf-8'))
        print("Fingerprint Result:", res)
    except urllib.error.HTTPError as e:
        print("Fingerprint Error Code:", e.code)
        print("Fingerprint Error Body:", e.read().decode("utf-8"))
    except Exception as e:
        print("Other Error:", e)

if __name__ == "__main__":
    test_fingerprint()
