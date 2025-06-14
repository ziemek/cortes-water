// Configuration and constants for the water quality visualization
export const config = {
  maxVisibleDefault: 12, // Show first 12 series by default (deprecated, now using recent months)
  recentMonthsDefault: 18, // Show the most recent 18 months of data by default
  baseColorPalettes: {
    Gunflint: ['#FF6B6B', '#FF8E53', '#FF9F43'],
    Hague: ['#4ECDC4', '#45B7D1', '#6C5CE7'],
  },
  depthRanges: [
    { name: 'Surface (0-2m)', min: 0, max: 2 },
    { name: 'Mid-depth (3-8m)', min: 3, max: 8 },
    { name: 'Deep (9m+)', min: 9, max: 50 },
  ],
  seasonColors: {
    spring: '#4CAF50',
    summer: '#FF9800',
    fall: '#FF5722',
    winter: '#2196F3',
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

export const chartDimensions = {
  margin: { top: 20, right: 30, bottom: 80, left: 60 },
  width: 550,
  height: 400,
  scatter: {
    width: 550,
    height: 400,
  },
  timeSeries: {
    width: 550,
    height: 300,
  },
  correlation: {
    width: 300,
    height: 300,
  },
};
