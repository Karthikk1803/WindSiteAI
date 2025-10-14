import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Grid,
  Snackbar,
  Stack,
} from '@mui/material';
import axios from 'axios';

import MapViewer from '../components/MapViewer';
import Sidebar from '../components/Sidebar';
import LivePanel from '../components/LivePanel';
import ReportViewer from '../components/ReportViewer';
import ForecastPanel from '../components/ForecastPanel';
import TurbineCatalog from '../components/TurbineCatalog';
import InsightDeck from '../components/InsightDeck';
import ChatAssistant from '../components/ChatAssistant';

const NOMINATIM_HEADERS = {
  'User-Agent': 'WindSite.AI Mini/1.0 (contact: windsite.ai-demo@example.com)',
};

const fetchLocationProfile = async (lat, lng) => {
  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        format: 'jsonv2',
        lat,
        lon: lng,
        addressdetails: 1,
        extratags: 1,
      },
      headers: NOMINATIM_HEADERS,
    });

    const address = data.address || {};
    const label =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      data.display_name;
    const timezone = data.extratags?.timezone || null;
    const localTime = timezone
      ? new Intl.DateTimeFormat('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: timezone,
        }).format(new Date())
      : null;

    return {
      label,
      fullAddress: data.display_name,
      country: address.country,
      region: address.state || address.region || address.county,
      timezone,
      localTime,
      population: data.extratags?.population,
      elevation: data.extratags?.ele ? Number(data.extratags.ele) : null,
      placeType: data.type,
    };
  } catch (error) {
    console.error('Error reverse geocoding location', error);
    return null;
  }
};

const deriveInsights = (report, layoutSummary, forecast) => {
  if (!report) return null;

  const capacityScore = Math.round((report.capacity_factor || 0) * 100);
  const confidence = report.confidence ?? 70;
  const payback = report.payback_years ?? 0;
  const gridDistance = report.grid_distance_km ?? 0;
  const layoutBonus = layoutSummary?.placements?.length
    ? Math.min(layoutSummary.placements.length * 1.2, 12)
    : 0;
  const forecastBoost = forecast?.summary?.avg_speed
    ? Math.min(forecast.summary.avg_speed * 4.5, 22)
    : 12;
  const gridBonus = Math.max(0, 18 - gridDistance * 1.2);

  const opportunityScore = Math.min(
    100,
    Math.round(capacityScore * 0.35 + confidence * 0.3 + gridBonus * 1.5 + forecastBoost * 0.15 + layoutBonus),
  );

  const narrative =
    opportunityScore > 80
      ? 'Utility-scale standout'
      : opportunityScore > 65
        ? 'Highly bankable opportunity'
        : opportunityScore > 50
          ? 'Viable with targeted optimization'
          : 'Needs refinement to reach viability';

  return {
    opportunityScore,
    narrative,
    annualGeneration: report.expected_generation_mwh,
    co2Offset: report.co2_offset_tons,
    paybackYears: report.payback_years,
    confidence,
    capacityScore,
  };
};

function Dashboard() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationMeta, setLocationMeta] = useState(null);
  const [windData, setWindData] = useState(null);
  const [siteReport, setSiteReport] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [turbineCatalogue, setTurbineCatalogue] = useState([]);
  const [layoutSummary, setLayoutSummary] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);

  const handleLayoutGenerated = useCallback((summary) => {
    setLayoutSummary(summary);
  }, []);

  const toggleDetailsPanel = useCallback(() => {
    setDetailsCollapsed((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!siteReport) return;
    setInsights(deriveInsights(siteReport, layoutSummary, forecast));
  }, [siteReport, layoutSummary, forecast]);

  const handleLocationSelect = async (lat, lng) => {
    setSelectedLocation({ lat, lng });
    setLoading(true);
    setError(null);
    setWindData(null);
    setSiteReport(null);
    setForecast(null);
    setTurbineCatalogue([]);
    setLayoutSummary(null);

    try {
      const [profile, analysis] = await Promise.all([
        fetchLocationProfile(lat, lng),
        axios.get('http://localhost:8000/analyze', { params: { lat, lon: lng } }),
      ]);

      setLocationMeta(profile);

      const payload = analysis.data;
      setSiteReport(payload.site_report);
      if (payload.site_report?.suitability === 'Not Suitable - Water Body') {
        setWindData(null);
      } else {
        setWindData(payload.raw_data);
      }
      setForecast(payload.forecast ?? null);
      setTurbineCatalogue(payload.turbine_catalogue ?? []);
      setInsights(deriveInsights(payload.site_report, null, payload.forecast));
    } catch (fetchError) {
      console.error('Error fetching site intelligence:', fetchError);
      setError('Failed to fetch site intelligence. Please try again.');
      setLocationMeta(null);
      setWindData(null);
      setSiteReport(null);
      setForecast(null);
      setTurbineCatalogue([]);
      setInsights(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        bgcolor: 'rgba(2, 6, 23, 0.98)',
        background: 'radial-gradient(circle at top, rgba(30,58,138,0.32) 0%, rgba(2,6,23,0.95) 55%, rgba(2,6,23,1) 100%)',
        p: { xs: 2, md: 3 },
        boxSizing: 'border-box',
        overflowX: 'hidden',
        pb: { xs: 6, md: 8 },
      }}
    >
      <Grid container spacing={3} alignItems="stretch">
        {!detailsCollapsed && (
          <Grid
            item
            xs={12}
            lg={4}
            sx={{
              display: 'flex',
              position: { lg: 'sticky' },
              top: { xs: '16px', md: '24px' },
              alignSelf: 'flex-start',
              zIndex: 1,
            }}
          >
            <Stack
              spacing={3}
              className="glass-scroll"
              sx={{
                width: '100%',
                maxHeight: { lg: 'calc(100vh - 48px)' },
                overflowY: { lg: 'auto' },
              }}
            >
              <Sidebar
                selectedLocation={selectedLocation}
                loading={loading}
                locationMeta={locationMeta}
                insights={insights}
                layoutSummary={layoutSummary}
              />
              <InsightDeck insights={insights} siteReport={siteReport} layoutSummary={layoutSummary} />
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <ReportViewer siteReport={siteReport} forecast={forecast} />
              </Box>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <ChatAssistant
                  siteReport={siteReport}
                  insights={insights}
                  layoutSummary={layoutSummary}
                  windData={windData}
                  forecast={forecast}
                  locationMeta={locationMeta}
                />
              </Box>
            </Stack>
          </Grid>
        )}
        <Grid item xs={12} lg={detailsCollapsed ? 12 : 8} sx={{ display: 'flex' }}>
          <Stack
            spacing={3}
            className="glass-scroll"
            sx={{
              width: '100%',
              maxHeight: { lg: 'calc(100vh - 48px)' },
              overflowY: { lg: 'auto' },
              pr: { lg: 1.5 },
            }}
          >
            <Box sx={{ position: 'relative', width: '100%' }}>
              <MapViewer
                onLocationSelect={handleLocationSelect}
                selectedLocation={selectedLocation}
                locationName={locationMeta?.label}
                onLayoutGenerated={handleLayoutGenerated}
                onToggleDetails={toggleDetailsPanel}
                detailsCollapsed={detailsCollapsed}
              />
              {loading && (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'rgba(2, 6, 23, 0.48)',
                    backdropFilter: 'blur(4px)',
                    borderRadius: '24px',
                    zIndex: 1500,
                  }}
                >
                  <CircularProgress color="inherit" />
                </Box>
              )}
            </Box>
            <Grid container spacing={3} alignItems="stretch">
              <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
                <LivePanel windData={windData} siteReport={siteReport} />
              </Grid>
              <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
                <ForecastPanel forecast={forecast} />
              </Grid>
              <Grid item xs={12} sx={{ display: 'flex' }}>
                <TurbineCatalog catalogue={turbineCatalogue} highlightedModel={siteReport?.best_turbine} />
              </Grid>
            </Grid>
          </Stack>
        </Grid>
      </Grid>
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Dashboard;