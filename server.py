import threading
import time
import json
from datetime import datetime
import os
from flask import Flask, send_file, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from skyfield.api import load
import satellite_utils
from flask_cors import CORS
from multiprocessing import Pool, Manager

# Socket events
SOCKET_CONNECT = 'connect'
SOCKET_DISCONNECT = 'disconnect'
SOCKET_UPDATE_POSITIONS = 'update_positions'
SOCKET_INITIAL_POSITIONS = 'initial_positions'

UPDATE_DELAY_SECONDS = 1


def update_positions(update_event, send_event):
    while True:
        send_event.wait()
        send_event.clear()

        start_time = time.time()

        for i in range(len(satellite_objects)):
            satellite = satellite_objects[i]
            norad_to_coordinates[satellite.model.satnum] = satellite_utils.get_current_position(satellite, ts)

        end_time = time.time()
        print("Last process took ", end_time - start_time, " seconds")

        update_event.set()
        time.sleep(UPDATE_DELAY_SECONDS)

def update_satellite_position(i, ts):
    satellite = satellite_objects[i]
    new_coordinates = satellite_utils.get_current_position(satellite, ts)
    return satellite.model.satnum, new_coordinates


def update_positions_concurrently(pool, update_event, send_event):
    while True:
        send_event.wait()
        send_event.clear()

        start_time = time.time()
        results = pool.starmap(update_satellite_position, [(i, ts) for i in range(len(satellite_objects))])

        for norad, new_coordinates in results:
            norad_to_coordinates[norad] = new_coordinates

        end_time = time.time()

        print("This iteration took", end_time - start_time, "seconds")

        update_event.set()

        # time.sleep(UPDATE_DELAY_SECONDS)

def send_update(update_event, send_event):
    while True:

        update_event.wait()
        update_event.clear()

        start_time = time.time()

        # Broadcast changes to all
        socketIO.emit(SOCKET_UPDATE_POSITIONS, { 'positions': dict(norad_to_coordinates), 'timestamp': str(datetime.utcnow()) })

        end_time = time.time()

        print(f"Sending data took {end_time - start_time} seconds")

        send_event.set()



# Set up
app = Flask(__name__)
socketIO = SocketIO(app, cors_allowed_origins='*')
CORS(app)

satellite_objects = satellite_utils.initialize_satellites("tle_data/satellite_data_file.tle")


@app.route('/', methods=['GET'])
def get_home():
    print('Request received')
    return render_template('index.html', MAPBOX_ACCESS_TOKEN=os.getenv('MAPBOX_ACCESS_TOKEN'),
                           HEROKU_APP_URL=os.getenv('HEROKU_APP_URL'))

@app.route('/satellite_data/<norad>', methods=['GET'])
def get_satellite_data(norad):
    norad = int(norad)
    name = norad_to_name.get(norad, "NAME NOT FOUND")
    last_updated = str(datetime.utcnow())
    coordinates = norad_to_coordinates.get(norad, [-1, -1])

    return json.dumps({
                    'norad': norad,
                    'coordinates': coordinates,
                    'name': name,
                    'last_updated': last_updated
                })



@app.route('/mapbox-access-token')
def get_mapbox_access_token():
    return json.dumps({'accessToken': os.getenv('MAPBOX_ACCESS_TOKEN')})


@socketIO.on(SOCKET_CONNECT)
def handle_connect():
    print("Client connected: ID:", request.sid, ", sending initial positions...")
    socketIO.emit(SOCKET_INITIAL_POSITIONS, { 'positions': dict(norad_to_coordinates), 'timestamp': str(datetime.utcnow()) })


@socketIO.on(SOCKET_DISCONNECT)
def handle_disconnect(data):
    print("Client disconnected: ID:", request.sid)



if __name__ == '__main__':
    ts = load.timescale()

    manager = Manager()

    norad_to_coordinates = manager.dict()
    norad_to_name = {}

    for satellite in satellite_objects:
        norad_to_coordinates[satellite.model.satnum] = satellite_utils.get_current_position(satellite, ts)
        norad_to_name[satellite.model.satnum] = satellite.name


    with Pool(processes=4) as pool:

        update_event = threading.Event()
        send_event = threading.Event()

        send_event.set()

        update_thread = threading.Thread(target=update_positions_concurrently, args=(pool, update_event, send_event))
        send_update_thread = threading.Thread(target=send_update, args=(update_event, send_event))

        update_thread.start()
        send_update_thread.start()

        # update_thread.join()
        # send_update_thread.join()
        socketIO.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)
