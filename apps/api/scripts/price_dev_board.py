#!/usr/bin/env python3
"""
Price every car + driver for round 1 across the four running classes so the selection board is
complete (cars hit unique-constraint reuse, so some classes had entries but no prices). Run after
seed_dev_board.py. Idempotent — price upsert updates in place.
"""
import json, urllib.request, urllib.parse, urllib.error

BASE = 'http://localhost:5239'
SEASON, ROUND = 1, 1
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
        return e.code, e.read().decode()


req('POST', '/auth/dev-login', query={'subject': 'dev-admin'})

# class id -> (car_base, car_step, drv_base, drv_step)
TIERS = {1: (40, 4, 9, 1.0), 5: (20, 1.5, 6, 0.7), 2: (24, 1.5, 7, 0.7), 3: (16, 1.2, 5, 0.6)}

_, all_ed = req('GET', '/entry-drivers')
drivers_by_car = {}
for ed in all_ed:
    drivers_by_car.setdefault(ed['carEntryId'], []).append(ed['driverId'])

prices = []
seen_drivers = set()
for cid, (cb, cs, db, ds) in TIERS.items():
    _, cars = req('GET', '/car-entries', query={'seasonId': SEASON, 'classId': cid})
    for i, car in enumerate(sorted(cars, key=lambda c: c['id'])):
        prices.append({'entityType': 'Car', 'entityId': car['id'], 'classId': cid,
                       'price': round(max(cb - i * cs, 5), 1)})
        for j, did in enumerate(drivers_by_car.get(car['id'], [])):
            if did in seen_drivers:
                continue
            seen_drivers.add(did)
            prices.append({'entityType': 'Driver', 'entityId': did, 'classId': cid,
                           'price': round(max(db - j * ds, 2), 1)})

s, res = req('POST', f'/rounds/{ROUND}/prices', {'prices': prices})
print(f'priced {len(prices)} entities ({s}): {res}')
