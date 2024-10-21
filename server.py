import threading
import time
import json
from datetime import datetime
import geojson
import os
import shutil
from flask import Flask, send_file, render_template
from skyfield.api import load
import satellite_utils
from flask_cors import CORS


def keep_updating_file(file_number, num_files, file_locks, norad_to_satellite, ts, delay_seconds):
    if not 1 <= file_number <= num_files:
        print("ERROR: file_number must be between 1 and NUM_DIVISIONS")
        return 1

    while True:
        with file_locks[file_number]:
            # Backup file
            file_name = PATH_TO_GEOJSON_DATA_FOLDER + "/satellite_data_" + str(file_number) + ".geojson"
            backup_file_name = PATH_TO_GEOJSON_DATA_FOLDER + "/satellite_data_" + str(file_number) + "_backup.geojson"
            shutil.copy(file_name, backup_file_name)

            # Update file
            update_file(file_name, file_number, norad_to_satellite, ts)

        time.sleep(delay_seconds)


def update_file(input_file_name, file_number, norad_to_satellite, ts):
    print("UPDATING " + str(file_number))
    geojson_dict = None
    with open(input_file_name, "r") as input_file:
        try:
            geojson_dict = json.load(input_file)
            geojson_dict_backup = geojson_dict
        except Exception as e:
            print("ERROR READING DATA", e)
            return False

    # Convert inner dicts from strings to dicts
    def convert_inner_dicts(obj):
        if isinstance(obj, dict):
            for key, value in obj.items():
                if isinstance(value, str):
                    try:
                        # Attempt to convert string to dictionary
                        obj[key] = json.loads(value)
                    except json.JSONDecodeError:
                        # If it's not a JSON string, leave it as is
                        pass
                else:
                    # Recursively process nested dictionaries
                    convert_inner_dicts(value)
        elif isinstance(obj, list):
            for index, item in enumerate(obj):
                if isinstance(item, str):
                    try:
                        # Attempt to convert string to dictionary
                        obj[index] = json.loads(item)
                    except json.JSONDecodeError:
                        # If it's not a JSON string, leave it as is
                        pass
                else:
                    # Recursively process nested lists
                    convert_inner_dicts(item)

    convert_inner_dicts(geojson_dict)

    for i in range(0, len(geojson_dict['features'])):
        satellite = geojson_dict['features'][i]

        earth_satellite_obj = norad_to_satellite[int(satellite['properties']['id'])]

        new_coordinates = satellite_utils.get_current_position(earth_satellite_obj, ts)
        new_last_updated = ts.now().utc_iso()

        geojson_dict['features'][i]['geometry']['coordinates'] = new_coordinates
        geojson_dict['features'][i]['properties']['last_updated'] = new_last_updated

    with open(input_file_name, "w") as input_file:
        input_file.write(geojson.dumps(geojson_dict))


def divide_satellites(norad_to_satellite, number_of_divisions):
    # Calculate the chunk size
    total_items = len(norad_to_satellite)
    chunk_size = total_items // number_of_divisions
    remainder = total_items % number_of_divisions

    # Indexed starting from 1 to number_of_divisions
    number_to_group_map = {}
    items = list(norad_to_satellite.items())

    start = 0

    for i in range(number_of_divisions):
        end = start + chunk_size + (1 if i < remainder else 0)
        number_to_group_map[i+1] = dict(items[start:end])
        start = end

    return number_to_group_map


def generate_geojson_files(num_files, division_to_satellites, PATH_TO_GEOJSON_DATA_FOLDER, ts):
    for file_number in range(1, num_files+1):
        file_name = PATH_TO_GEOJSON_DATA_FOLDER + "/satellite_data_" + str(file_number) + ".geojson"
        satellite_utils.satellites_to_geojson(division_to_satellites[file_number].values(), file_name, ts)


# Set up
app = Flask(__name__)
CORS(app)

ts = load.timescale()

PATH_TO_GEOJSON_DATA_FOLDER = os.path.curdir + "/geojson_data"
NUM_DIVISIONS = 3
UPDATE_DELAY = 0

norad_to_satellite = satellite_utils.initialize_satellites("tle_data/satellite_data_file.tle")
division_to_satellites = divide_satellites(norad_to_satellite, NUM_DIVISIONS)

generate_geojson_files(NUM_DIVISIONS, division_to_satellites, PATH_TO_GEOJSON_DATA_FOLDER, ts)


# Initialize locks
file_locks_by_number = {}
for i in range(0, NUM_DIVISIONS):
    file_locks_by_number[i + 1] = threading.Lock()

# Initialize threads
threads_by_number = {}
for i in range(0, NUM_DIVISIONS):
    threads_by_number[i+1] = threading.Thread(target=keep_updating_file, args=(i + 1, NUM_DIVISIONS, file_locks_by_number, norad_to_satellite, ts, UPDATE_DELAY))
    threads_by_number[i+1].daemon = True
    threads_by_number[i+1].start()


@app.route('/', methods=['GET'])
def get_home():
    print('Request received')
    return render_template('index.html', MAPBOX_ACCESS_TOKEN=os.getenv('MAPBOX_ACCESS_TOKEN'), HEROKU_APP_URL=os.getenv('HEROKU_APP_URL'))

@app.route('/satellite_data/<file_number>', methods=['GET'])
def get_satellite_data(file_number):
    if not 1 <= int(file_number) <= NUM_DIVISIONS:
        return "File not found", 404

    file_name = PATH_TO_GEOJSON_DATA_FOLDER + "/satellite_data_" + str(file_number) + ".geojson"
    backup_file_name = PATH_TO_GEOJSON_DATA_FOLDER + "/satellite_data_" + str(file_number) + "_backup.geojson"

    if file_locks_by_number[int(file_number)].locked():
        return send_file(backup_file_name, mimetype='application/json')
    else:
        with file_locks_by_number[int(file_number)]:
            return send_file(file_name, mimetype='application/json')

@app.route('/satellite_data/norad/<norad>', methods=['GET'])
def get_satellite_by_norad(norad):
    satellite = norad_to_satellite[int(norad)]
    data = {}

    name = satellite.name
    coordinates = satellite_utils.get_current_position(satellite, ts)
    last_updated = datetime.utcnow()

    data['name'] = name
    data['coordinates'] = coordinates
    data['last_updated'] = str(last_updated)
    data['norad'] = norad

    return json.dumps(data)

@app.route('/mapbox-access-token')
def get_mapbox_access_token():
    return json.dumps({'accessToken': os.getenv('MAPBOX_ACCESS_TOKEN')})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
    




