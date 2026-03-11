import serial
import time
import json
import requests

SERIAL_PORT = '/dev/ttyUSB0'
BAUD_RATE = 115200

API_URL = "http://127.0.0.1:5000/api/data"

try:
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
    print(f"Connected to {SERIAL_PORT} at {BAUD_RATE} baud.")

    time.sleep(2)

    while True:

        if ser.in_waiting > 0:

            line = ser.readline().decode('utf-8').strip()

            if line == "Status: Waiting for packets..." or line == "":
                continue

            print("Received:", line)

            try:
                data = json.loads(line)
                
                response = requests.post(API_URL, json=data)

                if response.status_code == 200:
                    print("Sent to API")

                else:
                    print("API error:", response.text)

            except json.JSONDecodeError:
                print("Invalid JSON:", line)

except serial.SerialException as e:
    print(f"Serial Error: {e}")

except KeyboardInterrupt:
    print("\nClosing connection...")

finally:
    if 'ser' in locals() and ser.is_open:
        ser.close()