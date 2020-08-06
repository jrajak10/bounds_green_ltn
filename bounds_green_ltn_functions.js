export { addMapFeatures, addStreetsLayer, API_KEY }

const API_KEY = 'Ae6wi8HZzLBBiZE3xLoRvqYhqoV83ije';
const WFS_SERVICE_URL = 'https://api.os.uk/features/v1/wfs';

function addMapFeatures(map){
    map.dragRotate.disable(); // Disable map rotation using right click + drag.
    map.touchZoomRotate.disableRotation(); // Disable map rotation using touch rotation gesture.
    
    // Add navigation control (excluding compass button) to the map.
    map.addControl(new mapboxgl.NavigationControl({
        showCompass: false
    }));

    // Add event which waits for the map to be loaded.
map.on('load', async function () {

    map.on('click', function (e) {


        let bounds = map.getBounds();

        let x = bounds.getSouthWest().lat + ',' + bounds.getSouthWest().lng,
            y = bounds.getNorthEast().lat + ',' + bounds.getNorthEast().lng;

        let z = x + ' ' + y;
        console.log(JSON.stringify(e.lngLat.wrap()))
    });

    let roads = ['Westbury Road', 'Brownlow Road', 'Elvendon Road', "Goring Road", "Beech Road",
        "Hardwicke Road", "Natal Road", "York Road", "Warwick Road", "Highworth Road",
        "Stanley Road", "Ollerton Road", "Evesham Road", "Shrewsbury Road", "Maidstone Road",
        "Tewkesbury Terrace", "Russell Road", "Whittington Road", "Palmerston Road"];

    let trafficRoadsArray = ['Bounds Green Road', 'Bowes Road', "Green Lanes", "High Road", "Telford Road", 
                            "Durnsford Road", "Powys Lane", "Wilmer Way", "Pinkham Way", "North Circular Road"];

    let oneWayRoadsArray = ["Queens Road", 'Sidney Avenue', "Melbourne Avenue", "Kelvin Avenue", "Belsize Avenue", "Spencer Avenue"];

    
    let trafficRoads = await arrayToRoads(trafficRoadsArray);
   
    let brownlow = await getFeatures('Highways_Roadlink', 'Brownlow Road');

    let bannedStreets = [[brownlow[1]], [brownlow[5]], [brownlow[7]], [brownlow[15]], [brownlow[16]]]
    let mergedBannedStreets = convertAndMerge(bannedStreets);
 
    let allowedStreets = await arrayToRoads(roads);
    let oneWayRoads = await arrayToRoads(oneWayRoadsArray);



    addStreetsLayer(map, oneWayRoads, 'one-way-roads', '#084f9d', 5)
    addStreetsLayer(map, allowedStreets, 'allowed-streets', '#00ab66', 5)
    addStreetsLayer(map, mergedBannedStreets, 'banned-streets', '#FFA500', 10)
    addStreetsLayer(map, trafficRoads, 'traffic-streets', '#F00', 10)
    
    

    function click(id) {
        // When a click event occurs on a feature in the 'streets' layer, open a popup at
        // the location of the click, with description HTML from its properties.
        map.on('click', id, function (e) {

            let bounds = map.getBounds();

            let x = bounds.getSouthWest().lat + ',' + bounds.getSouthWest().lng,
                y = bounds.getNorthEast().lat + ',' + bounds.getNorthEast().lng;

            let z = x + ' ' + y;

            new mapboxgl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(e.features[0].properties.RoadName1 + ' '+ e.features[0].properties.RoadClassification )
                .addTo(map);
        });
    }

    function mouseEnter(id) {
        // Change the cursor to a pointer when the mouse is over the 'streets' layer.
        map.on('mouseenter', id, function () {
            map.getCanvas().style.cursor = 'pointer';
        });
    }

    function mouseLeave(id) {
        // Change the cursor back to a pointer when it leaves the 'streets' layer.
        map.on('mouseleave', id, function () {
            map.getCanvas().style.cursor = '';
        });
    }

    click('allowed-streets')
    click('traffic-streets')
    click('banned-streets')
    mouseEnter('allowed-streets')
    mouseEnter('banned-streets')
    mouseLeave('allowed-streets')
    mouseLeave('banned-streets')

});


}



async function fetchRoads(roads){
    let totalArray = [];
    for (let i = 0; i < roads.length; i++) {
        totalArray.push(await getFeatures('Highways_Roadlink', roads[i]))
    }
    return totalArray
}


/**
 * Return URL with encoded parameters.
 * @param {array} params
 */
function convertLineStringCoords(arr) {
    for (let i = 0; i < arr.length; i++) {
        arr[i].geometry.coordinates = arr[i].geometry.coordinates[0];
    }
    return arr;
}

function convertAndMerge(arr){
    let convertedArrayCoords = arr.map(x => convertLineStringCoords(x));
    let mergedArrayCoords = [].concat(...convertedArrayCoords);
    return mergedArrayCoords;
}

async function arrayToRoads(arr){
    let fetchedRoads = await fetchRoads(arr);
    let mergedRoads = convertAndMerge(fetchedRoads);

    return mergedRoads
}

function addStreetsLayer(map, features, id, color, width) {
    map.addSource(id, {
        'type': 'geojson',
        'data': {
            'type': 'FeatureCollection',
            'features': features
        }
    });

    map.addLayer({
        'id': id,
        'type': 'line',
        'source': id,
        'paint': {
            'line-width': width,
            'line-color': color
        }
    });
}





/**
 * Get features from the WFS.
 */
async function getFeatures(typeName, literal) {
    // Convert the bounds to a formatted string.
    let sw = [51.59536880893367, -0.13772922026373635],
        ne = [51.61892429114269, -0.09636146493642173];

    let coords = sw + ' ' + ne;
    // Create an OGC XML filter parameter value which will select the Airport
    // features (site function) intersecting the BBOX coordinates.
    let xml = '<ogc:Filter>';
    xml += '<ogc:And>';
    xml += '<ogc:BBOX>';
    xml += '<ogc:PropertyName>SHAPE</ogc:PropertyName>';
    xml += '<gml:Box srsName="urn:ogc:def:crs:EPSG::4326">';
    xml += '<gml:coordinates>' + coords + '</gml:coordinates>';
    xml += '</gml:Box>';
    xml += '</ogc:BBOX>';
    xml += '<ogc:PropertyIsEqualTo>';
    xml += '<ogc:PropertyName>RoadName1</ogc:PropertyName>';
    xml += '<ogc:Literal>' + literal + '</ogc:Literal>';
    xml += '</ogc:PropertyIsEqualTo>';
    xml += '</ogc:And>';
    xml += '</ogc:Filter>';

    // Define (WFS) parameters object.
    let startIndex = 0;
    let featureLength = 0;
    let totalFeatures = [];

    do {
        let params = {
            key: API_KEY,
            service: 'WFS',
            request: 'GetFeature',
            version: '2.0.0',
            typeNames: typeName,
            outputFormat: 'GEOJSON',
            srsName: 'urn:ogc:def:crs:EPSG::4326',
            filter: xml,
            startIndex: startIndex.toString(),
            count: 100
        };

        let featureUrl = getUrl(params);
        let response = await fetch(featureUrl);
        let json = await response.json();
        let featureArray = json.features;
        featureLength = featureArray.length;

        totalFeatures.push(featureArray);
        startIndex += featureLength;
    }
    while (featureLength >= 100)
    return [].concat(...totalFeatures);
}

/**
 * Return URL with encoded parameters.
 * @param {object} params - The parameters object to be encoded.
 */
function getUrl(params) {
    let encodedParameters = Object.keys(params)
        .map(paramName => paramName + '=' + encodeURI(params[paramName]))
        .join('&');

    return WFS_SERVICE_URL + '?' + encodedParameters;
}