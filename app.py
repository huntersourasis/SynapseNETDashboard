import pandas as pd
import numpy as np
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from datetime import datetime

# ML Imports
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.pipeline import Pipeline

app = Flask(__name__)
CORS(app)

# --- ML Model Setup ---
try:
    data = pd.read_csv("./dataset/coal_mine_sensor_dataset.csv")

    # 1. Handle Categorical Target (Safe/Warning/Danger -> 0/1/2)
    le = LabelEncoder()
    data['status_encoded'] = le.fit_transform(data['status'])
    
    # Save the mapping for later use (e.g., {0: 'Danger', 1: 'Safe', 2: 'Warning'})
    class_names = le.classes_ 
    
    X = data[['temp', 'hum', 'mq2', 'mq135', 'vib']]
    y = data['status_encoded']

    # 2. Build a Pipeline: Scale the data, then apply KNN
    # Scaling ensures mq2 (1500) doesn't "outweigh" temp (30) mathematically
    model = Pipeline([
        ('scaler', StandardScaler()),
        ('knn', KNeighborsClassifier(n_neighbors=5))
    ])

    model.fit(X, y)
    print(f"✅ KNN Model Loaded. Classes detected: {class_names}")

except Exception as e:
    print(f"❌ Initialization Error: {e}")

# --- Configuration & Storage ---
sensor_history = []
THRESHOLDS = {
    "mq2": 1000,
    "mq135": 1200,
    "temp": 40,
    "hum": 80,
    "vib": 1.5
}

@app.route("/")
def dashboard():
    return render_template("index.html")

@app.route("/api/data", methods=["POST"])
def receive_data():
    try:
        incoming = request.json
        
        # Extract features as floats
        features_list = [
            float(incoming.get("temp", 0)),
            float(incoming.get("hum", 0)),
            float(incoming.get("mq2", 0)),
            float(incoming.get("mq135", 0)),
            float(incoming.get("vib", 0))
        ]
        
        # ML Prediction
        # input_df needs the same column names used during fit
        input_df = pd.DataFrame([features_list], columns=['temp', 'hum', 'mq2', 'mq135', 'vib'])
        
        # Get numerical prediction (e.g., 0) and convert back to string (e.g., 'Danger')
        pred_idx = model.predict(input_df)[0]
        prediction_label = class_names[pred_idx]
        
        # Calculate Risk Score (Probability of the "Danger" class)
        # We find the index where 'Danger' is located in our encoder
        danger_idx = np.where(class_names == 'Danger')[0][0]
        probs = model.predict_proba(input_df)[0]
        risk_score = round(probs[danger_idx] * 100, 2)

        # Threshold Alerts (Manual Override Check)
        active_alerts = [k for k, v in THRESHOLDS.items() if float(incoming.get(k, 0)) > v]

        entry = {
            "time": datetime.now().strftime("%H:%M:%S"),
            "node": incoming.get("node", "Unknown"),
            "temp": features_list[0],
            "hum": features_list[1],
            "mq2": features_list[2],
            "mq135": features_list[3],
            "vib": features_list[4],
            "status": prediction_label,
            "risk_score": risk_score,
            "alerts": active_alerts
        }

        sensor_history.append(entry)
        if len(sensor_history) > 50:
            sensor_history.pop(0)

        return jsonify(entry), 201
    
    except Exception as e:
        print(f"API Error: {e}")
        return jsonify({"error": str(e)}), 400

@app.route("/api/history", methods=["GET"])
def get_history():
    return jsonify(sensor_history)

@app.route("/api/stats")
def get_stats():
    if not sensor_history:
        return jsonify({"msg": "No data yet"})
    
    df = pd.DataFrame(sensor_history)
    stats = {
        "avg_temp": round(df['temp'].mean(), 2),
        "avg_hum": round(df['hum'].mean(), 2),
        "alert_count": len([e for e in sensor_history if e['status'] == 'Danger'])
    }
    return jsonify(stats)

if __name__ == "__main__":
    # Use 0.0.0.0 to allow access from other devices on your network
    app.run(debug=True, host="0.0.0.0", port=5000)