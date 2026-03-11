import pandas as pd
from sklearn.neighbors import KNeighborsClassifier

data = pd.read_csv("./dataset/coal_mine_sensor_dataset.csv")

X = data[['temp','hum','mq2','mq135','vib']]

y = data['status']

model = KNeighborsClassifier(n_neighbors=3)

model.fit(X,y)

sensor = pd.DataFrame([{
    "temp":27.1,
    "hum":58.0,
    "mq2":912,
    "mq135":1077,
    "vib":1
}])

prediction = model.predict(sensor)

print("Status:", prediction[0])