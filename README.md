<h1>Starlink Tracker</h1>
This project monitors the locations of 5,000 Starlink satellites in real time. Data is gathered from the Celestrak API and processed using the Skyfield Python library. This project integrates with MapBox API to project the positions of each satellite over Earth. 

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

<h2>Future Improvements</h2>
This project was developed as a kind of proof-of-concept for tracking satellite positions over the world. Now that the MVP is complete, there are improvements I would like to make. I am not terribly happy with how the client must constantly perform HTTP requests to poll the server for updates to satellite positions. While this approach certainly works, it could be implemented more cleanly through a web socket connection which would allow the server to push updates to the client without the client having to request them. 
<br>
<br>

<h2>Screenshots</h2>

<img width="960" alt="starlink_tracker_screenshot" src="https://github.com/user-attachments/assets/7ac3c4d3-9522-4e5b-9308-5cb44ff71200">
<br>
<br>
<img width="959" alt="starlink_tracker_screenshot_2" src="https://github.com/user-attachments/assets/0dbf2dd4-4776-4c51-8b3c-9abd7a7ae603">

