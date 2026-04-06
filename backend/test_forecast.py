import urllib.request
import urllib.error
import urllib.parse
import json
from datetime import datetime, timedelta

base_url = "http://localhost:8000"

def generate_upward_trend_data():
    data = []
    # 2 weeks of history
    start_date = datetime(2026, 1, 1)
    base_profit = 1000
    for i in range(14):
        current_date = start_date + timedelta(days=i)
        # Increasing by ~100 a day with some noise
        profit = base_profit + (i * 100) + (i % 3 * 50)
        
        data.append({
            "batch_id": f"B{100+i}",
            "timestamp": current_date.isoformat() + "Z",
            "meta_profit": profit
        })
    return data

def test_forecast():
    url = f"{base_url}/forecast/meta-profit"
    payload = {
        "data": generate_upward_trend_data(),
        "days": 7
    }
    
    req = urllib.request.Request(url, method='POST')
    req.add_header('Content-Type', 'application/json')
    jsondata = json.dumps(payload).encode('utf-8')
    try:
        response = urllib.request.urlopen(req, data=jsondata)
        res = json.loads(response.read().decode('utf-8'))
        with open("forecast_test_out.json", "w") as f:
            json.dump(res, f, indent=2)
        print("Success, wrote to forecast_test_out.json")
    except urllib.error.HTTPError as e:
        print("Forecast Error Code:", e.code)
        print("Forecast Error Body:", e.read().decode("utf-8"))
    except Exception as e:
        print("Other Error:", e)

if __name__ == "__main__":
    test_forecast()
