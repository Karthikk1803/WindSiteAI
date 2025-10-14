import {
  Box,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import AirIcon from '@mui/icons-material/Air';
import SpeedIcon from '@mui/icons-material/Speed';
import WavesIcon from '@mui/icons-material/Waves';
import WaterIcon from '@mui/icons-material/Water';
import ScatterPlotIcon from '@mui/icons-material/ScatterPlot';

function LivePanel({ windData, siteReport }) {
  if (!windData) {
    return (
      <Paper
        sx={{
          p: 3,
          height: '100%',
          borderRadius: 3,
          bgcolor: 'rgba(15, 23, 42, 0.82)',
          border: '1px solid rgba(148, 163, 184, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(226, 232, 240, 0.6)',
          textAlign: 'center',
        }}
      >
        <Typography variant="body2">
          Select a site to stream onsite flow metrics in real time.
        </Typography>
      </Paper>
    );
  }

  const {
    wind_speed: windSpeed,
    wind_direction: windDirection,
    turbulence_intensity: turbulence,
    air_density: airDensity,
    shear_exponent: shear,
    temperature_c: temperature,
    surface_roughness_length: roughness,
  } = windData;

  const powerDensity = airDensity ? (0.5 * airDensity * windSpeed.avg ** 3) / 1000 : null;

  const statCards = [
    {
      label: 'Avg Speed',
      value: `${windSpeed.avg.toFixed(1)} m/s`,
      hint: `P95 ${windSpeed.p95.toFixed(1)} m/s`,
      icon: <AirIcon fontSize="small" />,
    },
    {
      label: 'Gustiness',
      value: `${windSpeed.gust.toFixed(1)} m/s`,
      hint: 'Peak gust envelope',
      icon: <WavesIcon fontSize="small" />,
    },
    {
      label: 'Direction',
      value: `${windDirection.deg.toFixed(0)}°`,
      hint: `±${windDirection.variability.toFixed(1)}° spread`,
      icon: <SpeedIcon fontSize="small" />,
    },
    {
      label: 'Turbulence',
      value: `${(turbulence * 100).toFixed(1)}%`,
      hint: 'IEC Class C target < 16%',
      icon: <ScatterPlotIcon fontSize="small" />,
    },
    {
      label: 'Air Density',
      value: `${airDensity.toFixed(3)} kg/m³`,
      hint: 'Reference 1.225 kg/m³',
      icon: <WaterIcon fontSize="small" />,
    },
    {
      label: 'Shear Exponent',
      value: shear ? shear.toFixed(3) : '—',
      hint: 'Log-law profile exponent',
      icon: <ScatterPlotIcon fontSize="small" />,
    },
  ];

  const footerMetrics = [
    {
      label: 'Thermal Profile',
      value: `${temperature.toFixed(1)}°C`,
      hint: '100 m hub height',
    },
    {
      label: 'Roughness Length',
      value: `${roughness?.toFixed(3)} m`,
      hint: 'Surface layer proxy',
    },
    {
      label: 'Wind Power Density',
      value: powerDensity ? `${powerDensity.toFixed(0)} W/m²` : '—',
      hint: 'Derived from mean flow',
    },
  ];

  return (
    <Paper
      sx={{
        p: 3,
        borderRadius: 3,
        bgcolor: 'rgba(15, 23, 42, 0.82)',
        border: '1px solid rgba(148, 163, 184, 0.12)',
        color: '#e2e8f0',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Flow Snapshot
        </Typography>
        {siteReport?.suitability && (
          <Chip
            label={siteReport.suitability}
            size="small"
            sx={{ bgcolor: 'rgba(59, 130, 246, 0.18)', color: '#bfdbfe' }}
          />
        )}
      </Stack>

      <Grid container spacing={2} columns={{ xs: 12, md: 12 }} alignItems="stretch">
        {statCards.map((stat) => (
          <Grid item xs={6} md={4} key={stat.label} sx={{ display: 'flex' }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'rgba(30, 41, 59, 0.72)',
                border: '1px solid rgba(148, 163, 184, 0.12)',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                flex: 1,
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
                    {stat.icon}
                  </Box>
                  <Typography variant="caption" sx={{ textTransform: 'uppercase', opacity: 0.64 }}>
                    {stat.label}
                  </Typography>
                </Stack>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {stat.value}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                  {stat.hint}
                </Typography>
              </Stack>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.12)' }} />

      <Grid container spacing={2} alignItems="stretch">
        {footerMetrics.map((metric) => (
          <Grid item xs={12} sm={4} key={metric.label} sx={{ display: 'flex' }}>
            <Box
              sx={{
                flex: 1,
                borderRadius: 2,
                bgcolor: 'rgba(30, 41, 59, 0.68)',
                border: '1px solid rgba(148, 163, 184, 0.12)',
                px: 2,
                py: 1.75,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
              }}
            >
              <Typography variant="subtitle2" sx={{ opacity: 0.72 }}>
                {metric.label}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {metric.value}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.58 }}>
                {metric.hint}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}

export default LivePanel;