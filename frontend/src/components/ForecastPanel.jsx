import PropTypes from 'prop-types';
import {
  Box,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';

function ForecastPanel({ forecast }) {
  const theme = useTheme();

  if (!forecast) {
    return (
      <Card
        elevation={6}
        sx={{
          height: '100%',
          borderRadius: 4,
          background: 'linear-gradient(135deg, rgba(30,64,175,0.32), rgba(15,23,42,0.88))',
          border: '1px solid rgba(99, 102, 241, 0.24)',
          color: '#e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 3,
          py: 4,
        }}
      >
        <Typography variant="body1" sx={{ opacity: 0.7 }}>
          Forecast will appear after selecting a location.
        </Typography>
      </Card>
    );
  }

  const summary = forecast.summary || {};
  const hourly = forecast.hourly ? forecast.hourly.slice(0, 6) : [];

  return (
    <Card
      elevation={10}
      sx={{
        height: '100%',
        borderRadius: 4,
        background: 'linear-gradient(145deg, rgba(30,58,138,0.6), rgba(15,23,42,0.92))',
        border: '1px solid rgba(59, 130, 246, 0.24)',
        color: '#e0f2fe',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Stack spacing={2.5} sx={{ height: '100%' }}>
          <Box>
            <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: 1.1, opacity: 0.72 }}>
              100 m wind outlook
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {summary.avg_speed ? `${summary.avg_speed.toFixed(1)} m/s avg` : 'Awaiting data'}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.75 }}>
              Peak {summary.peak_speed ? `${summary.peak_speed.toFixed(1)} m/s` : '—'} · Min{' '}
              {summary.min_speed ? `${summary.min_speed.toFixed(1)} m/s` : '—'} · Trend {summary.trend || '—'}
            </Typography>
          </Box>

          <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.18)' }} />

          <Stack spacing={1.25} sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
            {hourly.map((slot) => (
              <Box
                key={slot.timestamp}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(2,6,23,0.4)',
                  borderRadius: 2.5,
                  border: '1px solid rgba(148, 163, 184, 0.14)',
                  px: 2,
                  py: 1.15,
                  minHeight: 76,
                }}
              >
                <Stack spacing={0.2}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#bfdbfe' }}>
                    {new Date(slot.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(226, 232, 240, 0.7)' }}>
                    Gust {slot.gust ? `${slot.gust.toFixed(1)} m/s` : '—'}
                  </Typography>
                </Stack>
                <Stack spacing={0.2} sx={{ textAlign: 'right' }}>
                  <Typography variant="h6" sx={{ color: theme.palette.cyan?.[200] || '#67e8f9' }}>
                    {slot.wind_speed ? `${slot.wind_speed.toFixed(1)} m/s` : '—'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(148, 163, 184, 0.7)' }}>
                    Dir {slot.direction ? `${Math.round(slot.direction)}°` : '—'} · {slot.confidence || '—'} conf
                  </Typography>
                </Stack>
              </Box>
            ))}
            {!hourly.length && (
              <Typography variant="body2" sx={{ opacity: 0.72 }}>
                Hourly forecast data unavailable from provider.
              </Typography>
            )}
          </Stack>
        </Stack>
      </CardContent>
  </Card>
  );
}

ForecastPanel.propTypes = {
  forecast: PropTypes.shape({
    summary: PropTypes.shape({
      avg_speed: PropTypes.number,
      peak_speed: PropTypes.number,
      min_speed: PropTypes.number,
      trend: PropTypes.string,
    }),
    hourly: PropTypes.arrayOf(
      PropTypes.shape({
        timestamp: PropTypes.string.isRequired,
        wind_speed: PropTypes.number,
        gust: PropTypes.number,
        direction: PropTypes.number,
        confidence: PropTypes.string,
      }),
    ),
  }),
};

ForecastPanel.defaultProps = {
  forecast: null,
};

export default ForecastPanel;
