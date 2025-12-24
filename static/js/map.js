class SimpleRoutePlanner {
    constructor() {
        this.map = null;
        this.startPoint = null;
        this.endPoint = null;
        this.routeControl = null;
        this.currentLayer = null;
        this.routeBuilt = false;

        this.initMap();
        this.bindEvents();
    }

    initMap() {
        this.map = L.map('map').setView([59.9343, 30.3351], 12);
        this.addBaseLayer();
        L.control.scale().addTo(this.map);
        this.map.attributionControl.setPrefix('');
    }

    addBaseLayer() {
        this.currentLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            minZoom: 2
        }).addTo(this.map);
    }

    bindEvents() {
        document.getElementById('zoomIn').addEventListener('click', () => {
            this.map.zoomIn();
        });

        document.getElementById('zoomOut').addEventListener('click', () => {
            this.map.zoomOut();
        });

        document.getElementById('resetView').addEventListener('click', () => {
            this.resetMapView();
        });

        document.getElementById('buildRoute').addEventListener('click', () => {
            this.buildRoute();
        });

        document.getElementById('clearPoints').addEventListener('click', () => {
            this.clearPoints();
        });

        this.map.on('click', (e) => {
            this.handleMapClick(e.latlng);
        });
    }

    handleMapClick(latlng) {
        if (this.startPoint && this.getDistance(this.startPoint.latlng, latlng) > 3000000) {
            this.showStatus('Points too far apart. Try selecting closer locations (max ~3000km).', 'error');
            return;
        }

        if (!this.startPoint) {
            this.setStartPoint(latlng);
        } else if (!this.endPoint) {
            this.setEndPoint(latlng);
        }
    }

    setStartPoint(latlng) {
        if (this.startPoint) {
            this.map.removeLayer(this.startPoint.marker);
        }

        // Создаем новый маркер
        const marker = L.marker(latlng, {
            icon: this.createStartIcon()
        }).addTo(this.map);

        const popup = this.createPointPopup(latlng, 'Start Point', 'green');
        marker.bindPopup(popup);
        marker.openPopup();

        this.startPoint = {
            latlng: latlng,
            marker: marker
        };

        this.showStatus('Стартовая точка выбрана. Выберите конечную точку', 'success');
        this.updateRouteButton(false);

        this.map.setView(latlng, Math.min(this.map.getZoom() + 2, 18));
    }

    setEndPoint(latlng) {
        if (this.endPoint) {
            this.map.removeLayer(this.endPoint.marker);
        }

        const marker = L.marker(latlng, {
            icon: this.createEndIcon()
        }).addTo(this.map);

        const popup = this.createPointPopup(latlng, 'End Point', 'red');
        marker.bindPopup(popup);
        marker.openPopup();

        this.endPoint = {
            latlng: latlng,
            marker: marker
        };

        this.showStatus('Точки выбраны. Можно строить маршрут', 'success');
        this.updateRouteButton(true);

        const bounds = L.latLngBounds([this.startPoint.latlng, latlng]);
        this.map.fitBounds(bounds, { padding: [50, 50] });
    }

    buildRoute() {
        if (!this.startPoint || !this.endPoint) {
            this.showStatus('Please select both start and end points.', 'error');
            return;
        }

        this.clearRoute();

        this.showStatus('Расчёт маршрута...', 'info');
        document.getElementById('buildRoute').disabled = true;
        document.getElementById('buildRoute').textContent = 'Calculating...';

        const waypoints = [
            L.latLng(this.startPoint.latlng.lat, this.startPoint.latlng.lng),
            L.latLng(this.endPoint.latlng.lat, this.endPoint.latlng.lng)
        ];

        console.log('Building route between:', waypoints);

        try {
            this.routeControl = L.Routing.control({
                waypoints: waypoints,
                show: false,
                addWaypoints: false,
                draggableWaypoints: false,
                fitSelectedRoutes: true,
                createMarker: function(i, waypoint, n) {
                    const latlng = waypoint.latLng;
                    if (i === 0) {
                        return L.marker(latlng, {
                            icon: this.createStartIcon(),
                            draggable: false
                        });
                    } else {
                        return L.marker(latlng, {
                            icon: this.createEndIcon(),
                            draggable: false
                        });
                    }
                }.bind(this),
                lineOptions: {
                    styles: [{
                        color: '#2196F3',
                        opacity: 0.85,
                        weight: 8,
                        dashArray: ''
                    }]
                },
                router: L.Routing.osrmv1({
                    serviceUrl: 'https://router.project-osrm.org/route/v1',
                    profile: 'driving',
                    language: 'en',
                    timeout: 10000,
                    options: {
                        overview: 'full',
                        steps: true,
                        geometries: 'geojson',
                        alternatives: false,
                        continue_straight: true,
                        arrive_by: false
                    }
                })
            }).addTo(this.map);

            this.routeControl.on('routesfound', (e) => {
                console.log('Routes found:', e);
                const routes = e.routes;
                if (routes && routes.length > 0) {
                    this.handleRouteSuccess(routes[0]);
                } else {
                    this.handleRouteError('No routes found');
                }
            });

            this.routeControl.on('routingerror', (e) => {
                console.error('Routing error:', e);
                this.handleRouteError('Routing service error');
            });

            this.routeControl.on('routingstart', () => {
                console.log('Routing started');
            });

        } catch (error) {
            console.error('Error creating route control:', error);
            this.handleRouteError('Failed to create route');
        }
    }

    handleRouteSuccess(route) {
        console.log('Route success:', route);
        console.log('Route summary:', route.summary);

        const distance = route.summary.totalDistance;
        const time = route.summary.totalTime;

        if (!distance || !time || distance <= 0) {
            this.handleRouteError('Invalid route data');
            return;
        }

        const distanceText = this.formatDistance(distance);
        const timeText = this.formatTime(time);

        this.showStatus(`Маршрут построен`, 'success');

        document.getElementById('routeInfo').innerHTML = `
            <div style="text-align: left; line-height: 1.6;">
                <div style="font-size: 16px; font-weight: bold; color: #2196F3; margin-bottom: 8px;">
                    Информация о маршруте
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="color: #666;">Расстояние:</span>
                    <span style="font-weight: bold;">${distanceText}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="color: #666;">Время в пути:</span>
                    <span style="font-weight: bold;">${timeText}</span>
                </div>

            </div>
        `;
        document.getElementById('routeInfo').classList.remove('hidden');
        document.getElementById('routeInfo').classList.add('show');

        this.routeBuilt = true;

        document.getElementById('buildRoute').disabled = false;
        document.getElementById('buildRoute').textContent = 'Rebuild Route';

        if (route.bounds) {
            this.map.fitBounds(route.bounds, {
                padding: [30, 30],
                animate: true
            });
        }

        const routeLines = document.querySelectorAll('.leaflet-routing-line');
        routeLines.forEach(line => {
            line.style.opacity = '0';
            line.style.transition = 'opacity 0.5s ease-in-out';
            setTimeout(() => {
                line.style.opacity = '0.85';
            }, 100);
        });
    }

    handleRouteError(errorMessage) {
        console.error('Route error:', errorMessage);
        this.showStatus('Cannot build route: ' + errorMessage + '. Try selecting different points.', 'error');

        document.getElementById('buildRoute').disabled = false;
        document.getElementById('buildRoute').textContent = 'Build Route';

        this.clearRoute();
    }

    clearPoints() {
        this.clearRoute();
        this.clearMarkers();
        this.resetState();
        this.showStatus('Нажмите на карту для выбора точек', 'info');
    }

    clearRoute() {
        if (this.routeControl) {
            this.map.removeControl(this.routeControl);
            this.routeControl = null;
        }
        this.routeBuilt = false;

        const buildBtn = document.getElementById('buildRoute');
        buildBtn.textContent = 'Build Route';
        buildBtn.disabled = !this.startPoint || !this.endPoint;
    }

    clearMarkers() {
        if (this.startPoint && this.startPoint.marker) {
            this.map.removeLayer(this.startPoint.marker);
            this.startPoint = null;
        }

        if (this.endPoint && this.endPoint.marker) {
            this.map.removeLayer(this.endPoint.marker);
            this.endPoint = null;
        }
    }

    resetState() {
        this.updateRouteButton(false);
        document.getElementById('routeInfo').classList.remove('show');
        document.getElementById('routeInfo').classList.add('hidden');
        document.getElementById('routeInfo').innerHTML = '';
    }

    resetMapView() {
        if (this.routeBuilt && this.startPoint && this.endPoint) {
            const bounds = L.latLngBounds([
                this.startPoint.latlng,
                this.endPoint.latlng
            ]);
            this.map.fitBounds(bounds, { padding: [50, 50] });
        } else if (this.startPoint) {
            this.map.setView(this.startPoint.latlng, Math.min(this.map.getZoom(), 15));
        } else {
            this.map.setView([51.505, -0.09], 13);
        }
    }

    updateRouteButton(enabled) {
        const button = document.getElementById('buildRoute');
        button.disabled = !enabled;
        button.classList.toggle('disabled', !enabled);
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('routeStep');
        statusEl.textContent = message;
        statusEl.className = `status-${type}`;

        if (type === 'error') {
            document.getElementById('routeInfo').classList.remove('show');
            document.getElementById('routeInfo').classList.add('hidden');
        }
    }

    createStartIcon() {
        return L.divIcon({
            className: 'custom-div-icon start-marker',
            html: `
                <div style="
                    background: linear-gradient(135deg, #4CAF50, #45a049);
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    border: 4px solid white;
                    box-shadow: 0 4px 16px rgba(76, 175, 80, 0.4);
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: 12px;
                ">
                    A
                    <div style="
                        position: absolute;
                        bottom: -4px;
                        left: 50%;
                        transform: translateX(-50%);
                        width: 0;
                        height: 0;
                        border-left: 8px solid transparent;
                        border-right: 8px solid transparent;
                        border-top: 12px solid #4CAF50;
                        z-index: 1;
                    "></div>
                </div>
            `,
            iconSize: [40, 44],
            iconAnchor: [20, 22],
            popupAnchor: [0, -25]
        });
    }

    createEndIcon() {
        return L.divIcon({
            className: 'custom-div-icon end-marker',
            html: `
                <div style="
                    background: linear-gradient(135deg, #f44336, #d32f2f);
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    border: 4px solid white;
                    box-shadow: 0 4px 16px rgba(244, 67, 54, 0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: 12px;
                ">
                    B
                </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -20]
        });
    }

    createPointPopup(latlng, title, color) {
        const typeLabel = title === 'Start Point' ? 'START' : 'END';
        const pointColor = color === 'green' ? '#4CAF50' : '#f44336';

        return `
            <div style="min-width: 220px; padding: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <div style="
                        background: ${pointColor};
                        width: 12px;
                        height: 12px;
                        border-radius: 50%;
                        margin-right: 8px;
                    "></div>
                    <h4 style="margin: 0; color: ${pointColor}; font-size: 16px; font-weight: 600;">
                        ${title}
                    </h4>
                </div>
                <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin: 10px 0; border-left: 4px solid ${pointColor};">
                    <div style="font-size: 14px; color: #495057; margin-bottom: 5px;">
                        <strong>📍 Geographic Coordinates</strong>
                    </div>
                    <div style="font-family: 'Courier New', monospace; font-size: 13px; background: white; padding: 8px; border-radius: 4px; border: 1px solid #dee2e6;">
                        <div>Latitude: ${latlng.lat.toFixed(6)}°</div>
                        <div>Longitude: ${latlng.lng.toFixed(6)}°</div>
                    </div>
                </div>
                <div style="font-size: 12px; color: #6c757d; border-top: 1px solid #dee2e6; padding-top: 10px;">
                    ${this.startPoint && this.endPoint ?
                        `<strong>Type:</strong> ${typeLabel} Point • Select the other point to complete route` :
                        `<strong>Next:</strong> ${title === 'Start Point' ? 'Select end point to continue' : 'Route ready!'}`
                    }
                </div>
            </div>
        `;
    }

    formatDistance(meters) {
        if (!meters || meters <= 0) return '0 m';

        if (meters < 1000) {
            return `${Math.round(meters)} m`;
        } else {
            return `${(meters / 1000).toFixed(1)} km`;
        }
    }

    formatTime(seconds) {
        if (!seconds || seconds <= 0) return '0 min';

        const minutes = Math.round(seconds / 60);
        if (minutes < 60) {
            return `${minutes} min`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            return `${hours}h ${remainingMinutes}min`;
        }
    }

    getDistance(point1, point2) {
        const R = 6371000;
        const lat1 = point1.lat * Math.PI / 180;
        const lat2 = point2.lat * Math.PI / 180;
        const deltaLat = (point2.lat - point1.lat) * Math.PI / 180;
        const deltaLng = (point2.lng - point1.lng) * Math.PI / 180;

        const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.routePlanner = new SimpleRoutePlanner();

    const styles = `
        .leaflet-routing-geocoders {
            display: none !important;
        }

        .leaflet-routing-container {
            display: none !important;
        }

        .custom-div-icon {
            background: transparent;
            border: none;
            text-align: center;
        }

        .status-info {
            color: #2196F3;
            font-weight: 500;
        }
        .status-success {
            color: #4CAF50;
            font-weight: 600;
        }
        .status-error {
            color: #f44336;
            font-weight: 500;
        }

        .leaflet-routing-line {
            stroke: #2196F3 !important;
            stroke-opacity: 0.85 !important;
            stroke-width: 8px !important;
            stroke-linecap: round;
            stroke-linejoin: round;
            filter: drop-shadow(0 0 3px rgba(33, 150, 243, 0.3));
        }

        #map.leaflet-container {
            cursor: crosshair;
        }

        #map.leaflet-container:not(.leaflet-touch-drag):not(.leaflet-touch-zoom):hover {
            cursor: crosshair;
        }

        @keyframes routeAppear {
            from {
                stroke-dashoffset: 1000;
                opacity: 0;
            }
            to {
                stroke-dashoffset: 0;
                opacity: 0.85;
            }
        }

        .leaflet-routing-line {
            stroke-dasharray: 10 5;
            animation: routeAppear 1s ease-out forwards;
        }
    `;

    const style = document.createElement('style');
    style.textContent = styles;
    document.head.appendChild(style);
});