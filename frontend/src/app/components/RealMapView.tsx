import React, { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, MarkerF, InfoWindowF, useJsApiLoader } from '@react-google-maps/api';
import { SOSAlert } from '../data/mockData';
import { Badge } from './Badge';

interface RealMapViewProps {
  alerts: SOSAlert[];
  activeAlertId: string | null;
  onMarkerClick: (id: string) => void;
}

const mapContainerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 37.7749, lng: -122.4194 };

const darkMapStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
];

const getMarkerIcon = (priority: string, status: string, isActive: boolean): google.maps.Symbol => {
  let color = "#3b82f6"; // default blue
  if (status === "Resolved") {
    color = "#64748b"; // slate
  } else {
    switch (priority) {
      case "High":
        color = "#ef4444"; // red
        break;
      case "Medium":
        color = "#f59e0b"; // amber
        break;
      case "Low":
        color = "#10b981"; // emerald
        break;
    }
  }

  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: isActive ? 14 : 10,
    fillColor: color,
    fillOpacity: 0.9,
    strokeColor: isActive ? "#ffffff" : color,
    strokeWeight: isActive ? 3 : 1.5,
  };
};

export function RealMapView({ alerts, activeAlertId, onMarkerClick }: RealMapViewProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || "";
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(activeAlertId);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'rescuer-google-maps',
    googleMapsApiKey: apiKey,
  });

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const hasInitialFitRef = useRef(false);
  const lastPannedAlertIdRef = useRef<string | null>(null);

  // Update selected alert when activeAlertId changes externally
  useEffect(() => {
    setSelectedAlertId(activeAlertId);
  }, [activeAlertId]);

  // Center map on active alert ONLY when activeAlertId changes explicitly
  useEffect(() => {
    if (!map || !activeAlertId) return;

    if (lastPannedAlertIdRef.current !== activeAlertId) {
      lastPannedAlertIdRef.current = activeAlertId;
      const targetAlert = alerts.find((a) => a.id === activeAlertId);
      if (targetAlert && targetAlert.location?.lat && targetAlert.location?.lng) {
        map.panTo({ lat: targetAlert.location.lat, lng: targetAlert.location.lng });
        map.setZoom(15);
      }
    }
  }, [map, activeAlertId, alerts]);

  // Fit bounds to show all alerts ONLY ONCE when map is first loaded
  useEffect(() => {
    if (map && alerts.length > 0 && !hasInitialFitRef.current && !activeAlertId) {
      hasInitialFitRef.current = true;
      const bounds = new google.maps.LatLngBounds();
      alerts.forEach((alert) => {
        if (alert.location?.lat && alert.location?.lng) {
          bounds.extend({ lat: alert.location.lat, lng: alert.location.lng });
        }
      });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds);
      }
    }
  }, [map, alerts, activeAlertId]);

  if (!apiKey) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-900 px-6 text-center text-sm text-slate-300 rounded-2xl border border-slate-800">
        Google Maps API key is not configured. Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env.local.
      </div>
    );
  }

  if (loadError || mapError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-900 px-6 text-center text-sm text-red-400 rounded-2xl border border-slate-800">
        {mapError || "Failed to load Google Maps. Please check your API key and network connection."}
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-900 px-6 text-center text-sm text-slate-400 rounded-2xl border border-slate-800">
        Loading Google Maps...
      </div>
    );
  }

  const selectedAlert = alerts.find((a) => a.id === selectedAlertId);

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-700 shadow-inner relative z-0">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={defaultCenter}
        zoom={12}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          styles: darkMapStyle,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        }}
      >
        {alerts.map((alert) => {
          if (!alert.location?.lat || !alert.location?.lng) return null;
          const isActive = alert.id === selectedAlertId;

          return (
            <MarkerF
              key={alert.id}
              position={{ lat: alert.location.lat, lng: alert.location.lng }}
              icon={getMarkerIcon(alert.priority, alert.status, isActive)}
              onClick={() => {
                setSelectedAlertId(alert.id);
                onMarkerClick(alert.id);
              }}
            />
          );
        })}

        {selectedAlert && selectedAlert.location?.lat && selectedAlert.location?.lng && (
          <InfoWindowF
            position={{ lat: selectedAlert.location.lat, lng: selectedAlert.location.lng }}
            onCloseClick={() => setSelectedAlertId(null)}
          >
            <div className="p-1 min-w-[200px] text-slate-900">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-slate-900">{selectedAlert.id}</span>
                <Badge
                  variant={
                    selectedAlert.priority === 'High'
                      ? 'high'
                      : selectedAlert.priority === 'Medium'
                      ? 'medium'
                      : 'low'
                  }
                  className="text-[10px] py-0"
                >
                  {selectedAlert.priority}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mb-2 text-xs">
                <span
                  className={`font-semibold ${
                    selectedAlert.battery < 20
                      ? 'text-red-600'
                      : selectedAlert.battery <= 50
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }`}
                >
                  🔋 {selectedAlert.battery}%
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500">
                  {new Date(selectedAlert.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-1 font-mono">
                {selectedAlert.location.lat.toFixed(4)}, {selectedAlert.location.lng.toFixed(4)}
              </p>
              {selectedAlert.location.address && (
                <p className="text-xs text-slate-600 mb-2 font-medium">
                  📍 {selectedAlert.location.address}
                </p>
              )}
              <p className="text-sm font-medium text-slate-800 line-clamp-2">
                {selectedAlert.message}
              </p>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
    </div>
  );
}
