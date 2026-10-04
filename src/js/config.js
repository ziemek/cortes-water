// Configuration and constants for the water quality visualization
export const config = {
  recentMonthsDefault: 18, // Show the most recent 18 months of data by default
  // CSS custom properties holding each lake's and season's color
  lakeColorVars: {
    Gunflint: '--lake-gunflint',
    Hague: '--lake-hague',
  },
  depthRanges: [
    { name: 'Surface (0-2m)', min: 0, max: 2 },
    { name: 'Mid-depth (3-8m)', min: 3, max: 8 },
    { name: 'Deep (9m+)', min: 9, max: 50 },
  ],
  seasonColorVars: {
    spring: '--season-spring',
    summer: '--season-summer',
    fall: '--season-fall',
    winter: '--season-winter',
  },
  parameterLabels: {
    temperature: 'Temperature (°C)',
    DO: 'Dissolved Oxygen (mg/L)',
    SPC: 'Specific Conductance (μS/cm)',
    TDS: 'Total Dissolved Solids (mg/L)',
    PH: 'pH Level',
    temp_oxygen: 'Temperature vs Oxygen Correlation',
    conductivity_tds: 'Conductivity vs TDS Correlation',
    ph_oxygen: 'pH vs Dissolved Oxygen Correlation',
    secchi: 'Secchi Depth Analysis',
  },
};

// Charts take their container's width; height is width × aspect, clamped
export const chartDimensions = {
  margin: { top: 16, right: 24, bottom: 52, left: 64 },
  depthProfile: { aspect: 0.8, minHeight: 320, maxHeight: 520 },
  scatter: { aspect: 0.75, minHeight: 300, maxHeight: 460 },
  timeSeries: { aspect: 0.32, minHeight: 220, maxHeight: 300 },
  secchiTimeSeries: { aspect: 0.32, minHeight: 260, maxHeight: 340 },
  secchiCorrelation: { aspect: 0.85, minHeight: 240, maxHeight: 340 },
};
