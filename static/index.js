

const app = {
    map: null,
    selectedSatellite: null,
    lastUpdatedDate: null,
    MAX_SECONDS_PER_UPDATE: 15
}

const socket = io.connect(`${herokuAppURL}`);

socket.on('initial_positions', data => {
    if(app.map) return;

    let lastUpdatedDateString = data['timestamp'];
    lastUpdatedDateString = lastUpdatedDateString.replace(' ', 'T') + 'Z';
    app.lastUpdatedDate = new Date(lastUpdatedDateString);

    console.log("receiving initial positions");
    initializeMap(mapboxApiToken, data['positions']);
    hideSpinner();
});

socket.on('update_positions', data => {
    if (!app.map) return;

    let satellitePositions = data['positions'];
    let lastUpdatedDateString = data['timestamp'];
    lastUpdatedDateString = lastUpdatedDateString.replace(' ', 'T') + 'Z';
    app.lastUpdatedDate = new Date(lastUpdatedDateString);

    // Updates selected satellite data in sidebar
    if (app.selectedSatellite) {
        app.selectedSatellite.last_updated = data['timestamp'];
        app.selectedSatellite.coordinates = satellitePositions[app.selectedSatellite.norad];
        addSidebarData(app.selectedSatellite);
    }

    let keys = Object.keys(satellitePositions);

    // Add source
    app.map.getSource('satellites').setData({
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

    hideSpinner();

});

showSpinner();

document.getElementById('sidebar').addEventListener('click', resizeSidebar);
if (window.innerWidth <= 600) {
    // Hide sidebar
    minimizeSidebar();
}
setUpClock();
setInterval(updateClock, 1000);

async function fetchSelectedSatelliteData(norad) {
    try {
        const res = await fetch(`${herokuAppURL}/satellite_data/${norad}`);
        const data = await res.json();
        app.selectedSatellite = data;
        addSidebarData(app.selectedSatellite);
    } catch (e) {
        console.log("Failed to fetch data for satellite " + norad);
    }

}

function initializeMap(accessToken, satellitePositions) {

    mapboxgl.accessToken = accessToken;
    app.map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/dark-v10', 
        center: [-84, 38],
        zoom: 5, // Initial zoom level
        maxBounds: [[-160, -85], [170, 85]]
    });

    app.map.on('load', function() {
        const labelLayers = [
            'country-label', 'state-label', 'settlement-label', 
            'water-label', 'airport-label', 'poi-label'
        ];
        labelLayers.forEach(layer => {
            if (app.map.getLayer(layer)) {
                app.map.setLayoutProperty(layer, 'visibility', 'none');
            }
        });
        app.map.getCanvas().style.cursor = 'crosshair';

        let keys = Object.keys(satellitePositions);
        // Add source
        app.map.addSource('satellites', {
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
        app.map.addLayer({
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



        app.map.on('click',  'satellites', async (e) => {

            if(!e || !e.features || e.features.length > 1) {
                console.log("Error detecting satellites that were clicked");
                return;
            }

            let feature = e.features[0];

            if (!app.selectedSatellite) {
                // Select satellite
                await fetchSelectedSatelliteData(feature.properties.id);
                showSidebar();
            } else if (feature.properties.id === String(app.selectedSatellite.norad)) {
                // Deselect satellite
                app.selectedSatellite = null;
            } else {
                // Change satellite selection
                await fetchSelectedSatelliteData(feature.properties.id);
                showSidebar();
            }

            if (!app.selectedSatellite) {
                // Resets color
                app.map.setPaintProperty('satellites', 'circle-color',
                    '#32cd32'  // default color
                );
                clearSidebarData();

            } else {
                //Paints selected satellite red, all others green
                app.map.setPaintProperty('satellites', 'circle-color', [
                    'case',
                    ['==', ['get', 'id'], String(app.selectedSatellite.norad)],
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
    newDataElement.id = "sidebar-satellite-data";
    newDataElement.innerHTML = `
    
        <h2>${satellite.name}</h2>
        <ul class="sidebar-satellite-data-list">
            <li>Coordinates Over Earth <br>
                <ul class="coordinates-list">
                    <li>
                        Longitude: <span class="coordinates-list-value">${satellite.coordinates[0].toFixed(4)}</span>
                    </li>
                    <li>
                        Latitude: <span class="coordinates-list-value">${satellite.coordinates[1].toFixed(4)}</span>
                    </li>
                </ul>
            </li>
            <li>Norad Number: <span class="value" style="display: inline; margin-left: 0;">${satellite.norad}</span></li>
            <li>Last Updated: <span class="value" style="display: inline; margin-left: 0;">${formattedDate} UTC</span></li>
        </ul>
    
    `;
    newDataElement.className = sidebar.className;
    newDataElement.addEventListener('click', resizeSidebar);

    let children = newDataElement.children;
    for (let i = 0; i < children.length; i++) {
        children[i].addEventListener('click', resizeSidebar);
    }

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
function minimizeSidebar() {
    let sidebar = document.getElementById('sidebar');
    sidebar.className = "minimized";
    let satelliteData = document.getElementById('sidebar-satellite-data');
    if(satelliteData && satelliteData.className) {
        satelliteData.className = "minimized";
    }
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

function showSpinner() {
    document.getElementById('spinner').style.display = 'block';
    document.getElementById('map').style.opacity = '0.8';
}
function hideSpinner() {
    document.getElementById('spinner').style.display = 'none';
    document.getElementById('map').style.opacity = '1';
}

function checkForUpdate() {
    if (!app.lastUpdatedDate) return;

    let currentTime = new Date().getTime();
    let lastUpdatedTime = app.lastUpdatedDate.getTime();
    let diffInSeconds = (currentTime - lastUpdatedTime) / 1000;

    if (diffInSeconds > app.MAX_SECONDS_PER_UPDATE) {
        showSpinner();
    }
}

let checkForUpdateInterval = setInterval(() => {
    checkForUpdate();
}, 1000);



