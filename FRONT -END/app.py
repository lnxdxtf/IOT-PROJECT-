from flask import Flask, jsonify, Response, render_template
import redis
import json

app = Flask(__name__)

# vai ser a conexão com Redis
redis_conn = redis.Redis(
    host="localhost",
    port=6379,
    decode_responses=True
)


@app.get("/")
def home():
    return render_template("index.html")


# lista de dispositivos disponíveis
@app.get("/devices")
def get_devices():
    devices = redis_conn.smembers("devices_id")
    if devices:
        return jsonify(list(devices))
    return jsonify([])


# histórico dos dados do dispositivo
@app.get("/history/<device_id>")
def get_history(device_id):
    data = redis_conn.smembers(device_id)

    # vai transformar cada string em um json
    json_list = [json.loads(item) for item in data]

    return jsonify(json_list)


# dados em tempo real 
@app.get("/stream")
def stream():
    pubsub = redis_conn.pubsub()
    pubsub.subscribe("device_data_channel")

    def event_stream():
        for message in pubsub.listen():
            if message["type"] == "message":
                raw = message["data"]
                yield f"data: {raw}\n\n"

    return Response(event_stream(), mimetype="text/event-stream")



if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")
