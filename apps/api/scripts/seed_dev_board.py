#!/usr/bin/env python3
"""
Seed round 1 (Rolex 24, season 1) with a realistic four-class selection board for verifying the
F2 roster builder: GTP (already seeded) + LMP2/GTDPRO/GTD entries, drivers, prices, and 1-per-class
roster rules, with a $120M cap. Idempotent-ish: re-runs skip cars that already exist (unique on
season+class+number) and update existing rules.

Run with the API up (Development):  python3 apps/api/scripts/seed_dev_board.py
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
        t = e.read().decode()
        # NB: `t[:1] in '{['` is True for an empty body ('' is a substring of any str),
        # which would json.loads('') and crash on empty error responses (e.g. a 409 on re-run).
        return e.code, (json.loads(t) if t[:1] in ('{', '[') else t)


req('POST', '/auth/dev-login', query={'subject': 'dev-admin'})  # admin session

# --- classes ---
_, classes = req('GET', '/classes', query={'championshipId': 1})
by_name = {c['name']: c['id'] for c in classes}
if 'LMP2' not in by_name:
    _, c = req('POST', '/classes', {'championshipId': 1, 'name': 'LMP2'})
    by_name['LMP2'] = c['id']
GTP, LMP2, GTDPRO, GTD = by_name['GTP'], by_name['LMP2'], by_name['GTDPRO'], by_name['GTD']

# --- sessions (a Race session marks a class as "running" this round) ---
for cid in (GTP, LMP2, GTDPRO, GTD):
    req('POST', '/sessions', {'roundId': ROUND, 'classId': cid, 'type': 'Race',
                              'scheduledStart': None, 'status': 'Scheduled'})

# --- roster rules: 1 car per class (Main 1/1) ---
_, allrules = req('GET', '/roster-rules', query={'seasonId': SEASON})
rules = [r for r in (allrules or []) if r['seasonId'] == SEASON]
main_by_class = {r['classId']: r['id'] for r in rules if r['slotType'] == 'Main'}
for cid in (GTP, LMP2, GTDPRO, GTD):
    if cid in main_by_class:
        req('PUT', f'/roster-rules/{main_by_class[cid]}', {'minPicks': 1, 'maxPicks': 1})
    else:
        req('POST', '/roster-rules', {'seasonId': SEASON, 'classId': cid, 'slotType': 'Main',
                                      'minPicks': 1, 'maxPicks': 1})

# --- modifier rules (ADR-0006): free per-round bonuses, one of each per roster ---
# This is the WeatherTech (team-based) season → Double Points Team. CAPTAIN is a driver-based-series
# modifier (e.g. MX-5 Cup) and is seeded on that season's rules, not here.
_, allmods = req('GET', '/roster-modifier-rules', query={'seasonId': SEASON})
mods_by_kind = {m['kind']: m for m in (allmods or [])}
for kind, applies_to in (('DOUBLE_POINTS_TEAM', 'MainPick'),):
    if kind in mods_by_kind:
        req('PUT', f"/roster-modifier-rules/{mods_by_kind[kind]['id']}",
            {'maxCount': 1, 'appliesTo': applies_to})
    else:
        req('POST', '/roster-modifier-rules',
            {'seasonId': SEASON, 'kind': kind, 'maxCount': 1, 'appliesTo': applies_to})
# Remove a stale CAPTAIN rule if a prior seed put it on this team-based season.
if 'CAPTAIN' in mods_by_kind:
    req('DELETE', f"/roster-modifier-rules/{mods_by_kind['CAPTAIN']['id']}")

# --- car entries + drivers + prices for the three classes that need them ---
prices = []


def add_car(cid, number, team, price, drivers):
    s, car = req('POST', '/car-entries', {'seasonId': SEASON, 'classId': cid,
                                          'number': number, 'teamName': team})
    if s >= 300 or not isinstance(car, dict):
        print(f'  skip car #{number} {team} ({s})')
        return
    prices.append({'entityType': 'Car', 'entityId': car['id'], 'classId': cid, 'price': price})
    for dname, dprice in drivers:
        _, drv = req('POST', '/drivers', {'fullName': dname, 'country': None})
        req('POST', '/entry-drivers', {'carEntryId': car['id'], 'driverId': drv['id']})
        prices.append({'entityType': 'Driver', 'entityId': drv['id'], 'classId': cid, 'price': dprice})


add_car(LMP2, '04', 'CrowdStrike Tower', 18.0, [('Ben Keating', 5.5), ('Nico Pino', 4.0)])
add_car(LMP2, '22', 'United Autosports', 17.0, [('Bijoy Garg', 3.5), ('Paul di Resta', 6.0)])
add_car(LMP2, '52', 'Inter Europol', 15.5, [('Jakub Smiechowski', 3.0), ('Tom Dillmann', 4.5)])

add_car(GTDPRO, '3', 'Corvette Racing', 22.0, [('Antonio Garcia', 6.5), ('Alexander Sims', 5.5)])
add_car(GTDPRO, '4', 'Corvette Racing', 21.0, [('Tommy Milner', 5.0), ('Nicky Catsburg', 5.5)])
add_car(GTDPRO, '14', 'Lexus AKKODIS', 19.0, [('Jack Hawksworth', 5.0), ('Ben Barnicoat', 4.5)])

add_car(GTD, '57', 'Winward Mercedes', 14.0, [('Philip Ellis', 4.0), ('Russell Ward', 3.0)])
add_car(GTD, '27', 'Heart of Racing', 13.5, [('Ross Gunn', 4.5), ('Roman De Angelis', 3.5)])
add_car(GTD, '1', 'Paul Miller Racing', 12.0, [('Bryan Sellers', 3.5), ('Madison Snow', 3.0)])
add_car(GTD, '120', 'Vasser Sullivan', 11.5, [('Aaron Telitz', 3.0), ('Frankie Montecalvo', 3.0)])

s, res = req('POST', f'/rounds/{ROUND}/prices', {'prices': prices})
print(f'prices upsert ({s}): {res}')

# --- shared event (ADR-0007): the physical weekend round 1 opts into. Idempotent by name. ---
_, events = req('GET', '/events')
event = next((e for e in (events or []) if e['name'] == 'Rolex 24 At Daytona'), None)
if event is None:
    _, event = req('POST', '/events', {'name': 'Rolex 24 At Daytona',
                                       'circuit': 'Daytona International Speedway',
                                       'startsAt': None, 'endsAt': None})
EVENT_ID = event['id']

# --- cap to $120M + link round 1 to the Daytona event ---
_, rnd = req('GET', f'/rounds/{ROUND}')
req('PUT', f'/rounds/{ROUND}', {'name': rnd['name'], 'circuit': rnd['circuit'],
                                'sequence': rnd['sequence'], 'qualiStart': rnd['qualiStart'],
                                'startsAt': rnd['startsAt'], 'endsAt': rnd['endsAt'],
                                'salaryCap': 120, 'eventId': EVENT_ID})
print('seed complete')
