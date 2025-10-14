import {
  Box,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PublicIcon from '@mui/icons-material/Public';
import InsightsIcon from '@mui/icons-material/Insights';
import MapIcon from '@mui/icons-material/Map';

function Sidebar({ selectedLocation, loading, locationMeta, insights, layoutSummary }) {
  const locationLabel = locationMeta?.label || 'Awaiting site selection';
  const coordinateLabel = selectedLocation
    ? `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`
    : 'Click on the map to begin';

  const opportunity = insights?.opportunityScore ?? 0;
  const narrative = insights?.narrative || 'Select an area to unlock feasibility insights.';
  const areaChip = layoutSummary?.stats?.areaSqKm
    ? `Area ${layoutSummary.stats.areaSqKm} km²`
    : null;
  const placementChip = layoutSummary?.placements?.length
    ? `${layoutSummary.placements.length} pin${layoutSummary.placements.length > 1 ? 's' : ''}`
    : null;

  return (
    <Paper
      sx={{
        p: 3,
        height: '100%',
        borderRadius: 3,
        bgcolor: 'rgba(15, 23, 42, 0.86)',
        border: '1px solid rgba(148, 163, 184, 0.16)',
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      <Stack spacing={2}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Site Intelligence
        </Typography>
        <Stack spacing={1.2}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(59, 130, 246, 0.2)',
                color: '#93c5fd',
              }}
            >
              <PlaceIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                {locationLabel}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.72 }}>
                {coordinateLabel}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {locationMeta?.placeType && (
              <Chip
                icon={<MapIcon fontSize="small" />}
                label={locationMeta.placeType}
                size="small"
                sx={{ bgcolor: 'rgba(148, 163, 184, 0.16)', color: '#e2e8f0' }}
              />
            )}
            {locationMeta?.region && (
              <Chip
                icon={<PublicIcon fontSize="small" />}
                label={locationMeta.region}
                size="small"
                sx={{ bgcolor: 'rgba(59, 130, 246, 0.18)', color: '#bfdbfe' }}
              />
            )}
            {areaChip && (
              <Chip
                label={areaChip}
                size="small"
                sx={{ bgcolor: 'rgba(16, 185, 129, 0.2)', color: '#bbf7d0' }}
              />
            )}
            {placementChip && (
              <Chip
                label={placementChip}
                size="small"
                sx={{ bgcolor: 'rgba(250, 204, 21, 0.18)', color: '#fef08a' }}
              />
            )}
          </Stack>
        </Stack>
      </Stack>

      <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.16)' }} />

      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AccessTimeIcon sx={{ color: '#facc15' }} fontSize="small" />
          <Typography variant="body2" sx={{ opacity: 0.78 }}>
            {locationMeta?.localTime ? `Local time ${locationMeta.localTime}` : 'Local time unavailable'}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <InsightsIcon sx={{ color: '#22d3ee' }} fontSize="small" />
          <Typography variant="body2" sx={{ opacity: 0.78 }}>
            {loading ? 'Running turbine siting model…' : narrative}
          </Typography>
        </Stack>
      </Stack>

      <Stack spacing={1.25}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="subtitle2" sx={{ opacity: 0.76 }}>
            Opportunity Index
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {Math.round(opportunity)}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={Math.min(opportunity, 100)}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: 'rgba(148, 163, 184, 0.2)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              background: 'linear-gradient(90deg, #34d399 0%, #60a5fa 100%)',
            },
          }}
        />
      </Stack>

      <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.16)' }} />

      <Stack spacing={1.5}>
        <Typography variant="subtitle2" sx={{ opacity: 0.74 }}>
          Guidance
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.64, lineHeight: 1.6 }}>
          {selectedLocation
            ? 'Refine the buildable boundary or use Smart Radius to benchmark alternate footprints. Export layouts to iterate with stakeholders.'
            : 'Zoom into a promising corridor and tap the map to unlock feasibility, climate, and turbine recommendations.'}
        </Typography>
      </Stack>
    </Paper>
  );
}

export default Sidebar;