import urllib.request
import sys

#################################################################################################
#                                                                                               #
#       This file requests TLE (two line element) images from the Celestrak API                   #
#   for all StarLink satellites in orbit and saves it to a .tle file.                           #
#                                                                                               #
#   Usage: "python fetch_tle_data.py [file_name]"                                               #
#                                                                                               #
#################################################################################################

URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle"

def __main__(args):
    if len(args) != 2:
        print("Invalid number of arguments")

    data = urllib.request.urlopen(URL)
    file_name = args[1]

    with open(str(file_name), "w") as file:

        for line in data.read().decode("utf-8").split("\n"):
            file.write(line)


if __name__ == "__main__":
    __main__(sys.argv)





