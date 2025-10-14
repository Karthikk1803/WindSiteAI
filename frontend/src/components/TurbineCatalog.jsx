import PropTypes from 'prop-types';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';

function TurbineCatalog({ catalogue, highlightedModel }) {
  if (!catalogue || !catalogue.length) {
    return (
      <Card
        elevation={4}
        sx={{
          borderRadius: 4,
          background: 'linear-gradient(135deg, rgba(15,118,110,0.28), rgba(15,23,42,0.92))',
          border: '1px solid rgba(16, 185, 129, 0.24)',
          color: '#d1fae5',
          px: 3,
          py: 4,
          textAlign: 'center',
        }}
      >
        <Typography variant="body1" sx={{ opacity: 0.7 }}>
          Turbine recommendations will appear once analysis is available.
        </Typography>
      </Card>
    );
  }

  return (
    <Card
      elevation={8}
      sx={{
        borderRadius: 4,
        background: 'linear-gradient(155deg, rgba(20,184,166,0.32), rgba(15,23,42,0.95))',
        border: '1px solid rgba(45, 212, 191, 0.24)',
        color: '#ccfbf1',
        overflow: 'hidden',
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Recommended turbine portfolio
            </Typography>
            <Chip
              label={`${catalogue.length} models`}
              size="small"
              sx={{ backgroundColor: 'rgba(45, 212, 191, 0.25)', color: '#5eead4' }}
            />
          </Box>

          <Grid container spacing={2.5} alignItems="stretch">
            {catalogue.map((turbine) => {
              const isHighlight = highlightedModel && highlightedModel === turbine.model;
              return (
                <Grid item xs={12} md={4} key={turbine.model} sx={{ display: 'flex' }}>
                  <Box
                    sx={{
                      borderRadius: 3,
                      border: `1px solid ${isHighlight ? 'rgba(14, 165, 233, 0.9)' : 'rgba(34, 197, 94, 0.24)'}`,
                      backgroundColor: isHighlight ? 'rgba(14, 165, 233, 0.16)' : 'rgba(6, 95, 70, 0.28)',
                      px: 2.4,
                      py: 2,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.2,
                    }}
                  >
                    <Stack spacing={1.2}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {turbine.model}
                        </Typography>
                        {isHighlight && (
                          <Chip
                            label="Best fit"
                            size="small"
                            sx={{ backgroundColor: 'rgba(59, 130, 246, 0.28)', color: '#bfdbfe' }}
                          />
                        )}
                      </Stack>
                      <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7 }}>
                        {turbine.class}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        {turbine.description}
                      </Typography>
                      <Divider sx={{ borderColor: 'rgba(148, 163, 184, 0.18)' }} />
                      <Grid container spacing={1.2}>
                        <Grid item xs={6}>
                          <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            Rated power
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {turbine.rated_power_mw} MW
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            Rotor diameter
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {turbine.rotor_diameter_m} m
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            Hub height
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {turbine.hub_height_m} m
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            Cut-in / cut-out
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {turbine.cut_in_speed_ms} / {turbine.cut_out_speed_ms} m/s
                          </Typography>
                        </Grid>
                      </Grid>
                    </Stack>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </Stack>
      </CardContent>
    </Card>
  );
}

TurbineCatalog.propTypes = {
  catalogue: PropTypes.arrayOf(
    PropTypes.shape({
      model: PropTypes.string.isRequired,
      class: PropTypes.string,
      rated_power_mw: PropTypes.number,
      rotor_diameter_m: PropTypes.number,
      hub_height_m: PropTypes.number,
      cut_in_speed_ms: PropTypes.number,
      cut_out_speed_ms: PropTypes.number,
      description: PropTypes.string,
    }),
  ),
  highlightedModel: PropTypes.string,
};

TurbineCatalog.defaultProps = {
  catalogue: [],
  highlightedModel: null,
};

export default TurbineCatalog;
