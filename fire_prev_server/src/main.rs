#[macro_use] extern crate rocket;

use rocket::serde::{Serialize, Deserialize};
use redis::Commands;



#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(crate = "rocket::serde")]
struct DeviceData {
    id: String,
    temperature: i32,
    smoke_level: i32,
    humidity: i32,
    timestamp: u64,
}



#[get("/device-sender")]
fn device_sender(ws: ws::WebSocket) -> ws::Stream!['static] {
    let ws = ws.config(ws::Config {
        max_send_queue: Some(5),
        ..Default::default()
    });
    

    let client = redis::Client::open("redis://127.0.0.1:6379").unwrap();

    let mut con = client.get_connection().unwrap();

    ws::Stream! { ws =>
        for await message in ws {
            let data = message?;
            let data_deserialized: DeviceData = rocket::serde::json::from_str(&data.to_string()).unwrap();

            // serialize the struct to JSON and store JSON string in Redis under the id key
            let json = rocket::serde::json::serde_json::to_string(&data_deserialized).unwrap();
            

            let _: () = con.sadd("devices_id", &data_deserialized.id).unwrap();
            let _: () = con.sadd(data_deserialized.id.clone(), json).unwrap();
            let _: () = con.publish("device_data_channel", &data.to_string()).unwrap();

            yield ws::Message::Text("Received: ".to_string() + &data.to_string());
        }
    }
}







#[launch]
fn rocket() -> _ {

    rocket::build().mount("/", routes![device_sender])

}