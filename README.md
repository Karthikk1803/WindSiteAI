# WindSite.AI Mini

A lightweight wind site analysis tool using AlphaEarth API for wind and terrain data analysis.

## Features

- Interactive map interface for site selection
- Real-time wind data visualization
- AI-powered site suitability analysis
- Grid connection distance estimation
- Turbine recommendations

## Setup

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file in the backend directory with your AlphaEarth API key:
```
ALPHA_EARTH_API_KEY=your_api_key_here
```

5. Start the backend server:
```bash
uvicorn main:app --reload
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

## Usage

1. Open your browser and navigate to `http://localhost:5173`
2. Click anywhere on the map to analyze that location
3. View real-time wind data and site analysis report
4. Explore different locations to compare their wind power potential

## Technical Stack

- Backend:
  - FastAPI
  - Python
  - AlphaEarth API integration

- Frontend:
  - React
  - Material-UI
  - Leaflet for maps
  - Vite build tool