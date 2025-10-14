import PropTypes from 'prop-types';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';

const formatNumber = (value, suffix = '') => {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${suffix}`;
};

function InsightDeck({ insights, siteReport, layoutSummary }) {
  if (!insights) {
    return (
      <Card
        elevation={4}
        sx={{
          borderRadius: 4,
          background: 'linear-gradient(140deg, rgba(59,130,246,0.22), rgba(15,23,42,0.92))',
          border: '1px solid rgba(96, 165, 250, 0.24)',
          color: '#dbeafe',
          px: 3,
          py: 3,
        }}
      >
        <Typography variant="body1" sx={{ opacity: 0.72 }}>
          Key project insights will appear after analyzing a site.
        </Typography>
      </Card>
    );
  }

  const layoutStats = layoutSummary?.stats;
  const placementCount = layoutSummary?.placements?.length || 0;
  const riskFlags = siteReport?.risk_flags || [];

  const annualGenerationGwh = insights.annualGeneration ? insights.annualGeneration / 1000 : null;

  return (
    <Card
      elevation={8}
      sx={{
        borderRadius: 4,
        background: 'linear-gradient(150deg, rgba(79,70,229,0.36), rgba(15,23,42,0.95))',
        border: '1px solid rgba(129, 140, 248, 0.3)',
        color: '#ede9fe',
        overflow: 'hidden',
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack spacing={2.8}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Development outlook
            </Typography>
            <Chip
              label={insights.narrative}
              size="small"
              sx={{ backgroundColor: 'rgba(165, 180, 252, 0.35)', color: '#c7d2fe' }}
            />
          </Stack>

          <Grid container spacing={2.2} alignItems="stretch">
            <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
              <Box
                sx={{
                  backgroundColor: 'rgba(30,58,138,0.35)',
                  borderRadius: 3,
                  p: 2.2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  width: '100%',
                }}
              >
                <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: 1.2, opacity: 0.7 }}>
                  Opportunity score
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 700 }}>
                  {insights.opportunityScore}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={insights.opportunityScore}
                  sx={{ mt: 1.5, height: 10, borderRadius: 999, backgroundColor: 'rgba(129, 140, 248, 0.2)' }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
              <Box
                sx={{
                  backgroundColor: 'rgba(76,29,149,0.35)',
                  borderRadius: 3,
                  p: 2.2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.1,
                  width: '100%',
                }}
              >
                <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: 1.2, opacity: 0.7 }}>
                  Annual generation
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {formatNumber(annualGenerationGwh, ' GWh')}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.74 }}>
                  CO₂ offset {formatNumber(insights.co2Offset, ' t/yr')}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
              <Box
                sx={{
                  backgroundColor: 'rgba(67,56,202,0.38)',
                  borderRadius: 3,
                  p: 2.2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.1,
                  width: '100%',
                }}
              >
                <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: 1.2, opacity: 0.7 }}>
                  Financials
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  Payback {insights.paybackYears ? `${insights.paybackYears.toFixed(1)} yrs` : '—'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.74 }}>
                  Grid tie {formatNumber(siteReport?.grid_distance_km, ' km')} away
                </Typography>
              </Box>
            </Grid>
          </Grid>

          <Grid container spacing={2.2} alignItems="stretch">
            <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
              <Box
                sx={{
                  backgroundColor: 'rgba(30,64,175,0.35)',
                  borderRadius: 3,
                  p: 2.2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.1,
                  width: '100%',
                }}
              >
                <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: 1.2, opacity: 0.7 }}>
                  Layout snapshot
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {placementCount ? `${placementCount} optimized placements` : 'Layout not generated yet'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.74 }}>
                  Area {layoutStats?.areaSqKm ? `${layoutStats.areaSqKm} km²` : '—'} · Perimeter{' '}
                  {layoutStats?.perimeterKm ? `${layoutStats.perimeterKm} km` : '—'}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
              <Box
                sx={{
                  backgroundColor: 'rgba(109,40,217,0.35)',
                  borderRadius: 3,
                  p: 2.2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.1,
                  width: '100%',
                }}
              >
                <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: 1.2, opacity: 0.7 }}>
                  Risk and confidence
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  Confidence {insights.confidence}%
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                  {riskFlags.length
                    ? riskFlags.map((risk) => (
                        <Chip
                          key={risk}
                          label={risk}
                          size="small"
                          sx={{ backgroundColor: 'rgba(248, 113, 113, 0.2)', color: '#fecaca' }}
                        />
                      ))
                    : (
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        No major flags registered.
                      </Typography>
                    )}
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Stack>
      </CardContent>
    </Card>
  );
}

InsightDeck.propTypes = {
  insights: PropTypes.shape({
    opportunityScore: PropTypes.number,
    narrative: PropTypes.string,
    annualGeneration: PropTypes.number,
    co2Offset: PropTypes.number,
    paybackYears: PropTypes.number,
    confidence: PropTypes.number,
  }),
  siteReport: PropTypes.shape({
    grid_distance_km: PropTypes.number,
    risk_flags: PropTypes.arrayOf(PropTypes.string),
  }),
  layoutSummary: PropTypes.shape({
    placements: PropTypes.array,
    stats: PropTypes.shape({
      areaSqKm: PropTypes.number,
      perimeterKm: PropTypes.number,
    }),
  }),
};

InsightDeck.defaultProps = {
  insights: null,
  siteReport: null,
  layoutSummary: null,
};

export default InsightDeck;
