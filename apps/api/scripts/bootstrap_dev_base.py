#!/usr/bin/env python3
"""
Bootstrap the minimal base data the dev board assumes (championship 1, season 1, round 1, and the
GTP/GTDPRO/GTD classes) on a freshly-reset DB, then it's ready for seed_dev_board.py + price_dev_board.py.
Sets distinctive non-palette class colors so the stored-color path is visibly exercised.
Run with the API up (Development):  python3 apps/api/scripts/bootstrap_dev_base.py
"""
import json, urllib.request, urllib.parse, urllib.error

BASE = 'http://localhost:5239'
# http.cookiejar stores the localhost session cookie under domain 'localhost.local' and never
# resends it to host 'localhost', so capture Set-Cookie and attach it manually.
_session = None
opener = urllib.request.build_opener()


def req(method, path, body=None, query=None):
    global _session
    url = BASE + path + ('?' + urllib.parse.urlencode(query) if query else '')
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    if data:
        r.add_header('Content-Type', 'application/json')
    if _session:
        r.add_header('Cookie', _session)
    try:
        with opener.open(r) as resp:
            sc = resp.headers.get('Set-Cookie')
            if sc:
                _session = sc.split(';', 1)[0]
            t = resp.read().decode()
            return resp.status, (json.loads(t) if t else None)
    except urllib.error.HTTPError as e:
        t = e.read().decode()
        return e.code, (json.loads(t) if t[:1] in ('{', '[') else t)


req('POST', '/auth/dev-login', query={'subject': 'dev-admin'})

# --- championship (→ id 1 on a fresh DB) ---
_, champs = req('GET', '/championships')
champ = next((c for c in (champs or []) if c['slug'] == 'weathertech'), None)
if champ is None:
    _, champ = req('POST', '/championships', {'name': 'WeatherTech SportsCar Championship', 'slug': 'weathertech'})
CH = champ['id']

# --- classes GTP / GTDPRO / GTD (LMP2 is created by seed_dev_board). Stored colors deliberately
#     diverge from the name-derived palette so the pick board visibly uses the stored value. ---
_, classes = req('GET', '/classes', query={'championshipId': CH})
by_name = {c['name']: c['id'] for c in classes}
COLORS = {'GTP': '#00e5ff', 'GTDPRO': '#ff00ff', 'GTD': '#a855f7'}  # cyan / magenta / violet
for name in ('GTP', 'GTDPRO', 'GTD'):
    if name in by_name:
        req('PUT', f'/classes/{by_name[name]}', {'name': name, 'color': COLORS[name]})
    else:
        _, c = req('POST', '/classes', {'championshipId': CH, 'name': name, 'color': COLORS[name]})
        by_name[name] = c['id']

# --- season 2026 (→ id 1) ---
_, seasons = req('GET', '/seasons', query={'championshipId': CH})
season = next((s for s in (seasons or []) if s['year'] == 2026), None)
if season is None:
    _, season = req('POST', '/seasons', {'championshipId': CH, 'year': 2026})
SEASON = season['id']

# --- round 1 (→ id 1); quali far in the future so picks stay unlocked/editable ---
_, rounds = req('GET', '/rounds', query={'seasonId': SEASON})
rnd = next((r for r in (rounds or []) if r['sequence'] == 1), None)
if rnd is None:
    _, rnd = req('POST', '/rounds', {
        'seasonId': SEASON, 'name': 'Rolex 24 At Daytona', 'circuit': 'Daytona International Speedway',
        'sequence': 1, 'qualiStart': '2027-01-25T00:00:00Z', 'startsAt': None, 'endsAt': None,
        'salaryCap': 120, 'eventId': None})

print(f'bootstrap complete: championship={CH} season={SEASON} round={rnd["id"]} classes={by_name} colors={COLORS}')
