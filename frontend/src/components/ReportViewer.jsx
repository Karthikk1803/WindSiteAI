import {
  Alert,
  Box,
  Chip,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import WindPowerIcon from '@mui/icons-material/WindPower';
import BoltIcon from '@mui/icons-material/Bolt';
import RouteIcon from '@mui/icons-material/Route';
import EnergySavingsLeafIcon from '@mui/icons-material/EnergySavingsLeaf';
import SavingsIcon from '@mui/icons-material/Savings';
import EqualizerIcon from '@mui/icons-material/Equalizer';
import ScienceIcon from '@mui/icons-material/Science';
import ShieldIcon from '@mui/icons-material/Shield';

const suitabilityPalette = {
  Excellent: { chip: 'rgba(34,197,94,0.22)', text: '#bbf7d0' },
  Good: { chip: 'rgba(14,165,233,0.22)', text: '#bae6fd' },
  Fair: { chip: 'rgba(251,191,36,0.22)', text: '#fef3c7' },
  Poor: { chip: 'rgba(248,113,113,0.22)', text: '#fecaca' },
};

function ReportViewer({ siteReport, forecast }) {
  if (!siteReport) {
    return (
      <Paper
        sx={{
          height: '100%',
          borderRadius: 3,
          bgcolor: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(148, 163, 184, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(226, 232, 240, 0.6)',
          textAlign: 'center',
          p: 3,
        }}
      >
        <Typography variant="body2">
          Select a footprint to generate an engineered feasibility brief.
        </Typography>
      </Paper>
    );
  }

  const {
    suitability,
    best_turbine: bestTurbine,
    capacity_factor: capacityFactor = 0,
    grid_distance_km: gridDistance = 0,
    expected_generation_mwh: expectedGeneration = 0,
    co2_offset_tons: co2Offset = 0,
    payback_years: paybackYears,
    terrain,
    noise_profile_db: noiseProfile = 0,
    recommended_layout: recommendedLayout,
    risk_flags: riskFlags = [],
    confidence,
  } = siteReport;

  const isWater = suitability === 'Not Suitable - Water Body';
  const palette = suitabilityPalette[suitability] || { chip: 'rgba(148, 163, 184, 0.22)', text: '#e2e8f0' };

  const metricCards = [
    {
      label: 'Capacity Factor',
  value: `${(capacityFactor * 100).toFixed(1)}%`,
      icon: <BoltIcon fontSize="small" />,
      caption: 'Net of wake losses',
    },
    {
      label: 'Grid Distance',
  value: `${gridDistance.toFixed(1)} km`,
      icon: <RouteIcon fontSize="small" />,
      caption: 'Nearest substation tap',
    },
    {
      label: 'Annual Generation',
  value: `${(expectedGeneration / 1000).toFixed(2)} GWh`,
      icon: <EnergySavingsLeafIcon fontSize="small" />,
      caption: 'At reference dispatch profile',
    },
    {
      label: 'CO₂ Offset',
  value: `${Math.round(co2Offset).toLocaleString()} t/yr`,
      icon: <ScienceIcon fontSize="small" />,
      caption: 'Assuming 0.82 t/MWh',
    },
    {
      label: 'Payback Horizon',
      value: paybackYears ? `${paybackYears.toFixed(1)} years` : 'N/A',
      icon: <SavingsIcon fontSize="small" />,
      caption: 'Inclusive of grid tie CAPEX',
    },
    {
      label: 'Analysis Confidence',
      value: `${confidence ?? 0}%`,
      icon: <ShieldIcon fontSize="small" />,
      caption: 'Model accuracy at P50',
    },
  ];

  const layout = recommendedLayout || {};
  const forecastSummary = forecast?.summary;

  return (
    <Paper
      sx={{
        height: '100%',
        borderRadius: 3,
        bgcolor: 'rgba(15, 23, 42, 0.82)',
        border: '1px solid rgba(148, 163, 184, 0.12)',
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: 3, borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Site Analysis Brief
          </Typography>
          <Chip
            label={suitability}
            sx={{ bgcolor: palette.chip, color: palette.text, fontWeight: 600 }}
            size="small"
          />
        </Stack>
        <Typography variant="body2" sx={{ opacity: 0.65, mt: 1.2 }}>
          {terrain}
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {isWater && (
          <Alert
            severity="warning"
            icon={<WarningIcon />}
            sx={{
              bgcolor: 'rgba(254, 240, 138, 0.1)',
              color: '#fef3c7',
              border: '1px solid rgba(250, 204, 21, 0.18)',
            }}
          >
            This footprint overlaps a water body. Relocate inland to unlock a viable wind layout.
          </Alert>
        )}

        <Stack spacing={2}>
          <Typography variant="subtitle2" sx={{ opacity: 0.68 }}>
            Recommended Turbine
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '14px',
                bgcolor: 'rgba(14, 165, 233, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#bae6fd',
              }}
            >
              <WindPowerIcon fontSize="small" />
            </Box>
            <Stack>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {bestTurbine}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.6 }}>
                Optimized for the detected wind class and wake environment.
              </Typography>
            </Stack>
          </Stack>
        </Stack>

        <Grid container spacing={2} columns={{ xs: 12, md: 12 }}>
          {metricCards.map((metric) => (
            <Grid item xs={6} md={4} key={metric.label}>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'rgba(30, 41, 59, 0.72)',
                  border: '1px solid rgba(148, 163, 184, 0.12)',
                  height: '100%',
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: '9px',
                        bgcolor: 'rgba(96, 165, 250, 0.18)',
                        color: '#bfdbfe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {metric.icon}
                    </Box>
                    <Typography variant="caption" sx={{ textTransform: 'uppercase', opacity: 0.6 }}>
                      {metric.label}
                    </Typography>
                  </Stack>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {metric.value}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    {metric.caption}
                  </Typography>
                </Stack>
              </Box>
            </Grid>
          ))}
        </Grid>

        {recommendedLayout && (
          <Stack spacing={1.5}>
            <Typography variant="subtitle2" sx={{ opacity: 0.68 }}>
              Layout Blueprint
            </Typography>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(134, 239, 172, 0.22)',
                color: '#dcfce7',
              }}
            >
              <Typography variant="body2">
                {recommendedLayout.turbine_count} turbines · {recommendedLayout.estimated_capacity_mw} MW installed · Wake
                losses {recommendedLayout.wake_loss_pct}%
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                {recommendedLayout.spacing_strategy}
              </Typography>
            </Box>
          </Stack>
        )}

        {!!riskFlags.length && (
          <Stack spacing={1.5}>
            <Typography variant="subtitle2" sx={{ opacity: 0.68 }}>
              Watchouts
            </Typography>
            <List dense disablePadding>
              {riskFlags.map((risk) => (
                <ListItem key={risk} sx={{ py: 0.4 }}>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <EqualizerIcon sx={{ color: '#fca5a5' }} fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primaryTypographyProps={{ variant: 'body2', color: '#fca5a5' }}
                    primary={risk}
                  />
                </ListItem>
              ))}
            </List>
          </Stack>
        )}

        {forecastSummary && (
          <Stack spacing={1.2}>
            <Typography variant="subtitle2" sx={{ opacity: 0.68 }}>
              24 h Outlook
            </Typography>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(96, 165, 250, 0.18)',
                color: '#dbeafe',
              }}
            >
              <Typography variant="body2">
                Peak {forecastSummary.peak_speed.toFixed(1)} m/s · Floor {forecastSummary.min_speed.toFixed(1)} m/s · Trend
                {` ${forecastSummary.trend}`}
              </Typography>
            </Box>
          </Stack>
        )}

        <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.1)' }} />

        <Typography variant="caption" sx={{ opacity: 0.55 }}>
          Noise profile {noiseProfile} dB(A) at hub. Integrate curtailment strategy for sensitive receptors within 1.2 km.
        </Typography>
      </Box>
    </Paper>
  );
}

export default ReportViewer;