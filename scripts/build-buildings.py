"""Build data/buildings.json and data/waterlogging.json from the AI-NETRA-GEO pilot datasets (Malik/).

Inputs are real: OSM footprints, Google Open Buildings 2.5D heights, OSM Musi water polygons,
Telangana TGRAC mapped waterlogging points. Output is a compact columnar file the browser can load.
Stdlib only:  python scripts/build-buildings.py
"""
import csv, json, math, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
D = ROOT / "Malik" / "data"


def rows(name, key="building_id"):
    with open(D / name, newline="", encoding="utf-8") as f:
        return {r[key]: r for r in csv.DictReader(f)}


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def centroid(geom):
    ring = geom["coordinates"][0] if geom["type"] == "Polygon" else geom["coordinates"][0][0]
    return sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)


catalog = json.load(open(D / "ai_netra_building_catalog_v1.geojson", encoding="utf-8"))
musi = rows("ai_netra_musi_distances_v1.csv")
wl = rows("ai_netra_waterlogging_distances_v1.csv")
heights = rows("ai_netra_merged_heights_2023_v1.csv")
areas = rows("ai_netra_building_areas_v1.csv")

points = json.load(open(D / "tgrac_waterlogging_points_v1.geojson", encoding="utf-8"))
wl_points = [
    {"id": p["properties"]["waterlogging_id"], "name": p["properties"]["name"],
     "lat": round(p["geometry"]["coordinates"][1], 6), "lon": round(p["geometry"]["coordinates"][0], 6)}
    for p in points["features"]
]

cols = ["id", "lat", "lon", "height", "area", "musiM", "wlM", "wlId", "kind"]
out = []
for ft in catalog["features"]:
    p = ft["properties"]
    bid = p["building_id"]
    lon, lat = centroid(ft["geometry"])
    h = heights.get(bid, {})
    quality = h.get("height_quality_flag", "")
    height = num(h.get("estimated_height_m")) if quality != "review_low_estimate" else None
    out.append([
        int(p["source_id"]), round(lat, 6), round(lon, 6),
        None if height is None else round(height, 1),
        None if num(areas.get(bid, {}).get("footprint_area_m2")) is None else round(num(areas[bid]["footprint_area_m2"])),
        None if num(musi.get(bid, {}).get("distance_to_musi_water_m")) is None else round(num(musi[bid]["distance_to_musi_water_m"])),
        None if num(wl.get(bid, {}).get("distance_to_waterlogging_point_m")) is None else round(num(wl[bid]["distance_to_waterlogging_point_m"])),
        num(wl.get(bid, {}).get("nearest_waterlogging_id")),
        (p.get("tags") or {}).get("amenity") or (p.get("tags") or {}).get("shop") or p.get("building_type") or "yes",
    ])

for r in out:
    if r[7] is not None:
        r[7] = int(r[7])

meta = {
    "source": "AI-NETRA-GEO (Malik/): OSM footprints, Google Open Buildings 2.5D 2023 heights, OSM Musi polygons, TGRAC waterlogging points",
    "pilot": "Moosarambagh / Musi corridor, Hyderabad",
    "caveat": "Proximity is not flooding. Heights are model estimates. No building is confirmed flooded.",
    "cols": cols,
}
(ROOT / "data" / "buildings.json").write_text(json.dumps({"meta": meta, "rows": out}, separators=(",", ":")))
(ROOT / "data" / "waterlogging.json").write_text(json.dumps({"meta": meta, "points": wl_points}, separators=(",", ":")))
print(len(out), "buildings,", len(wl_points), "waterlogging points")
