<h1>Starlink Tracker</h1>
This project monitors the locations of 5,000 Starlink satellites in real time. Data is gathered from the Celestrak API and manipulated through the Skyfield Python library. This project integrates the MapBox API to project the coordinates of each satellite over Earth. 

<h2>Overview</h2>

<h3>Server</h3>
The server fetches data on all Starlink satellites from the Celestrak API. It downloads this data in Two-Line Element (TLE) format. Information contained in the TLE format includes identifying information such as name and NORAD number, and specific orbital information 
such as eccentricity, inclination, right ascension of ascending node, etc. This orbital information is required to determine the satellite's position over Earth. 
<br>
<br>

After the server recieves the TLE data, it converts the data into **EarthSatellite** objects using the Skyfield library. The Skyfield library handles much of the mathematical calculations involved with determining satellite positions. These satellites are then split into groups
for load balancing purposes. Each groups' positions are updated concurrently to optimize performance and remedy latency issues. The positions are continuously updated every several seconds. This positional data is stored in GeoJSON files.
<br>
<br>

The backend API provides two main endpoints that the frontend consumes. The first main endpoint is **/satellite_data/<group_number>**, which provides the latest satellite positions by group in GeoJSON format. This pagination is used to reduce the size of each response. 
Another is the **/satellite_data/norad/\<norad>** endpoint, which provides more detailed information on a particular satellite designated by its NORAD number.
<br>
<br>


<h3>Client</h3>
The client provides the user interface to track the Starlink satellites. Using the MapBox API, it creates a world map and overlays it with satellite positions. Still using the pagination approach, the client continuously polls the server
for updates to the data by group. If there is a change in the data of any of the groups, it will update the coordinates of the respective group's satellites. MapBox was unable to handle large data inputs/modifications, so the pagination approach was critical to achieving 
satisfactory, low-latency results.
<br>
<br>

<h2>Screenshots</h2>

<img width="960" alt="starlink_tracker_screenshot" src="https://github.com/user-attachments/assets/7ac3c4d3-9522-4e5b-9308-5cb44ff71200">

