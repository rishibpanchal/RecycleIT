import urllib.request
import urllib.error

req = urllib.request.Request('http://localhost:8000/fingerprint/compute_synthetic', method='POST')
try:
    response = urllib.request.urlopen(req)
    print("Success:", response.read())
except urllib.error.HTTPError as e:
    print("Error:", e.code)
    print(e.read().decode())
