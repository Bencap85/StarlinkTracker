import datetime
import json
import math
import urllib

from skyfield.api import load, Topos
from skyfield.sgp4lib import EarthSatellite

def fetch_tle_data():
    TLE_DATA_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle"
    TLE_FILE_NAME = 'tle_data/satellite_data_file.tle'

    try:
        data = urllib.request.urlopen(TLE_DATA_URL)

        with open(str(TLE_FILE_NAME), "w") as file:

            for line in data.read().decode("utf-8").split("\n"):
                file.write(line)

    except IOError as e:
        print("Error getting TLE data", str(e))



def initialize_satellites(file_name):  # Loads satellites from .tle file into memory (returns list of satellites)
    satellites = []
    with open(file_name, "r") as file:
        while True:
            name = file.readline()
            if not name:
                break

            line1 = file.readline()
            line2 = file.readline()

            if not name or not line1 or not line2:
                break

            satellite = EarthSatellite(line1, line2, name)
            satellites.append(satellite)

    return satellites


def get_current_position(satellite, ts): # [Lng, Lat] of a satellite at instant function is called
    subpoint = satellite.at(ts.now()).subpoint()
    longitude = float(subpoint.longitude.degrees)
    latitude = float(subpoint.latitude.degrees)

    if(math.isnan(longitude) or math.isnan(latitude)):
        longitude = -1
        latitude = -1
    return [longitude, latitude]

'''

def satellite_to_geojson_obj(satellite, ts):

        name = satellite.name
        coordinates = get_current_position(satellite, ts)
        last_updated = datetime.datetime.utcnow()
        id = satellite.model.satnum

        # map = {"type": "Feature",
        #     "geometry": {
        #         "type": "Point",
        #         "coordinates": coordinates
        #     },
        #     "properties": {
        #         "name": str(name),
        #         "last_updated": str(last_updated),
        #         "id": str(id)
        #     }
        # }
        # return map
        geometry = {}
        geometry['type'] = 'Point'
        geometry['coordinates'] = coordinates

        properties = {}
        properties['name'] = str(name)
        properties['last_updated'] = str(last_updated)
        properties['id'] = id

        map = {}
        map['type'] = 'Feature'
        map['geometry'] = geometry
        map['properties'] = properties

        return json.dumps(map)

def satellites_to_geojson(satellites, out_file_name, ts):
    satellite_geojson_objects = []
    for satellite in satellites:
        satellite_geojson_objects.append(satellite_to_geojson_obj(satellite, ts))

    with (open(out_file_name, "w") as geojson_file):
        map = {"type": "FeatureCollection", "features": satellite_geojson_objects}

        json.dump(map, geojson_file)
        
        
'''




