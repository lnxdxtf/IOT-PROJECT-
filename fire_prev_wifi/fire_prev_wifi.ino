#include <WiFi.h>
#include <DHT11.h>
#include <Arduino_JSON.h>
#include <NTPClient.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoWebsockets.h>

using namespace websockets;

const char *ssid = "predator";
const char *password = "147852369n";
const String DEVICE_ID = "ESP-ZERO";

WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP);

WebsocketsClient WSclient;

int PIN_A0_SENSOR_MQ2 = A0;
#define PIN_GPIO_SENSOR_DHT11 26
DHT11 dht11(PIN_GPIO_SENSOR_DHT11);
LiquidCrystal_I2C LCD(0x27, 16, 2);

void setup() {
  Serial.begin(115200);
  LCD.begin();
  LCD.backlight();

  WiFi.begin(ssid, password);
  Serial.println("Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
  Serial.println(WiFi.localIP());

  LCD.clear();
  LCD.print("WiFi Connected!");

  timeClient.begin();

  bool connected = WSclient.connect("192.168.137.1", 8000, "/device-sender");
  if (connected) {
    Serial.println("Connected to WebSocket!");
  } else {
    Serial.println("WebSocket connection failed!");
  }

  WSclient.onMessage([](WebsocketsMessage msg) {
    Serial.println("Got Message: " + msg.data());
  });
}

void loop() {
  timeClient.update();
  WSclient.poll();

  int temp, humd;
  int smoke_level = analogRead(PIN_A0_SENSOR_MQ2);
  int dht11Result = dht11.readTemperatureHumidity(temp, humd);

  LCD.clear();
  LCD.print("Temp " + String(temp));
  LCD.setCursor(9, 0);
  LCD.print("Humd " + String(humd));
  LCD.setCursor(0, 1);
  LCD.print("Gas " + String(smoke_level));

  JSONVar data;
  data["id"] = DEVICE_ID;
  data["temperature"] = temp;
  data["smoke_level"] = smoke_level;
  data["humidity"] = humd;
  data["timestamp"] = timeClient.getEpochTime();

  WSclient.send(JSON.stringify(data));

  delay(1000);
}
