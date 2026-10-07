import { FC, Fragment, useEffect, useState, useRef } from "react";
import {
  GoogleMap,
  InfoWindowF,
  MarkerF,
  useJsApiLoader,
} from "@react-google-maps/api";
import { SOSAlert, Rescuer } from "../data";

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

interface MapSectionProps {
  alerts: SOSAlert[];
  rescuers: Rescuer[];
  selectedAlert: SOSAlert | null;
  locateRequest: number;
}

interface MapSectionCanvasProps extends MapSectionProps {
  apiKey: string;
  onMapError: (message: string) => void;
}

type OpenInfoWindow = { type: "sos" | "rescuer"; id: string } | null;

const mapContainerStyle = { width: "100%", height: "100%" };
const fallbackCenter = { lat: 20, lng: 0 };

const mapOptions: google.maps.MapOptions = {
  clickableIcons: true,
  fullscreenControl: false,
  gestureHandling: "greedy",
  mapTypeControl: true,
  mapTypeId: "roadmap",
  streetViewControl: false,
  zoomControl: true,
};

const getAlertMarkerIcon = (status: SOSAlert["status"]): google.maps.Symbol => {
  const color = status === "RESOLVED" ? "#22c55e" : "#ef4444";

  return {
    anchor: new google.maps.Point(0, 0),
    fillColor: color,
    fillOpacity: 0.8,
    path: google.maps.SymbolPath.CIRCLE,
    scale: 12,
    strokeColor: color,
    strokeWeight: 2,
  };
};

function MapSectionCanvas({
  alerts,
  rescuers,
  selectedAlert,
  locateRequest,
  apiKey,
  onMapError,
}: MapSectionCanvasProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "ars-google-maps",
    googleMapsApiKey: apiKey,
  });
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [openInfoWindow, setOpenInfoWindow] = useState<OpenInfoWindow>(null);

  useEffect(() => {
    if (!loadError) return;

    console.error("[ARS Map] Google Maps JavaScript API failed to load.", loadError);
    onMapError(
      "Google Maps could not be loaded. Check your network, API key, Maps JavaScript API access, billing, and HTTP referrer restrictions."
    );
  }, [loadError, onMapError]);

  useEffect(() => {
    if (!isLoaded) return;

    const previousAuthFailure = window.gm_authFailure;
    const handleAuthFailure = () => {
      console.error(
        "[ARS Map] Google Maps authorization failed. Check the API key, enabled Maps JavaScript API, billing, and HTTP referrer restrictions."
      );
      onMapError(
        "Google Maps authorization failed. Check the API key, enabled Maps JavaScript API, billing, and HTTP referrer restrictions."
      );
    };

    window.gm_authFailure = handleAuthFailure;
    return () => {
      if (window.gm_authFailure === handleAuthFailure) {
        window.gm_authFailure = previousAuthFailure;
      }
    };
  }, [isLoaded, onMapError]);

  const lastPannedAlertIdRef = useRef<string | null>(null);
  const lastLocateRequestRef = useRef<number>(locateRequest);

  useEffect(() => {
    if (!map || !selectedAlert) return;

    const isNewAlert = lastPannedAlertIdRef.current !== selectedAlert.id;
    const isNewLocate = lastLocateRequestRef.current !== locateRequest;

    if (isNewAlert || isNewLocate) {
      lastPannedAlertIdRef.current = selectedAlert.id;
      lastLocateRequestRef.current = locateRequest;
      map.panTo({ lat: selectedAlert.lat, lng: selectedAlert.lng });
      map.setZoom(14);
    }
  }, [map, selectedAlert, locateRequest]);

  if (loadError) return null;
  if (!isLoaded) {
    return (
      <MapMessage>
        Loading Google Maps…
      </MapMessage>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={fallbackCenter}
      zoom={2}
      options={mapOptions}
      onLoad={setMap}
      onUnmount={() => setMap(null)}
    >
      {alerts.map((alert, index) => {
        const position = { lat: alert.lat, lng: alert.lng };
        const infoWindowIsOpen =
          openInfoWindow?.type === "sos" && openInfoWindow.id === alert.id;

        return (
          <Fragment key={`${alert.id}-${alert.timestamp}-${index}`}>
            <MarkerF
              position={position}
              icon={getAlertMarkerIcon(alert.status)}
              onClick={() => setOpenInfoWindow({ type: "sos", id: alert.id })}
            />
            {infoWindowIsOpen && (
              <InfoWindowF
                position={position}
                onCloseClick={() => setOpenInfoWindow(null)}
              >
                <div>
                  <h3>{alert.victimName}</h3>
                  <p>{alert.message}</p>
                  <p>{alert.severity}</p>
                </div>
              </InfoWindowF>
            )}
          </Fragment>
        );
      })}

      {rescuers.map((rescuer) => {
        const position = {
          lat: rescuer.latitude,
          lng: rescuer.longitude,
        };
        const infoWindowIsOpen =
          openInfoWindow?.type === "rescuer" &&
          openInfoWindow.id === rescuer.rescuerId;

        return (
          <Fragment key={rescuer.rescuerId}>
            <MarkerF
              position={position}
              onClick={() =>
                setOpenInfoWindow({
                  type: "rescuer",
                  id: rescuer.rescuerId,
                })
              }
            />
            {infoWindowIsOpen && (
              <InfoWindowF
                position={position}
                onCloseClick={() => setOpenInfoWindow(null)}
              >
                <div>
                  <h3>{rescuer.rescuerName}</h3>
                  <p>Status: {rescuer.status}</p>
                </div>
              </InfoWindowF>
            )}
          </Fragment>
        );
      })}
    </GoogleMap>
  );
}

function MapMessage({ children }: { children: string }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-[#060913] px-6 text-center text-sm text-slate-300"
      role="status"
    >
      {children}
    </div>
  );
}

export const MapSection: FC<MapSectionProps> = (props) => {
  const [mapError, setMapError] = useState<string | null>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();

  useEffect(() => {
    if (apiKey) return;
    console.error(
      "[ARS Map] Google Maps API key is missing. Set VITE_GOOGLE_MAPS_API_KEY in host-dashboard/.env.local and restart Vite."
    );
    setMapError(
      "Google Maps API key is not configured. Add VITE_GOOGLE_MAPS_API_KEY to host-dashboard/.env.local and restart the frontend."
    );
  }, [apiKey]);

  return (
    <div className="flex-1 relative overflow-hidden rounded-xl">
      {!apiKey ? (
        <MapMessage>
          Google Maps API key is not configured. Add VITE_GOOGLE_MAPS_API_KEY to
          host-dashboard/.env.local and restart the frontend.
        </MapMessage>
      ) : mapError ? (
        <MapMessage>{mapError}</MapMessage>
      ) : (
        <MapSectionCanvas
          {...props}
          apiKey={apiKey}
          onMapError={setMapError}
        />
      )}
    </div>
  );
};
