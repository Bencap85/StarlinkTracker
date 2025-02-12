

let map = null;
let selectedSatellite = null;

const socket = io.connect('http://localhost:5000');

socket.on('initial_positions', data => {
    if(map) return;

    console.log("receiving initial positions");
    initializeMap(mapboxApiToken, data['positions']);
});

socket.on('update_positions', data => {
    if (!map) return;

    console.log("received update");

    let satellitePositions = data['positions'];

    // Updates selected satellite data in sidebar
    if (selectedSatellite) {
        console.log("Updating selected satellite...");
        selectedSatellite.last_updated = data['timestamp'];
        selectedSatellite.coordinates = satellitePositions[selectedSatellite.norad];
        addSidebarData(selectedSatellite);
    }

    let keys = Object.keys(satellitePositions);

    // Add source
    map.getSource('satellites').setData({
        type: 'FeatureCollection',
        features: keys.map(norad => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: satellitePositions[norad]
            },
            properties: {
                id: norad
            }
        }))
    });

    console.log("Finished rendering data");


});

document.getElementById('sidebar').addEventListener('click', resizeSidebar);
setUpClock();
setInterval(updateClock, 1000);

async function fetchSelectedSatelliteData(norad) {
    const res = await fetch(`http://localhost:5000/satellite_data/${norad}`);
    const data = await res.json();
    selectedSatellite = data;
    addSidebarData(selectedSatellite);

}

function initializeMap(accessToken, satellitePositions) {

    mapboxgl.accessToken = accessToken;
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/dark-v10', 
        center: [-84, 38],
        zoom: 5, // Initial zoom level
        maxBounds: [[-160, -85], [170, 85]]
    });

    map.on('load', function() {
        const labelLayers = [
            'country-label', 'state-label', 'settlement-label', 
            'water-label', 'airport-label', 'poi-label'
        ];
        labelLayers.forEach(layer => {
            if (map.getLayer(layer)) {
                map.setLayoutProperty(layer, 'visibility', 'none');
            }
        });
        map.getCanvas().style.cursor = 'crosshair';

        let keys = Object.keys(satellitePositions);
        // Add source
        map.addSource('satellites', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: keys.map(norad => ({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: satellitePositions[norad]
                    },
                    properties: {
                        id: norad
                    }
                }))
            }
        });

        //Add layer
        map.addLayer({
            "id": "satellites",
            "source": 'satellites',
            "type": "circle",

            'paint': {
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    2, 1,    // At zoom level 2, radius is 1
                    5, 2,
                    10, 4
                ],
                'circle-color': '#32cd32',
                'circle-opacity': 1
            }
        });



        map.on('click',  'satellites', async (e) => {

            if(!e || !e.features || e.features.length > 1) {
                console.log("Error detecting satellites that were clicked");
                return;
            }

            let feature = e.features[0];

            if (!selectedSatellite) {
                // Select satellite
                await fetchSelectedSatelliteData(feature.properties.id);
                showSidebar();
            } else if (feature.properties.id === String(selectedSatellite.norad)) {
                // Deselect satellite
                selectedSatellite = null;
            } else {
                // Change satellite selection
                await fetchSelectedSatelliteData(feature.properties.id);
                showSidebar();
            }

            if (!selectedSatellite) {
                // Resets color
                map.setPaintProperty('satellites', 'circle-color',
                    '#32cd32'  // default color
                );

                clearSidebarData();

            } else {
                //Paints selected satellite red, all others green
                map.setPaintProperty('satellites', 'circle-color', [
                    'case',
                    ['==', ['get', 'id'], String(selectedSatellite.norad)],
                    '#ff0000', // color for selected satellite
                    '#32cd32'  // default color
                ]);
            }

        });


    }); // map.on('load')
} // initializeMap

function addSidebarData(satellite) {
    let sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = "";

    let picture = document.createElement('img');
    picture.src = '../static/images/starlink_satellite_picture.jpg';
    picture.alt = "Starlink satellite";
    picture.id = "satellite-img";

    const date = new Date(satellite.last_updated);
    const options = {
        year: 'numeric',
        month: 'long', 
        day: 'numeric', 
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
        
    };

    const formattedDate = new Intl.DateTimeFormat('en-US', options).format(date);

    let newDataElement = document.createElement('div');
    newDataElement.id = "sidebar-satellite-images";
    newDataElement.innerHTML = `
    
        <h2>${satellite.name}</h2>
        <ul class="sidebar-satellite-data-list">
            <li>Coordinates Over Earth <br>
                <ul class="coordinates-list">
                    <li>
                        Longitude: <span class="coordinates-list-value">${satellite.coordinates[0]}</span>
                    </li>
                    <li>
                        Latitude: <span class="coordinates-list-value">${satellite.coordinates[1]}</span>
                    </li>
                </ul>
            </li>
            <li>Norad Number: <span class="value" style="display: inline; margin-left: 0;">${satellite.norad}</span></li>
            <li>Last Updated: <span class="value" style="display: inline; margin-left: 0;">${formattedDate} UTC</span></li>
        </ul>
    
    `;
    newDataElement.className = sidebar.className;
    newDataElement.addEventListener('click', resizeSidebar);
    sidebar.append(picture);
    sidebar.append(newDataElement);
}

function clearSidebarData() {
    let sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = '<p>No satellite selected</p>';
}

function resizeSidebar() {
    let sidebar = document.getElementById('sidebar');
    sidebar.className = sidebar.className === 'minimized'? "maximized" : "minimized";
    let satelliteData = document.getElementById('sidebar-satellite-data');
    if(satelliteData && satelliteData.className) {
        satelliteData.className = sidebar.className;
    }
}

function showSidebar() {
    let sidebar = document.getElementById('sidebar');
    sidebar.className = "maximized";
}

function setUpClock() {
    let date = new Date();
    let clock = document.createElement('div');
    clock.id = 'clock';
    clock.textContent = `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}:${String(date.getUTCSeconds()).padStart(2, '0')} UTC`;
    document.getElementById('body').appendChild(clock);
}
function updateClock() {
    let date = new Date();
    document.getElementById('clock').textContent = `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}:${String(date.getUTCSeconds()).padStart(2, '0')} UTC`;
}



        

