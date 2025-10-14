import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  FeatureGroup,
  GeoJSON,
  Tooltip,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  IconButton,
  Paper,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip as MuiTooltip,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PlaceIcon from '@mui/icons-material/Place';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import axios from 'axios';
import * as turf from '@turf/turf';

const WIND_GRID_ENDPOINT = 'http://localhost:8000/wind-grid';
const WIND_GRID_RESOLUTION = { rows: 9, cols: 9 };
const ROTOR_DIAMETER_M = 160;
const PENALTY_COEFFICIENT = 2000;
const WAKE_DECAY_CONSTANT = 0.075;
const TURBINE_THRUST_COEFFICIENT = 0.88;
const NOMINATIM_EMAIL = 'windsite.ai-demo@example.com';

const turbinePowerCurve = (windSpeed) => {
  if (windSpeed < 4) {
    return 0;
  }
  if (windSpeed < 12) {
    const delta = windSpeed - 4;
    return 0.5 * delta * delta;
  }
  if (windSpeed < 25) {
    return 40 + 1.2 * (windSpeed - 12);
  }
  return 0;
};

const calculateSpacingPenalty = (x, y, rotorDiameterKm) => {
  const minSpacing = rotorDiameterKm * 5;
  let penalty = 0;

  for (let i = 0; i < x.length; i += 1) {
    for (let j = i + 1; j < x.length; j += 1) {
      const dx = x[i] - x[j];
      const dy = y[i] - y[j];
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < minSpacing) {
        const violation = (minSpacing - distance) / minSpacing;
        penalty += 5 * violation * violation;
      }
    }
  }

  return penalty;
};

const wakeDeficit = (xi, yi, xj, yj, directionDeg, windSpeed, rotorDiameterKm) => {
  const dx = xi - xj;
  const dy = yi - yj;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance <= 0) {
    return 0;
  }

  const theta = (directionDeg * Math.PI) / 180;
  const wakeRadius = rotorDiameterKm / 2 + WAKE_DECAY_CONSTANT * distance;
  const crosswindDistance = Math.abs(-Math.sin(theta) * dx + Math.cos(theta) * dy);

  if (crosswindDistance > wakeRadius) {
    return 0;
  }

  if (wakeRadius <= 0) {
    return 0;
  }

  const deficit = (1 - Math.sqrt(1 - TURBINE_THRUST_COEFFICIENT)) * ((rotorDiameterKm / 2) / wakeRadius) ** 2;
  const gaussian = Math.exp(-0.5 * (crosswindDistance / wakeRadius) ** 2);

  return deficit * gaussian * windSpeed;
};

const buildGeometryMeta = (surface) => {
  const { meta } = surface;
  const minLon = meta.min_lon;
  const maxLon = meta.max_lon;
  const minLat = meta.min_lat;
  const maxLat = meta.max_lat;

  const horizontalKm = Math.max(
    0.001,
    turf.distance([minLon, minLat], [maxLon, minLat], { units: 'kilometers' }),
  );
  const verticalKm = Math.max(
    0.001,
    turf.distance([minLon, minLat], [minLon, maxLat], { units: 'kilometers' }),
  );

  const lonSpan = maxLon - minLon || 1e-6;
  const latSpan = maxLat - minLat || 1e-6;

  return {
    minLon,
    maxLon,
    minLat,
    maxLat,
    rows: meta.rows,
    cols: meta.cols,
    horizontalKm,
    verticalKm,
    rotorDiameterKm: ROTOR_DIAMETER_M / 1000,
    lonToKm: (lon) => ((lon - minLon) / lonSpan) * horizontalKm,
    latToKm: (lat) => ((lat - minLat) / latSpan) * verticalKm,
    kmToLon: (xKm) => minLon + (horizontalKm ? (xKm / horizontalKm) * lonSpan : 0),
    kmToLat: (yKm) => minLat + (verticalKm ? (yKm / verticalKm) * latSpan : 0),
  };
};

const buildWindSampler = (surface, geometryMeta) => {
  const { grid } = surface;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const { horizontalKm, verticalKm } = geometryMeta;

  const clampIndex = (value, limit) => {
    if (Number.isNaN(value)) return 0;
    if (value < 0) return 0;
    if (value > limit) return limit;
    return value;
  };

  const getValue = (row, col) => {
    const safeRow = clampIndex(row, rows - 1);
    const safeCol = clampIndex(col, cols - 1);
    return grid[safeRow][safeCol];
  };

  const sampleByKm = (xKm, yKm) => {
    if (!rows || !cols) {
      return 0;
    }

    const colPos = cols === 1 || horizontalKm === 0 ? 0 : (xKm / horizontalKm) * (cols - 1);
    const rowPos = rows === 1 || verticalKm === 0 ? 0 : (yKm / verticalKm) * (rows - 1);

    const baseRow = Math.floor(rowPos);
    const baseCol = Math.floor(colPos);
    const deltaRow = rowPos - baseRow;
    const deltaCol = colPos - baseCol;

    const v00 = getValue(baseRow, baseCol);
    const v01 = getValue(baseRow, baseCol + 1);
    const v10 = getValue(baseRow + 1, baseCol);
    const v11 = getValue(baseRow + 1, baseCol + 1);

    return (
      v00 * (1 - deltaRow) * (1 - deltaCol)
      + v01 * (1 - deltaRow) * deltaCol
      + v10 * deltaRow * (1 - deltaCol)
      + v11 * deltaRow * deltaCol
    );
  };

  return {
    byKm: sampleByKm,
    byLatLng: (lat, lon) => {
      const xKm = geometryMeta.lonToKm(lon);
      const yKm = geometryMeta.latToKm(lat);
      return sampleByKm(xKm, yKm);
    },
  };
};

const optimizeLayoutWithWind = (siteList, surface, areaFeature) => {
  if (!surface || !siteList.length) {
    return siteList;
  }

  const geometryMeta = buildGeometryMeta(surface);
  const sampler = buildWindSampler(surface, geometryMeta);
  const rotorDiameterKm = geometryMeta.rotorDiameterKm;

  if (!geometryMeta.horizontalKm || !geometryMeta.verticalKm) {
    return siteList.map((site) => {
      const windSpeed = sampler.byLatLng(site.lat, site.lng);
      const estimatedPower = 2 * turbinePowerCurve(windSpeed);
      return {
        ...site,
        windSpeed: Number(windSpeed.toFixed(2)),
        estimatedPowerMw: Number(estimatedPower.toFixed(2)),
      };
    });
  }

  const numTurbines = siteList.length;
  const maxX = geometryMeta.horizontalKm;
  const maxY = geometryMeta.verticalKm;
  const marginX = Math.min(rotorDiameterKm, maxX / 4 || rotorDiameterKm);
  const marginY = Math.min(rotorDiameterKm, maxY / 4 || rotorDiameterKm);

  const toKmX = siteList.map((site) => geometryMeta.lonToKm(site.lng));
  const toKmY = siteList.map((site) => geometryMeta.latToKm(site.lat));

  const objectiveFunction = (xArr, yArr) => {
    const spacingPenalty = calculateSpacingPenalty(xArr, yArr, rotorDiameterKm);
    let totalPower = 0;

    for (let i = 0; i < numTurbines; i += 1) {
      const windSpeed = sampler.byKm(xArr[i], yArr[i]);
      let wakeEffect = 0;
      for (let j = 0; j < numTurbines; j += 1) {
        if (i === j) continue;
        wakeEffect += wakeDeficit(xArr[i], yArr[i], xArr[j], yArr[j], 0, windSpeed, rotorDiameterKm);
      }
      const effectiveWind = Math.max(0, windSpeed - wakeEffect);
      totalPower += 2 * turbinePowerCurve(effectiveWind);
    }

    return -(totalPower - PENALTY_COEFFICIENT * spacingPenalty);
  };

  const gradient = (xArr, yArr) => {
    const epsilon = 0.05;
    const gradX = new Array(numTurbines).fill(0);
    const gradY = new Array(numTurbines).fill(0);

    for (let i = 0; i < numTurbines; i += 1) {
      const xPlus = [...xArr];
      const xMinus = [...xArr];
      xPlus[i] += epsilon;
      xMinus[i] -= epsilon;
      gradX[i] = 10 * (objectiveFunction(xPlus, yArr) - objectiveFunction(xMinus, yArr)) / (2 * epsilon);

      const yPlus = [...yArr];
      const yMinus = [...yArr];
      yPlus[i] += epsilon;
      yMinus[i] -= epsilon;
      gradY[i] = 10 * (objectiveFunction(xArr, yPlus) - objectiveFunction(xArr, yMinus)) / (2 * epsilon);
    }

    return { gradX, gradY };
  };

  let currentX = [...toKmX];
  let currentY = [...toKmY];
  let bestX = [...currentX];
  let bestY = [...currentY];
  let bestObjective = objectiveFunction(currentX, currentY);

  const learningRate = 0.08;
  const maxIter = 120;

  for (let iteration = 0; iteration < maxIter; iteration += 1) {
    const { gradX, gradY } = gradient(currentX, currentY);

    let maxGrad = 0;
    for (let i = 0; i < numTurbines; i += 1) {
      currentX[i] -= learningRate * gradX[i];
      currentY[i] -= learningRate * gradY[i];
      maxGrad = Math.max(maxGrad, Math.abs(gradX[i]), Math.abs(gradY[i]));
    }

    for (let i = 0; i < numTurbines; i += 1) {
      currentX[i] = Math.min(maxX - marginX, Math.max(marginX, currentX[i]));
      currentY[i] = Math.min(maxY - marginY, Math.max(marginY, currentY[i]));
    }

    const currentObjective = objectiveFunction(currentX, currentY);
    if (currentObjective < bestObjective) {
      bestObjective = currentObjective;
      bestX = [...currentX];
      bestY = [...currentY];
    }

    if (maxGrad < 1e-4) {
      break;
    }
  }

  const optimized = siteList.map((site, index) => {
    const candidateLat = geometryMeta.kmToLat(bestY[index]);
    const candidateLon = geometryMeta.kmToLon(bestX[index]);
    const candidatePoint = turf.point([candidateLon, candidateLat]);
    const inside = turf.booleanPointInPolygon(candidatePoint, areaFeature);

    const finalLat = inside ? candidateLat : site.lat;
    const finalLon = inside ? candidateLon : site.lng;

    const windSpeed = sampler.byLatLng(finalLat, finalLon);
    const estimatedPower = 2 * turbinePowerCurve(windSpeed);
    const shiftKm = turf.distance([site.lng, site.lat], [finalLon, finalLat], { units: 'kilometers' });

    return {
      ...site,
      lat: finalLat,
      lng: finalLon,
      windSpeed: Number(windSpeed.toFixed(2)),
      estimatedPowerMw: Number(estimatedPower.toFixed(2)),
      optimizationShiftKm: Number(shiftKm.toFixed(3)),
    };
  });

  const maxPower = Math.max(...optimized.map((site) => site.estimatedPowerMw || 0), 0);
  const minSpacingKm = rotorDiameterKm * 5;

  const spacingDistances = optimized.map((site, idx) => {
    let minDistance = Infinity;
    optimized.forEach((other, otherIdx) => {
      if (idx === otherIdx) return;
      const distance = turf.distance([site.lng, site.lat], [other.lng, other.lat], { units: 'kilometers' });
      if (distance < minDistance) {
        minDistance = distance;
      }
    });
    return Number.isFinite(minDistance) ? minDistance : minSpacingKm;
  });

  return optimized.map((site, idx) => {
    const powerRatio = maxPower ? site.estimatedPowerMw / maxPower : 0;
    const spacingRatio = Math.min(spacingDistances[idx] / minSpacingKm, 1);
    const composite = 0.65 * powerRatio + 0.35 * spacingRatio;

    return {
      ...site,
      score: Number(composite.toFixed(3)),
      minSpacingKm: Number(spacingDistances[idx].toFixed(3)),
    };
  });
};

const DrawingManager = ({ selectionMode, onAreaChange, featureGroupRef }) => {
  const map = useMap();
  const drawControlRef = useRef(null);

  useEffect(() => {
    if (!map || !featureGroupRef.current) {
      return undefined;
    }

    const featureGroup = featureGroupRef.current;

    const handleCreated = (event) => {
      featureGroup.clearLayers();
      featureGroup.addLayer(event.layer);
      onAreaChange(event.layer.toGeoJSON());
    };

    const handleEdited = (event) => {
      let latest = null;
      event.layers.eachLayer((layer) => {
        latest = layer.toGeoJSON();
      });
      if (latest) {
        onAreaChange(latest);
      }
    };

    const handleDeleted = () => {
      featureGroup.clearLayers();
      onAreaChange(null);
    };

    if (drawControlRef.current) {
      map.removeControl(drawControlRef.current);
      drawControlRef.current = null;
    }

    map.off(L.Draw.Event.CREATED, handleCreated);
    map.off(L.Draw.Event.EDITED, handleEdited);
    map.off(L.Draw.Event.DELETED, handleDeleted);

    if (selectionMode === 'draw') {
      drawControlRef.current = new L.Control.Draw({
        position: 'topright',
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: true,
            shapeOptions: {
              color: '#38bdf8',
              weight: 2,
              opacity: 0.9,
              fillOpacity: 0.12,
            },
          },
          rectangle: false,
          circle: false,
          circlemarker: false,
          marker: false,
          polyline: false,
        },
        edit: {
          featureGroup,
          remove: true,
        },
      });
      map.addControl(drawControlRef.current);
      map.on(L.Draw.Event.CREATED, handleCreated);
      map.on(L.Draw.Event.EDITED, handleEdited);
      map.on(L.Draw.Event.DELETED, handleDeleted);
    } else {
      featureGroup.clearLayers();
    }

    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated);
      map.off(L.Draw.Event.EDITED, handleEdited);
      map.off(L.Draw.Event.DELETED, handleDeleted);
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current);
        drawControlRef.current = null;
      }
    };
  }, [map, selectionMode, onAreaChange, featureGroupRef]);

  return null;
};

function MapViewer({
  onLocationSelect,
  selectedLocation,
  locationName,
  onLayoutGenerated,
  onToggleDetails,
  detailsCollapsed,
  onBackToMap,
}) {
  const [markerPosition, setMarkerPosition] = useState(selectedLocation);
  const [searchQuery, setSearchQuery] = useState('');
  const [map, setMap] = useState(null);
  const [selectionMode, setSelectionMode] = useState('radius');
  const [manualArea, setManualArea] = useState(null);
  const [drawnArea, setDrawnArea] = useState(null);
  const [radiusKm, setRadiusKm] = useState(15);
  const [windmillCount, setWindmillCount] = useState(20);
  const [windmillSites, setWindmillSites] = useState([]);
  const [placementNote, setPlacementNote] = useState('');
  const [areaSummary, setAreaSummary] = useState(null);
  const [windSurface, setWindSurface] = useState(null);
  const [windLoading, setWindLoading] = useState(false);
  const [windError, setWindError] = useState(null);
  const [calculatingLayout, setCalculatingLayout] = useState(false);
  const [interactionMode, setInteractionMode] = useState('quick');
  const featureGroupRef = useRef(null);

  const isLayoutMode = interactionMode === 'layout';

  const fetchWindField = useCallback(
    async (areaFeature) => {
      if (!areaFeature) {
        return null;
      }

      const [minLon, minLat, maxLon, maxLat] = turf.bbox(areaFeature);

      setWindLoading(true);
      try {
        const { data } = await axios.post(WIND_GRID_ENDPOINT, {
          min_lat: Number(minLat.toFixed(6)),
          max_lat: Number(maxLat.toFixed(6)),
          min_lon: Number(minLon.toFixed(6)),
          max_lon: Number(maxLon.toFixed(6)),
          rows: WIND_GRID_RESOLUTION.rows,
          cols: WIND_GRID_RESOLUTION.cols,
        });
        setWindSurface(data);
        setWindError(null);
        return data;
      } catch (error) {
        console.error('Error fetching wind grid', error);
        setWindSurface(null);
        setWindError('Live wind field unavailable; falling back to geometric heuristics.');
        return null;
      } finally {
        setWindLoading(false);
      }
    },
    [],
  );

  // Custom icon for windmills to differentiate them
  const windmillIcon = useMemo(
    () =>
      L.divIcon({
        className: 'windmill-div-icon',
        html: `
          <div class="windmill-icon" aria-hidden="true">
            <div class="windmill-icon__halo"></div>
            <svg viewBox="0 0 48 48" class="windmill-icon__svg" role="presentation">
              <defs>
                <linearGradient id="windmillBladeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#1e1b1bff" stop-opacity="0.95" />
                  <stop offset="100%" stop-color="#118de0ff" stop-opacity="0.9" />
                </linearGradient>
                <linearGradient id="windmillTowerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#f8fafc" />
                  <stop offset="100%" stop-color="#cbd5f5" />
                </linearGradient>
              </defs>
              <circle cx="24" cy="16" r="4.2" class="windmill-icon__hub"></circle>
              <path d="M24 16 L40 10 L30 0 Z" class="windmill-icon__blade" />
              <path d="M24 16 L15 -1 L10 17 Z" class="windmill-icon__blade" />
              <path d="M24 16 L4 24 L21 26 Z" class="windmill-icon__blade" />
              <line x1="24" y1="20" x2="24" y2="38" class="windmill-icon__tower"></line>
              <path d="M20 38 L28 38 L30 44 L18 44 Z" class="windmill-icon__nacelle"></path>
            </svg>
            <div class="windmill-icon__base"></div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 36],
      }),
    [],
  );

  const focusIcon = useMemo(
    () =>
      L.divIcon({
        className: 'focus-div-icon',
        html: '<div class="focus-pin"><span class="focus-pin__pulse"></span></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 18],
      }),
    [],
  );

  useEffect(() => {
    if (selectedLocation) {
      setMarkerPosition(selectedLocation);
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (!map || !markerPosition) return;
    map.flyTo(markerPosition, Math.max(map.getZoom(), 12));
  }, [map, markerPosition]);

  const handleSearch = async () => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;
    try {
      const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          format: 'json',
          q: trimmedQuery,
          addressdetails: 1,
          limit: 5,
          email: NOMINATIM_EMAIL,
        },
      });
      if (Array.isArray(data) && data.length > 0) {
        const { lat, lon } = data[0];
        const latlng = { lat: Number.parseFloat(lat), lng: Number.parseFloat(lon) };
        onLocationSelect(latlng.lat, latlng.lng);
        setMarkerPosition(latlng);
        if (map) {
          map.flyTo(latlng, Math.max(map.getZoom(), 12));
        }
        setInteractionMode('layout');
        setSelectionMode('radius');
        setManualArea(null);
        setDrawnArea(null);
        setWindmillSites([]);
        setPlacementNote('');
        setSearchQuery('');
      } else {
        console.warn('No results found for query:', trimmedQuery);
      }
    } catch (error) {
      console.error('Error during geocoding search:', error);
    }
  };

  const handleManualAreaChange = useCallback(
    (geoJSON) => {
      setManualArea(geoJSON);
      if (selectionMode === 'draw') {
        setDrawnArea(geoJSON);
      }
    },
    [selectionMode],
  );

  const ensureFeature = (geometry) => (geometry?.type === 'Feature' ? geometry : { type: 'Feature', geometry });

  useEffect(() => {
    if (!isLayoutMode) {
      setDrawnArea(null);
      return;
    }

    if (selectionMode === 'radius') {
      if (markerPosition && radiusKm > 0) {
        // Force re-render by creating a new circle object every time
        const circle = turf.circle([markerPosition.lng, markerPosition.lat], radiusKm, {
          steps: 96,
          units: 'kilometers',
        });
        // Add timestamp to force React to recognize it as a new object
        circle.properties = { ...circle.properties, generatedAt: Date.now() };
        setDrawnArea(circle);
      } else {
        setDrawnArea(null);
      }
    } else {
      setDrawnArea(manualArea);
    }
  }, [selectionMode, markerPosition, radiusKm, manualArea, isLayoutMode]);

  useEffect(() => {
    if (!featureGroupRef.current) return;
    if (!isLayoutMode) {
      featureGroupRef.current.clearLayers();
      return;
    }
    if (selectionMode === 'radius') {
      featureGroupRef.current.clearLayers();
    } else if (!featureGroupRef.current.getLayers().length && manualArea) {
      const manualLayer = L.geoJSON(manualArea);
      manualLayer.eachLayer((layer) => featureGroupRef.current.addLayer(layer));
    }
  }, [selectionMode, manualArea, isLayoutMode]);

  useEffect(() => {
    setWindmillSites([]);
    setPlacementNote('');
    setWindSurface(null);
    setWindError(null);
  }, [drawnArea]);

  useEffect(() => {
    if (!isLayoutMode) {
      setManualArea(null);
      setDrawnArea(null);
      setSelectionMode('radius');
      setWindmillCount(20);
    }
  }, [isLayoutMode]);

  useEffect(() => {
    if (isLayoutMode && !markerPosition && map) {
      const center = map.getCenter();
      setMarkerPosition(center);
    }
  }, [isLayoutMode, markerPosition, map]);

  useEffect(() => {
    if (!drawnArea) {
      setAreaSummary(null);
      return;
    }
    const feature = ensureFeature(drawnArea);
    const areaSqKm = turf.area(feature) / 1_000_000;
    const perimeterKm = turf.length(turf.polygonToLine(feature), { units: 'kilometers' });
    setAreaSummary({
      areaSqKm: Number(areaSqKm.toFixed(2)),
      perimeterKm: Number(perimeterKm.toFixed(2)),
    });
  }, [drawnArea]);

  useEffect(() => {
    if (!isLayoutMode) return;
    if (map && drawnArea) {
      const bounds = L.geoJSON(drawnArea).getBounds();
      if (bounds.isValid()) {
        map.flyToBounds(bounds.pad(0.15));
      }
    }
  }, [map, drawnArea, isLayoutMode]);

  useEffect(() => {
    if (!onLayoutGenerated) return;
    if (!isLayoutMode) {
      onLayoutGenerated(null);
      return;
    }
    onLayoutGenerated({
      placements: windmillSites,
      area: drawnArea,
      selectionMode,
      radiusKm,
      stats: areaSummary,
      note: placementNote,
    });
  }, [
    windmillSites,
    drawnArea,
    selectionMode,
    radiusKm,
    areaSummary,
    placementNote,
    onLayoutGenerated,
    isLayoutMode,
  ]);

  const handleCalculatePlacement = useCallback(
    async (countOverride) => {
      const targetCount = Number.isFinite(countOverride) ? countOverride : windmillCount;
      if (!drawnArea || targetCount <= 0) {
        alert('Please define an area and specify a valid number of windmills.');
        return;
      }

      setCalculatingLayout(true);
      setPlacementNote('Initializing layout calculation...');
      setWindmillSites([]);

      const areaFeature = ensureFeature(drawnArea);

      let surface = windSurface;
      if (!surface) {
        setPlacementNote('Fetching live 100 m wind field and checking for obstacles...');
        surface = await fetchWindField(areaFeature);
      }

      const bbox = turf.bbox(areaFeature);
      const areaSqMeters = turf.area(areaFeature);
      
      // Adaptive grid spacing: balance precision with performance
      // Small areas (<5 km²): 50m, Medium (5-20 km²): 100m, Large (>20 km²): 150m
      const areaSqKm = areaSqMeters / 1_000_000;
      let spacingKm;
      if (areaSqKm < 5) {
        spacingKm = 0.05; // 50m for small areas
      } else if (areaSqKm < 20) {
        spacingKm = 0.1; // 100m for medium areas
      } else {
        spacingKm = 0.15; // 150m for large areas
      }
      
      const grid = turf.pointGrid(bbox, spacingKm, { units: 'kilometers' });
      let candidates = grid.features.filter((pt) => turf.booleanPointInPolygon(pt, areaFeature));

      if (!candidates.length) {
        alert('No candidate locations found. Try enlarging the area or reducing the count.');
        return;
      }
      
      // Limit candidates to prevent browser freeze on very large areas
      const MAX_CANDIDATES = 5000;
      if (candidates.length > MAX_CANDIDATES) {
        console.warn(`Limiting ${candidates.length} candidates to ${MAX_CANDIDATES} for performance`);
        // Sample evenly across the grid
        const step = Math.ceil(candidates.length / MAX_CANDIDATES);
        candidates = candidates.filter((_, idx) => idx % step === 0);
      }
      
      console.log(`Processing ${candidates.length} candidate locations (spacing: ${(spacingKm * 1000).toFixed(0)}m)`);

      // Fetch buildings/roads from Overpass API to avoid obstacles
      // Only fetch obstacles for areas smaller than 50 km² to avoid timeouts
      const [minLon, minLat, maxLon, maxLat] = bbox;
      let obstacles = [];
      const shouldFetchObstacles = areaSqKm < 50;
      
      if (shouldFetchObstacles) {
        setPlacementNote(`Checking for buildings and roads in ${areaSqKm.toFixed(1)} km² area...`);
        try {
          const overpassQuery = `
            [out:json][timeout:25];
            (
              way["building"](${minLat},${minLon},${maxLat},${maxLon});
              way["highway"~"^(motorway|trunk|primary|secondary)$"](${minLat},${minLon},${maxLat},${maxLon});
              way["landuse"="residential"](${minLat},${minLon},${maxLat},${maxLon});
            );
            out geom;
          `;
          const { data } = await axios.post(
            'https://overpass-api.de/api/interpreter',
            overpassQuery,
            { headers: { 'Content-Type': 'text/plain' }, timeout: 30000 }
          );
          
          obstacles = data.elements
            .filter((el) => el.geometry)
            .map((el) => {
              const coords = el.geometry.map((node) => [node.lon, node.lat]);
              if (coords.length > 2 && coords[0][0] === coords[coords.length - 1][0]) {
                return turf.polygon([coords]);
              }
              return turf.lineString(coords);
            });
          
          setPlacementNote(`Found ${obstacles.length} obstacles to avoid. Calculating optimal positions...`);
        } catch (error) {
          console.warn('Could not fetch obstacle data, proceeding without obstacle avoidance:', error);
          setPlacementNote('Obstacle detection skipped (area too large). Calculating optimal positions...');
        }
      } else {
        setPlacementNote('Skipping obstacle detection (area >50 km²). Calculating optimal positions...');
      }

      const centroid = turf.centroid(areaFeature);
      const boundaryLine = turf.polygonToLine(areaFeature);

      let geometryMeta = null;
      let surfaceSampler = null;
      if (surface) {
        geometryMeta = buildGeometryMeta(surface);
        surfaceSampler = buildWindSampler(surface, geometryMeta);
      }

      // Filter out candidates near obstacles (100m buffer) - only if we fetched obstacles
      let safeCandidates = candidates;
      if (obstacles.length > 0) {
        const safeMinDistance = 0.1; // 100 meters in km
        safeCandidates = candidates.filter((pt) => {
          return obstacles.every((obstacle) => {
            try {
              const dist = obstacle.geometry.type === 'Polygon'
                ? turf.pointToLineDistance(pt, turf.polygonToLine(obstacle), { units: 'kilometers' })
                : turf.pointToLineDistance(pt, obstacle, { units: 'kilometers' });
              return dist >= safeMinDistance;
            } catch {
              return true;
            }
          });
        });

        if (!safeCandidates.length) {
          alert('No safe locations found after avoiding buildings and roads. Try a different area.');
          return;
        }
        
        console.log(`Filtered ${candidates.length - safeCandidates.length} candidates near obstacles`);
      }

      const metrics = safeCandidates.map((pt, idx) => {
        const edgeDistance = turf.pointToLineDistance(pt, boundaryLine, { units: 'kilometers' });
        const centroidDistance = turf.distance(pt, centroid, { units: 'kilometers' });
        const lat = pt.geometry.coordinates[1];
        const lon = pt.geometry.coordinates[0];
        const windSpeed = surfaceSampler ? surfaceSampler.byLatLng(lat, lon) : null;
        const estimatedPower = windSpeed !== null ? 2 * turbinePowerCurve(windSpeed) : null;
        
        // Calculate capacity factor (higher wind = higher CF)
        const capacityFactor = windSpeed ? Math.min((windSpeed / 12) * 0.45, 0.50) : 0.25;
        
        return {
          id: idx,
          point: pt,
          edgeDistance,
          centroidDistance,
          windSpeed,
          estimatedPower,
          capacityFactor,
        };
      });

      const maxEdgeDistance = metrics.reduce((max, { edgeDistance }) => Math.max(max, edgeDistance), 0) || 1;
      const maxCentroidDistance = metrics.reduce((max, { centroidDistance }) => Math.max(max, centroidDistance), 0) || 1;
      const maxPower = metrics.reduce(
        (max, { estimatedPower }) => (estimatedPower !== null ? Math.max(max, estimatedPower) : max),
        0,
      ) || 1;
      const maxCF = metrics.reduce((max, { capacityFactor }) => Math.max(max, capacityFactor), 0) || 1;

      const selected = [];
      let remaining = [...metrics];
      const minSpacingKm = 0.4; // 400m minimum turbine spacing (IEC standard)
      
      // Progress tracking for large calculations
      const totalSteps = targetCount;
      let completedSteps = 0;

      while (selected.length < targetCount && remaining.length) {
        // Update progress for user feedback
        if (completedSteps % 5 === 0 || completedSteps === 0) {
          setPlacementNote(`Optimizing layout: ${completedSteps}/${totalSteps} turbines placed...`);
        }
        
        let maxSpacing = 0;
        const withSpacing = remaining.map((candidate) => {
          if (!selected.length) {
            return { ...candidate, spacing: Infinity };
          }
          const spacing = selected.reduce((min, chosen) => {
            const distance = turf.distance(candidate.point, chosen.point, { units: 'kilometers' });
            return Math.min(min, distance);
          }, Infinity);
          if (spacing !== Infinity) {
            maxSpacing = Math.max(maxSpacing, spacing);
          }
          return { ...candidate, spacing };
        });

        // Filter candidates that are too close to already selected sites
        const validCandidates = withSpacing.filter(
          (c) => !selected.length || c.spacing >= minSpacingKm
        );

        if (!validCandidates.length) break;
        
        completedSteps++;

        const ranked = validCandidates.map((candidate) => {
          const edgeScore = Math.min(candidate.edgeDistance / maxEdgeDistance, 1);
          const centralityScore = 1 - Math.min(candidate.centroidDistance / maxCentroidDistance, 1);
          const spacingScore = !selected.length
            ? 1
            : maxSpacing
              ? Math.min(candidate.spacing / maxSpacing, 1)
              : 0;
          const windScore = candidate.estimatedPower !== null ? Math.min(candidate.estimatedPower / maxPower, 1) : 0.5;
          const cfScore = Math.min(candidate.capacityFactor / maxCF, 1);
          
          // Prioritize capacity factor (50%) and wind speed (30%), then spacing and location
          const compositeScore = 
            cfScore * 0.5 + 
            windScore * 0.3 + 
            spacingScore * 0.15 + 
            edgeScore * 0.03 + 
            centralityScore * 0.02;
          
          return {
            ...candidate,
            edgeScore,
            centralityScore,
            spacingScore,
            windScore,
            cfScore,
            compositeScore,
          };
        });

        ranked.sort((a, b) => b.compositeScore - a.compositeScore);
        const best = ranked[0];
        selected.push(best);
        remaining = remaining.filter((candidate) => candidate.id !== best.id);
      }

      let siteList = selected.map((site, index) => ({
        id: `${site.id}-${index}`,
        lat: site.point.geometry.coordinates[1],
        lng: site.point.geometry.coordinates[0],
        edgeScore: Number(site.edgeScore?.toFixed(3) ?? 0),
        centralityScore: Number(site.centralityScore?.toFixed(3) ?? 0),
        spacingScore: Number(site.spacingScore?.toFixed(3) ?? 0),
        windScore: site.windScore !== undefined ? Number(site.windScore.toFixed(3)) : null,
        capacityFactor: site.capacityFactor !== undefined ? Number((site.capacityFactor * 100).toFixed(1)) : null,
        windSpeed: site.windSpeed !== null ? Number(site.windSpeed.toFixed(1)) : null,
        compositeScore: Number(site.compositeScore.toFixed(3)),
        rank: index + 1,
      }));

      if (surface && geometryMeta) {
        siteList = optimizeLayoutWithWind(siteList, surface, areaFeature)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .map((site, index) => ({ ...site, rank: index + 1 }));
      } else {
        siteList = siteList.map((site, index) => ({
          ...site,
          score: site.compositeScore,
          rank: index + 1,
        }));
      }

      setWindmillSites(siteList);

      const noteParts = [];
      if (surface) {
        const fetchedAt = surface.meta?.fetched_at;
        if (fetchedAt) {
          noteParts.push(`Live 100 m wind field sampled ${new Date(fetchedAt).toUTCString()}.`);
        } else {
          noteParts.push('Live 100 m wind field optimization applied.');
        }
      } else if (windError) {
        noteParts.push(windError);
      }
      if (siteList.length < targetCount) {
        noteParts.push(`Only ${siteList.length} optimal site${siteList.length === 1 ? '' : 's'} fit within the selected area.`);
      }
      if (obstacles.length > 0) {
        noteParts.push(`Avoided ${obstacles.length} obstacles.`);
      }
      setPlacementNote(noteParts.join(' '));
      setCalculatingLayout(false);
    },
    [drawnArea, fetchWindField, windSurface, windmillCount, windError],
  );

  const handleExportLayout = () => {
    if (!windmillSites.length) {
      alert('Generate a layout before exporting.');
      return;
    }

    const featureCollection = {
      type: 'FeatureCollection',
      features: windmillSites.map((site) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [site.lng, site.lat],
        },
        properties: {
          rank: site.rank,
          score: site.score,
          edgeScore: site.edgeScore,
          centralityScore: site.centralityScore,
          spacingScore: site.spacingScore,
        },
      })),
    };

    const blob = new Blob([JSON.stringify(featureCollection, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `wind_layout_${Date.now()}.geojson`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleAutoTopTwenty = () => {
    setWindmillCount(20);
    void handleCalculatePlacement(20);
  };

  const handleInteractionModeChange = (_event, mode) => {
    if (!mode) return;
    setInteractionMode(mode);
  };

  function MapEvents() {
    const mapInstance = useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        onLocationSelect(lat, lng);
        setMarkerPosition(e.latlng);
        mapInstance.flyTo(e.latlng, mapInstance.getZoom());
      },
    });
    return null;
  }

  return (
    <Stack spacing={2.5} sx={{ width: '100%' }}>
      <Paper
        className="surface-panel"
        elevation={4}
        sx={{
          width: '100%',
          px: { xs: 1.8, sm: 2.2 },
          py: { xs: 1.6, sm: 2 },
          color: '#f8fafc',
          borderRadius: '20px',
        }}
      >
        <Stack spacing={1.8} useFlexGap>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
            flexWrap="wrap"
            useFlexGap
          >
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
              {!!windmillSites.length && (
                <Button
                  variant="outlined"
                  color="inherit"
                  size="small"
                  startIcon={<ArrowBackIcon fontSize="small" />}
                  onClick={() => {
                    if (onBackToMap) {
                      onBackToMap();
                      return;
                    }
                    setInteractionMode('quick');
                    setWindmillSites([]);
                    setPlacementNote('');
                    setDrawnArea(null);
                    setManualArea(null);
                    setSelectionMode('radius');
                    if (featureGroupRef.current) {
                      featureGroupRef.current.clearLayers();
                    }
                  }}
                  sx={{
                    borderColor: 'rgba(255,255,255,0.24)',
                    color: '#f8fafc',
                    backgroundColor: 'rgba(15, 23, 42, 0.64)',
                    '&:hover': {
                      backgroundColor: 'rgba(15, 23, 42, 0.82)',
                    },
                  }}
                >
                  Back to Map
                </Button>
              )}
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {locationName || 'Select a study site'}
              </Typography>
              {selectedLocation && (
                <Chip
                  label={`${selectedLocation.lat.toFixed(3)}, ${selectedLocation.lng.toFixed(3)}`}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(148, 163, 184, 0.18)',
                    color: 'rgba(226, 232, 240, 0.9)',
                  }}
                />
              )}
              {areaSummary && (
                <Chip
                  label={`Area ${areaSummary.areaSqKm} km² · Edge ${areaSummary.perimeterKm} km`}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(59, 130, 246, 0.22)',
                    color: '#bae6fd',
                  }}
                />
              )}
              {windSurface && (
                <Chip
                  label={`Wind ${Number.isFinite(windSurface.stats?.avg_speed) ? windSurface.stats.avg_speed.toFixed(1) : '—'} m/s @100m`}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(14, 165, 233, 0.2)',
                    color: '#bae6fd',
                  }}
                />
              )}
              {windError && !windSurface && (
                <Chip
                  label="Wind API offline"
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(248, 113, 113, 0.18)',
                    color: '#fecaca',
                  }}
                />
              )}
              {!!windmillSites.length && (
                <Chip
                  label={`${windmillSites.length} placements`}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    color: '#86efac',
                  }}
                />
              )}
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <ToggleButtonGroup
                value={interactionMode}
                exclusive
                onChange={handleInteractionModeChange}
                size="small"
                color="primary"
              >
                <ToggleButton value="quick">Quick Analyze</ToggleButton>
                <ToggleButton value="layout">Layout Planner</ToggleButton>
              </ToggleButtonGroup>
              <MuiTooltip title="Download GeoJSON layout">
                <span>
                  <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    startIcon={<CloudUploadIcon fontSize="small" />}
                    onClick={handleExportLayout}
                    disabled={!isLayoutMode || !windmillSites.length}
                    sx={{
                      borderColor: 'rgba(255,255,255,0.24)',
                      color: '#f8fafc',
                    }}
                  >
                    Export Layout
                  </Button>
                </span>
              </MuiTooltip>
              {onToggleDetails && (
                <MuiTooltip title={detailsCollapsed ? 'Show insight panels' : 'Hide insight panels'}>
                  <span>
                    <Button
                      variant="outlined"
                      color="inherit"
                      size="small"
                      startIcon={<ViewSidebarIcon fontSize="small" />}
                      onClick={() => onToggleDetails()}
                      sx={{
                        borderColor: 'rgba(255,255,255,0.24)',
                        color: '#f8fafc',
                      }}
                    >
                      {detailsCollapsed ? 'Show Panels' : 'Hide Panels'}
                    </Button>
                  </span>
                </MuiTooltip>
              )}
            </Stack>
          </Stack>

          <Divider className="surface-divider" />

          <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
            <TextField
              placeholder="Search by place or coordinates"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSearch();
                }
              }}
              size="small"
              sx={{
                minWidth: { xs: '100%', sm: 320 },
                flexGrow: 1,
                '& .MuiOutlinedInput-root': {
                  borderRadius: '999px',
                  paddingRight: 0.5,
                  background: 'rgba(15, 23, 42, 0.82)',
                  border: '1px solid rgba(148, 163, 184, 0.28)',
                  boxShadow: '0 14px 28px rgba(8, 47, 73, 0.32)',
                  '& fieldset': { border: 'none' },
                  '&:hover': {
                    boxShadow: '0 18px 34px rgba(8, 47, 73, 0.4)',
                  },
                  '&.Mui-focused': {
                    boxShadow: '0 22px 40px rgba(8, 47, 73, 0.48)',
                    borderColor: 'rgba(94, 234, 212, 0.45)',
                  },
                },
                '& .MuiOutlinedInput-input': {
                  padding: '10px 12px',
                  color: '#f8fafc',
                  fontWeight: 500,
                  letterSpacing: '0.01em',
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PlaceIcon fontSize="small" sx={{ color: 'rgba(226, 232, 240, 0.76)' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="search"
                      size="small"
                      onClick={handleSearch}
                      sx={{
                        backgroundColor: 'rgba(30, 41, 59, 0.82)',
                        color: '#38bdf8',
                        '&:hover': {
                          backgroundColor: 'rgba(30, 41, 59, 0.95)',
                        },
                      }}
                    >
                      <SearchIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {isLayoutMode ? (
              <>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    gap: 1.5,
                    flexWrap: 'wrap',
                    width: '100%',
                  }}
                >
                  <Typography variant="body2" sx={{ opacity: 0.85, fontWeight: 600 }}>
                    Smart Radius · click the map to reposition the center point.
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.6, minWidth: { xs: '100%', sm: 280 } }}>
                    <Typography variant="body2" sx={{ opacity: 0.85, fontWeight: 600, minWidth: 90 }}>
                      Radius {radiusKm} km
                    </Typography>
                    <Slider
                      value={radiusKm}
                      min={1}
                      max={50}
                      step={0.5}
                      marks={[
                        { value: 1, label: '1km' },
                        { value: 15, label: '15km' },
                        { value: 50, label: '50km' },
                      ]}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => `${value} km`}
                      disabled={!markerPosition}
                      onChange={(_event, value) => {
                        if (Array.isArray(value)) return;
                        setRadiusKm(value);
                      }}
                      sx={{
                        width: { xs: '100%', sm: 200 },
                        maxWidth: 240,
                        '& .MuiSlider-thumb': {
                          backgroundColor: '#38bdf8',
                        },
                        '& .MuiSlider-track': {
                          backgroundColor: '#38bdf8',
                        },
                        '& .MuiSlider-rail': {
                          opacity: 0.3,
                        },
                      }}
                    />
                  </Box>
                  {!markerPosition && (
                    <Typography variant="caption" sx={{ color: 'rgba(226, 232, 240, 0.7)' }}>
                      Tip: search for a location or click the map to anchor the radius.
                    </Typography>
                  )}
                </Box>
                <TextField
                  label="Windmills"
                  type="number"
                  variant="outlined"
                  size="small"
                  value={windmillCount}
                  onChange={(e) => setWindmillCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  sx={{
                    width: 120,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '999px',
                      background: 'rgba(15, 23, 42, 0.6)',
                      '& fieldset': { borderColor: 'rgba(148, 163, 184, 0.2)' },
                    },
                    '& .MuiOutlinedInput-input': {
                      padding: '10px 16px',
                    },
                  }}
                  InputProps={{ inputProps: { min: 1, max: 120 } }}
                />
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    onClick={() => {
                      void handleCalculatePlacement();
                    }}
                    disabled={!drawnArea || windLoading || calculatingLayout}
                    startIcon={calculatingLayout ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <PlaceIcon fontSize="small" />}
                  >
                    {calculatingLayout ? 'Calculating...' : windLoading ? 'Optimizing...' : 'Calculate Layout'}
                  </Button>
                  <Button
                    variant="outlined"
                    color="inherit"
                    startIcon={<AutoAwesomeIcon fontSize="small" />}
                    onClick={handleAutoTopTwenty}
                    disabled={!drawnArea || windLoading || calculatingLayout}
                    sx={{ borderColor: 'rgba(255,255,255,0.24)', color: '#f8fafc' }}
                  >
                    Best 20
                  </Button>
                </Stack>
              </>
            ) : (
              <Typography variant="body2" sx={{ opacity: 0.75 }}>
                Tap anywhere on the map to instantly analyze location suitability, grid distance, and recommended turbines.
                Switch to Layout Planner to design multi-turbine placements.
              </Typography>
            )}
          </Stack>
        </Stack>
      </Paper>

      <Box sx={{ position: 'relative', width: '100%' }}>
        <MapContainer
          center={[11.1271, 78.6569]} // Centered on Tamil Nadu, India
          zoom={7}
          style={{ height: 'min(60vh, 640px)', minHeight: 360, width: '100%', borderRadius: '24px', overflow: 'hidden' }}
          zoomControl={false}
          whenCreated={setMap}
        >
          <ZoomControl position="bottomright" />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          {isLayoutMode && (
            <>
              <FeatureGroup ref={featureGroupRef} />
              <DrawingManager
                selectionMode={selectionMode}
                onAreaChange={handleManualAreaChange}
                featureGroupRef={featureGroupRef}
              />
            </>
          )}
          <MapEvents />
          {markerPosition && <Marker position={markerPosition} icon={focusIcon} />}
          {isLayoutMode && selectionMode === 'radius' && drawnArea && (
            <GeoJSON
              key={drawnArea.properties?.generatedAt || Date.now()}
              data={drawnArea}
              style={{ color: '#00c6ff', weight: 2, opacity: 0.8, fillOpacity: 0.1 }}
            />
          )}
          {windmillSites.map((site) => (
            <Marker key={site.id} position={[site.lat, site.lng]} icon={windmillIcon}>
              <Tooltip direction="top" offset={[0, -28]} permanent className="windmill-tooltip">
                #{site.rank}
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </Box>

      {isLayoutMode && !!windmillSites.length && (
        <Paper
          className="surface-panel"
          elevation={4}
          sx={{
            width: '100%',
            borderRadius: '20px',
            px: { xs: 1.8, sm: 2.4 },
            py: { xs: 1.4, sm: 1.8 },
            display: 'flex',
            flexDirection: 'column',
            gap: 1.2,
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {windmillSites.length} optimal site{windmillSites.length > 1 ? 's' : ''}
          </Typography>
          <Stack spacing={0.75}>
            {windmillSites.slice(0, 5).map((site) => (
              <Box key={site.id} sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 2 }}>
                <span style={{ fontWeight: 600 }}>#{site.rank}</span>
                <span style={{ flex: 1, textAlign: 'right' }}>
                  {site.windSpeed ? `${site.windSpeed} m/s` : '—'}
                  {site.capacityFactor ? ` · CF ${site.capacityFactor}%` : ''}
                  {' · Score '}
                  {site.score !== undefined && site.score !== null
                    ? site.score.toFixed(3)
                    : site.compositeScore !== undefined && site.compositeScore !== null
                      ? site.compositeScore.toFixed(3)
                      : '—'}
                </span>
              </Box>
            ))}
            {windmillSites.length > 5 && (
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                +{windmillSites.length - 5} more placements pinned on map
              </Typography>
            )}
            {placementNote && (
              <Typography variant="caption" sx={{ pt: 0.5, color: 'rgba(148, 163, 184, 0.9)' }}>
                {placementNote}
              </Typography>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

export default MapViewer;