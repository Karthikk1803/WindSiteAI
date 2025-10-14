from datetime import datetime, timedelta
import asyncio
import random

import httpx # type: ignore
from fastapi import FastAPI, HTTPException # type: ignore
from fastapi.middleware.cors import CORSMiddleware # type: ignore
from pydantic import BaseModel # type: ignore

app = FastAPI()

# Configure CORS to allow requests from your frontend
origins = [
    "http://localhost:5173", 
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class WindTurbinePoint(BaseModel):
    lat: float
    lng: float


class WindGridRequest(BaseModel):
    min_lat: float
    min_lon: float
    max_lat: float
    max_lon: float
    rows: int = 18
    cols: int = 18


OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
MIN_GRID_DIMENSION = 4
MAX_GRID_DIMENSION = 24
MAX_SAMPLE_POINTS = 81


async def _fetch_open_meteo_speed(client: httpx.AsyncClient, lat: float, lon: float) -> float:
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "wind_speed_100m",
        "forecast_days": 1,
        "timezone": "UTC",
    }
    response = await client.get(OPEN_METEO_URL, params=params)
    response.raise_for_status()
    payload = response.json()
    hourly = payload.get("hourly", {})
    speeds = hourly.get("wind_speed_100m")
    times = hourly.get("time", [])
    if not speeds:
        raise ValueError("No wind speed data returned")

    if times:
        current_hour = datetime.utcnow().replace(minute=0, second=0, microsecond=0).isoformat()
        try:
            index = times.index(current_hour)
        except ValueError:
            index = 0
    else:
        index = 0

    return float(speeds[index])


TURBINE_LIBRARY = [
    {
        "model": "Vestas V162-6.8 MW",
        "class": "IEC III",
        "rated_power_mw": 6.8,
        "rotor_diameter_m": 162,
        "swept_area_m2": 20612,
        "hub_height_m": 166,
        "cut_in_speed_ms": 3.0,
        "cut_out_speed_ms": 25.0,
        "description": (
            "Optimized for low-to-medium wind sites with high capacity retention in complex terrains."
        ),
    },
    {
        "model": "GE Haliade-X 12 MW",
        "class": "Offshore",
        "rated_power_mw": 12.0,
        "rotor_diameter_m": 220,
        "swept_area_m2": 38013,
        "hub_height_m": 150,
        "cut_in_speed_ms": 3.5,
        "cut_out_speed_ms": 30.0,
        "description": (
            "Ultra-high output turbine delivering industry-leading annual energy production for coastal corridors."
        ),
    },
    {
        "model": "Siemens Gamesa SG 14-222 DD",
        "class": "Offshore",
        "rated_power_mw": 14.0,
        "rotor_diameter_m": 222,
        "swept_area_m2": 38710,
        "hub_height_m": 155,
        "cut_in_speed_ms": 3.0,
        "cut_out_speed_ms": 30.0,
        "description": (
            "Direct-drive drivetrain with minimal maintenance requirements and strong typhoon tolerance."
        ),
    },
    {
        "model": "Nordex N163/6.X",
        "class": "IEC III",
        "rated_power_mw": 6.0,
        "rotor_diameter_m": 163,
        "swept_area_m2": 20898,
        "hub_height_m": 164,
        "cut_in_speed_ms": 3.0,
        "cut_out_speed_ms": 26.0,
        "description": (
            "High and consistent production for continental interiors with low noise signature."
        ),
    },
    {
        "model": "Enercon E-160 EP5",
        "class": "IEC III",
        "rated_power_mw": 5.5,
        "rotor_diameter_m": 160,
        "swept_area_m2": 20106,
        "hub_height_m": 166,
        "cut_in_speed_ms": 2.5,
        "cut_out_speed_ms": 28.0,
        "description": (
            "Gearless direct drive with excellent grid compliance for emerging market deployments."
        ),
    },
]


@app.post("/wind-grid")
async def wind_grid(request: WindGridRequest):
    """Return a coarse wind speed matrix sourced from Open-Meteo for a bounding box."""

    if request.max_lat <= request.min_lat or request.max_lon <= request.min_lon:
        raise HTTPException(status_code=400, detail="Invalid bounding box provided")

    rows = max(MIN_GRID_DIMENSION, min(request.rows, MAX_GRID_DIMENSION))
    cols = max(MIN_GRID_DIMENSION, min(request.cols, MAX_GRID_DIMENSION))

    while rows * cols > MAX_SAMPLE_POINTS:
        if rows >= cols and rows > MIN_GRID_DIMENSION:
            rows -= 1
        elif cols > MIN_GRID_DIMENSION:
            cols -= 1
        else:
            break
    lat_step = (request.max_lat - request.min_lat) / (rows - 1) if rows > 1 else 0
    lon_step = (request.max_lon - request.min_lon) / (cols - 1) if cols > 1 else 0

    sample_points = []
    for i in range(rows):
        lat = request.min_lat + lat_step * i
        for j in range(cols):
            lon = request.min_lon + lon_step * j
            sample_points.append((i, j, round(lat, 6), round(lon, 6)))

    async with httpx.AsyncClient(
        timeout=10.0,
        limits=httpx.Limits(max_connections=16, max_keepalive_connections=8),
    ) as client:
        responses = await asyncio.gather(
            *(_fetch_open_meteo_speed(client, lat, lon) for _, _, lat, lon in sample_points),
            return_exceptions=True,
        )

    grid = [[None for _ in range(cols)] for _ in range(rows)]
    collected = []
    for index, response in enumerate(responses):
        row_idx, col_idx, lat, lon = sample_points[index]
        if isinstance(response, Exception):
            grid[row_idx][col_idx] = None
            continue
        speed = max(0.0, float(response))
        grid[row_idx][col_idx] = speed
        collected.append(speed)

    if not collected:
        raise HTTPException(status_code=502, detail="Unable to retrieve wind data from provider")

    average_speed = sum(collected) / len(collected)
    min_speed = min(collected)
    max_speed = max(collected)

    for r_idx in range(rows):
        for c_idx in range(cols):
            if grid[r_idx][c_idx] is None:
                grid[r_idx][c_idx] = average_speed

    return {
        "meta": {
            "min_lat": request.min_lat,
            "max_lat": request.max_lat,
            "min_lon": request.min_lon,
            "max_lon": request.max_lon,
            "rows": rows,
            "cols": cols,
            "source": "open-meteo",
            "fetched_at": datetime.utcnow().isoformat() + "Z",
        },
        "grid": grid,
        "stats": {
            "min_speed": min_speed,
            "max_speed": max_speed,
            "avg_speed": average_speed,
            "sample_count": len(collected),
        },
    }


def _select_suitability() -> str:
    return random.choices(
        population=["Excellent", "Good", "Fair", "Poor"],
        weights=[0.28, 0.36, 0.24, 0.12],
        k=1,
    )[0]


def _capacity_factor_for(suitability: str) -> float:
    bands = {
        "Excellent": (0.46, 0.58),
        "Good": (0.38, 0.48),
        "Fair": (0.30, 0.40),
        "Poor": (0.18, 0.30),
    }
    low, high = bands.get(suitability, (0.25, 0.35))
    return round(random.uniform(low, high), 3)


def _pick_turbines(suitability: str):
    catalogue = random.sample(TURBINE_LIBRARY, 3)
    if suitability in ("Excellent", "Good"):
        catalogue.sort(key=lambda t: t["rated_power_mw"], reverse=True)
    else:
        catalogue.sort(key=lambda t: t["cut_in_speed_ms"])
    return catalogue


def _build_layout(best_turbine: dict, capacity_factor: float):
    target_count = random.randint(14, 28)
    total_capacity = round(target_count * best_turbine["rated_power_mw"], 1)
    wake_loss_pct = round(random.uniform(7.5, 15.5), 1)
    annual_generation = round(
        total_capacity * 8760 * capacity_factor * (1 - wake_loss_pct / 100),
        0,
    )
    return {
        "turbine_count": target_count,
        "estimated_capacity_mw": total_capacity,
        "wake_loss_pct": wake_loss_pct,
        "spacing_strategy": random.choice(
            [
                "5D x 7D staggered",
                "6D hexagonal",
                "Optimized contour alignment",
            ]
        ),
        "annual_generation_mwh": annual_generation,
    }


def _build_forecast(base_speed: float):
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    horizon_hours = list(range(0, 25, 3))
    hourly = []
    for idx, offset in enumerate(horizon_hours):
        delta = random.uniform(-0.8, 0.9) + (0.2 if idx % 4 == 0 else -0.1)
        speed = max(2.0, base_speed + delta)
        hourly.append(
            {
                "timestamp": (now + timedelta(hours=offset)).isoformat() + "Z",
                "hour_offset": offset,
                "wind_speed": round(speed, 1),
                "gust": round(speed + random.uniform(1.8, 4.2), 1),
                "direction": round(random.uniform(200, 290), 0),
                "confidence": random.choice(["High", "High", "Medium", "Medium", "Low"]),
            }
        )

    speeds = [entry["wind_speed"] for entry in hourly]
    return {
        "hourly": hourly,
        "summary": {
            "peak_speed": max(speeds),
            "min_speed": min(speeds),
            "avg_speed": round(sum(speeds) / len(speeds), 1),
            "trend": random.choice(["Rising", "Stable", "Cooling"]),
        },
    }


@app.get("/analyze")
async def analyze_location(lat: float, lon: float):
    """Simulate a wind site feasibility study with rich metadata."""

    if 51.52 < lat < 51.53 and -0.09 < lon < -0.07:
        return {
            "site_report": {
                "suitability": "Not Suitable - Water Body",
                "best_turbine": "N/A",
                "capacity_factor": 0,
                "grid_distance_km": 0,
                "expected_generation_mwh": 0,
                "payback_years": None,
                "co2_offset_tons": 0,
                "terrain": "Open Water",
                "noise_profile_db": 0,
                "recommended_layout": None,
                "risk_flags": ["Marine ecosystem impact"],
                "confidence": 0,
            },
            "raw_data": None,
            "turbine_catalogue": [],
            "forecast": None,
        }

    suitability = _select_suitability()
    capacity_factor = _capacity_factor_for(suitability)
    turbines = _pick_turbines(suitability)
    best_turbine = turbines[0]
    layout = _build_layout(best_turbine, capacity_factor)
    grid_distance = round(random.uniform(1.5, 24.0), 2)
    payback_years = round(random.uniform(6.5, 11.0), 1)
    co2_offset = round(layout["annual_generation_mwh"] * 0.00082, 1)
    base_speed = random.uniform(7.0, 9.5)
    forecast = _build_forecast(base_speed)

    return {
        "site_report": {
            "suitability": suitability,
            "best_turbine": best_turbine["model"],
            "capacity_factor": capacity_factor,
            "grid_distance_km": grid_distance,
            "expected_generation_mwh": layout["annual_generation_mwh"],
            "payback_years": payback_years,
            "co2_offset_tons": co2_offset,
            "terrain": random.choice(
                [
                    "Coastal plain with gentle slope",
                    "Semi-arid plateau",
                    "Alluvial farming basin",
                    "Rocky ridge with sparse shrubs",
                ]
            ),
            "noise_profile_db": round(random.uniform(88, 101), 1),
            "recommended_layout": layout,
            "risk_flags": random.sample(
                [
                    "Bird migration corridor",
                    "Seasonal flooding",
                    "Grid congestion risk",
                    "High icing potential",
                    "Heritage buffer zone",
                    "Complex wake interactions",
                ],
                k=random.randint(1, 3),
            ),
            "confidence": random.randint(72, 95),
        },
        "raw_data": {
            "wind_speed": {
                "avg": round(base_speed, 2),
                "p95": round(base_speed + random.uniform(1.0, 2.0), 2),
                "gust": round(base_speed + random.uniform(2.5, 5.0), 2),
            },
            "wind_direction": {
                "deg": round(random.uniform(210, 280), 0),
                "variability": round(random.uniform(12, 34), 1),
            },
            "turbulence_intensity": round(random.uniform(0.08, 0.14), 3),
            "air_density": round(random.uniform(1.18, 1.24), 3),
            "shear_exponent": round(random.uniform(0.11, 0.18), 3),
            "temperature_c": round(random.uniform(12, 24), 1),
            "surface_roughness_length": round(random.uniform(0.03, 0.15), 3),
        },
        "turbine_catalogue": turbines,
        "forecast": forecast,
    }