import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

const SUGGESTIONS = [
  'Summarize this location',
  'Which turbine should we choose?',
  'Any red flags I should know?',
  'How strong are the winds over the next day?',
  'Tell me about the planned layout',
];

const formatNumber = (value, options = {}) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  return value.toLocaleString(undefined, options);
};

const buildContext = ({ siteReport, insights, layoutSummary, windData, forecast, locationMeta }) => {
  if (!siteReport && !insights && !layoutSummary && !windData && !forecast) {
    return null;
  }

  const bestTurbine = siteReport?.best_turbine;
  const suitability = siteReport?.suitability;
  const capacityFactor = siteReport?.capacity_factor ? Math.round(siteReport.capacity_factor * 100) : null;
  const gridDistance = siteReport?.grid_distance_km;
  const payback = siteReport?.payback_years;
  const co2 = siteReport?.co2_offset_tons;
  const terrain = siteReport?.terrain;
  const risks = siteReport?.risk_flags ?? [];

  const layoutCount = layoutSummary?.placements?.length;
  const layoutArea = layoutSummary?.stats?.areaSqKm;
  const layoutNote = layoutSummary?.note;

  const avgWind = windData?.wind_speed?.avg ?? forecast?.summary?.avg_speed;
  const gust = windData?.wind_speed?.gust ?? forecast?.summary?.peak_speed;
  const direction = windData?.wind_direction?.deg;

  const narrative = insights?.narrative;
  const opportunityScore = insights?.opportunityScore;

  const timezone = locationMeta?.timezone;
  const localTime = locationMeta?.localTime;
  const label = locationMeta?.label;

  return {
    bestTurbine,
    suitability,
    capacityFactor,
    gridDistance,
    payback,
    co2,
    terrain,
    risks,
    layoutCount,
    layoutArea,
    layoutNote,
    avgWind,
    gust,
    direction,
    narrative,
    opportunityScore,
    timezone,
    localTime,
    label,
  };
};

const craftReply = (prompt, context) => {
  if (!context) {
    return 'Select a location on the map to unlock live intelligence before chatting.';
  }

  const text = prompt.toLowerCase();
  const lines = [];

  if (text.includes('summarize') || text.includes('overview') || text.includes('location')) {
    const parts = [];
    if (context.label) {
      parts.push(`Site focus: ${context.label}`);
    }
    if (context.narrative) {
      parts.push(context.narrative);
    }
    if (context.suitability) {
      parts.push(`Suitability rated ${context.suitability}`);
    }
    if (context.opportunityScore) {
      parts.push(`Opportunity score ${context.opportunityScore}/100`);
    }
    if (context.capacityFactor !== null) {
      parts.push(`Capacity factor about ${context.capacityFactor}%`);
    }
    if (context.layoutCount) {
      parts.push(`Current layout pins ${context.layoutCount} turbines across ${context.layoutArea ?? '—'} km²`);
    }
    lines.push(parts.join(' · '));
  }

  if (text.includes('turbine') || text.includes('model')) {
    if (context.bestTurbine) {
      const highlights = [];
      highlights.push(`Recommended model: ${context.bestTurbine}`);
      if (context.capacityFactor !== null) {
        highlights.push(`Projected capacity factor near ${context.capacityFactor}%`);
      }
      if (context.payback) {
        highlights.push(`Payback horizon ≈ ${context.payback.toFixed(1)} years`);
      }
      lines.push(highlights.join(' · '));
    } else {
      lines.push('I need analysis results to advise on turbine configurations.');
    }
  }

  if (text.includes('risk') || text.includes('flag') || text.includes('concern')) {
    if (context.risks?.length) {
      lines.push(`Watch out for: ${context.risks.join(', ')}.`);
    } else {
      lines.push('No major risk flags surfaced in the latest run.');
    }
  }

  if (text.includes('wind') || text.includes('forecast') || text.includes('weather')) {
    const windBits = [];
    if (context.avgWind !== null && context.avgWind !== undefined) {
      windBits.push(`Average wind near ${context.avgWind.toFixed(1)} m/s at 100 m`);
    }
    if (context.gust !== null && context.gust !== undefined) {
      windBits.push(`Peak gusts touching ${context.gust.toFixed(1)} m/s`);
    }
    if (context.direction !== null && context.direction !== undefined) {
      windBits.push(`Prevailing direction ≈ ${Math.round(context.direction)}°`);
    }
    if (windBits.length) {
      lines.push(windBits.join(' · '));
    } else {
      lines.push('Wind forecast data has not arrived yet.');
    }
  }

  if (text.includes('layout') || text.includes('placement')) {
    if (context.layoutCount) {
      const layoutParts = [`${context.layoutCount} optimized placements in planner`];
      if (context.layoutNote) {
        layoutParts.push(context.layoutNote);
      }
      lines.push(layoutParts.join(' · '));
    } else {
      lines.push('Switch to the Layout Planner to drop turbines inside a radius or drawn boundary.');
    }
  }

  if (!lines.length) {
    const fallback = [];
    if (context.suitability) {
      fallback.push(`Suitability: ${context.suitability}`);
    }
    if (context.bestTurbine) {
      fallback.push(`Best-fit turbine: ${context.bestTurbine}`);
    }
    if (context.avgWind !== null && context.avgWind !== undefined) {
      fallback.push(`Avg 100 m wind ${context.avgWind.toFixed(1)} m/s`);
    }
    if (context.gridDistance !== null && context.gridDistance !== undefined) {
      fallback.push(`Grid connection about ${formatNumber(context.gridDistance, { maximumFractionDigits: 1 })} km away`);
    }
    lines.push(fallback.join(' · '));
  }

  if (context.localTime && !text.includes('time')) {
    lines.push(`Local time in ${context.timezone || 'site area'} is ${context.localTime}.`);
  }

  return lines.filter(Boolean).join('\n');
};

function ChatAssistant({ siteReport, insights, layoutSummary, windData, forecast, locationMeta }) {
  const [messages, setMessages] = useState([
    {
      id: 'assistant-welcome',
      role: 'assistant',
      text: 'Hi! I can summarize the site, highlight risks, talk through turbine choices, or break down the layout planner. Try a quick question or tap one of the suggestions.',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const context = useMemo(
    () => buildContext({ siteReport, insights, layoutSummary, windData, forecast, locationMeta }),
    [siteReport, insights, layoutSummary, windData, forecast, locationMeta],
  );

  const sendMessage = (prompt) => {
    if (!prompt.trim()) return;
    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: prompt.trim(),
    };
    const reply = craftReply(prompt.trim(), context);
    const assistantMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text: reply,
    };
    setMessages((prev) => [...prev.slice(-8), userMessage, assistantMessage]);
    setInputValue('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(inputValue);
  };

  return (
    <Card
      elevation={8}
      sx={{
        height: '100%',
        borderRadius: 4,
        background: 'linear-gradient(160deg, rgba(15,118,110,0.35), rgba(15,23,42,0.94))',
        border: '1px solid rgba(45, 212, 191, 0.3)',
        color: '#ccfbf1',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', flex: 1, gap: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
          <Stack spacing={0.3}>
            <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: 1.2, opacity: 0.75 }}>
              Project copilot
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Chat with WindSite AI
            </Typography>
          </Stack>
          <Chip
            icon={<AutoAwesomeIcon fontSize="small" />}
            label={context ? 'Live context linked' : 'Awaiting site'}
            size="small"
            sx={{ backgroundColor: context ? 'rgba(20,184,166,0.25)' : 'rgba(148,163,184,0.24)', color: '#f0fdfa' }}
          />
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap">
          {SUGGESTIONS.map((suggestion) => (
            <Chip
              key={suggestion}
              label={suggestion}
              clickable
              onClick={() => sendMessage(suggestion)}
              sx={{ backgroundColor: 'rgba(45,212,191,0.18)', color: '#99f6e4' }}
            />
          ))}
        </Stack>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            borderRadius: 3,
            border: '1px solid rgba(148, 163, 184, 0.18)',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            px: 2,
            py: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          {messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                alignSelf: message.role === 'assistant' ? 'flex-start' : 'flex-end',
                maxWidth: '85%',
                backgroundColor: message.role === 'assistant' ? 'rgba(14,165,233,0.18)' : 'rgba(45,212,191,0.28)',
                borderRadius: 3,
                px: 1.75,
                py: 1,
                border: '1px solid rgba(148, 163, 184, 0.16)',
                whiteSpace: 'pre-wrap',
                fontSize: 13.5,
              }}
            >
              {message.text}
            </Box>
          ))}
        </Box>

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 1 }}>
          <TextField
            placeholder="Ask about turbines, wind, risks, or the planner..."
            variant="outlined"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            fullWidth
            size="small"
            InputProps={{
              sx: {
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                borderRadius: 3,
                color: '#ecfeff',
              },
            }}
          />
          <IconButton type="submit" color="primary" sx={{ color: '#5eead4' }}>
            <SendIcon fontSize="small" />
          </IconButton>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => sendMessage('Summarize this location')}
            sx={{ borderColor: 'rgba(148,163,184,0.28)', color: '#f0fdfa' }}
          >
            Quick summary
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

ChatAssistant.propTypes = {
  siteReport: PropTypes.object,
  insights: PropTypes.object,
  layoutSummary: PropTypes.object,
  windData: PropTypes.object,
  forecast: PropTypes.object,
  locationMeta: PropTypes.object,
};

ChatAssistant.defaultProps = {
  siteReport: null,
  insights: null,
  layoutSummary: null,
  windData: null,
  forecast: null,
  locationMeta: null,
};

export default ChatAssistant;
