

import math
import urllib
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

