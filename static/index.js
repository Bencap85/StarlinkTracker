

let selectedSatellite = {};
let mostRecentUpdateDate = new Date();
let MAX_SECONDS_PER_UPDATE = 15;

const sources = [
    'satellite_data_1',
    'satellite_data_2',
    'satellite_data_3'
];

let layers = [];
sources.forEach((source, i) => {
    layers[i] = `satellite-positions-${i+1}`;
});

showSpinner();
initializeMap(mapboxApiToken);



function initializeMap(accessToken) {

    mapboxgl.accessToken = accessToken;
    const map = new mapboxgl.Map({
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

        //Add sources
        sources.forEach((source, i) => {
            map.addSource(source, {
                "type": "geojson",
                "data": `${herokuAppURL}/satellite_data/${i+1}`
            });
        });

        //Add layers
        layers.forEach((layer, i) => {
            map.addLayer({
                "id": layer,
                "source": `satellite_data_${i+1}`,
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
        });

        layers.forEach((layer, i) => {
            map.on('click', layer, (e) => {

                let feature = e.features[0];

                const coordinates = feature.geometry.coordinates.slice();
                const name = feature.properties.name;
                const last_updated = feature.properties.last_updated;
                const norad = feature.properties.id;

                if(selectedSatellite && selectedSatellite.norad && norad === selectedSatellite.norad) {
                    // Setting to null will prevent it from updating
                    selectedSatellite = null;

                    //Resets color
                    layers.forEach(layerArg => {
                        map.setPaintProperty(layerArg, 'circle-color',
                            '#32cd32'  // default color
                        );
                    });

                    clearSidebarData();
                    return;

                }

                selectedSatellite = { name, coordinates, norad, last_updated };

                addSidebarData({ name, coordinates, norad, last_updated });
                showSidebar();

                //Paints selected satellite red, all others green
                layers.forEach(layerArg => {
                    map.setPaintProperty(layerArg, 'circle-color', [
                        'case',
                        ['==', ['get', 'id'], feature.properties.id],
                        '#ff0000', // color for selected satellite
                        '#32cd32'  // default color
                    ]);
                });
                    
            });  
        }); 

        // Update sources
        const sourceNumberToLastModified = {};
        sources.forEach((source, i) => {
            setInterval(() => {
                const mapSource = map.getSource(source);
                if (mapSource && mapSource.type === 'geojson') {

                    let lastModified = sourceNumberToLastModified[i+1]? sourceNumberToLastModified[i+1] : null;

                    fetch(`${herokuAppURL}/satellite_data/${i+1}`, {
                        method: 'GET',
                        headers: {
                            'If-Modified-Since': new Date(lastModified).toUTCString()
                        }
                    }).then(res => {
                        if(res.status == 200) {
                            sourceNumberToLastModified[i+1] = new Date().toUTCString();
                            let lastUpdatedDateString = new Date(sourceNumberToLastModified[i+1]).toUTCString();
                            let newLastUpdatedDate = new Date(lastUpdatedDateString);
                            if (mostRecentUpdateDate && newLastUpdatedDate > mostRecentUpdateDate) {
                                mostRecentUpdateDate = newLastUpdatedDate;
                            }
                            return res.json();
                        } else if(res.status == 304) {

                        } else {
                            console.log("Error, failed to fetch data, status: " + res.status);
                        }
                    }).then(data => {
                        if(data) {
                            mapSource.setData(data);
                        }
                    }).catch(e => console.log(e));


                }
            }, 4000);
            hideSpinner();
        }); // sources.forEach()
    }); // map.on(load)
}


// Add event listeners
document.getElementById('sidebar').addEventListener('click', resizeSidebar);
if (window.innerWidth <= 600) {
    // Hide sidebar
    minimizeSidebar();
}

//Setup clock
setUpClock();

//Keep updating clock
setInterval(updateClock, 1000);

//Update selected satellite
setInterval(() => {
    if(!selectedSatellite || !selectedSatellite.norad) return;

    fetch(`${herokuAppURL}/satellite_data/norad/${selectedSatellite.norad}`)
        .then(res => res.json())
        .then(data => {
            selectedSatellite.coordinates = data.coordinates;
            selectedSatellite.last_updated = data.last_updated;
        });
    addSidebarData(selectedSatellite);

}, 2000);


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

function showSpinner() {
    document.getElementById('spinner').style.display = 'block';
    document.getElementById('map').style.opacity = '0.8';
}
function hideSpinner() {
    document.getElementById('spinner').style.display = 'none';
    document.getElementById('map').style.opacity = '1';
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

function checkForUpdate() {
    let lastUpdated = mostRecentUpdateDate

    if (!lastUpdated) return;

    let currentTime = new Date().getTime();
    let lastUpdatedTime = lastUpdated.getTime();
    let diffInSeconds = (currentTime - lastUpdatedTime) / 1000;

    if (diffInSeconds > MAX_SECONDS_PER_UPDATE) {
        showSpinner();
    } else {
        hideSpinner();
    }
}

let checkForUpdateInterval = setInterval(() => {
    checkForUpdate();
}, 1000);



        

