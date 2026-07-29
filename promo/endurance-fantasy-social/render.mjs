import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const ROOT = path.dirname(new URL(import.meta.url).pathname)
const FRAMES = path.join(ROOT, 'frames-png')
const OUTPUT = path.join(ROOT, 'output')
const FONTS = path.join(ROOT, 'fonts')
const FPS = 30
const DURATION = 15
const W = 1080
const H = 1920

fs.mkdirSync(FRAMES, { recursive: true })
fs.mkdirSync(OUTPUT, { recursive: true })

const C = {
  bg: '#0a0b0d',
  black: '#000000',
  surface: '#101317',
  surface2: '#16181c',
  surface3: '#0e0f12',
  line: '#1f242a',
  line2: '#2a2d33',
  line3: '#3a3f47',
  ink: '#ffffff',
  ink2: '#c8ccd2',
  muted: '#8a8f98',
  muted2: '#5c626b',
  brand: '#e10600',
  brand2: '#ff2d2d',
  brand3: '#ff5d5d',
  success: '#2dd4bf',
  warn: '#ff9e2c',
  bonus: '#ffc23d',
}

const classes = [
  { label: 'GTP', color: '#ffffff' },
  { label: 'LMP2', color: '#2e7dff' },
  { label: 'GTD PRO', color: '#ff0000' },
  { label: 'GTD', color: '#4ade80' },
]

const picks = [
  { number: '31', team: 'CADILLAC WHELEN', cls: classes[0], price: 14, drivers: ['AITKEN', 'BAMBER', 'VESTI'] },
  { number: '11', team: 'TDS RACING', cls: classes[1], price: 8.25, drivers: ['LUTKE', 'BECHE', 'HANSSON'] },
  { number: '62', team: 'RISI COMPETIZIONE', cls: classes[2], price: 8, drivers: ['SERRA', 'RIGON'] },
  { number: '80', team: 'LONE STAR RACING', cls: classes[3], price: 4.75, drivers: ['ANDREWS', 'HODENIUS', 'ROE'] },
]

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3)
const lerp = (a, b, t) => a + (b - a) * t
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

function display(x, y, value, size, o = {}) {
  const { fill = C.ink, weight = 700, anchor = 'start', spacing = 0, italic = false, opacity = 1 } = o
  return `<text x="${x}" y="${y}" fill="${fill}" fill-opacity="${opacity}" font-family="Saira Semi Condensed" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${spacing}"${italic ? ' font-style="italic"' : ''}>${esc(value)}</text>`
}

function sans(x, y, value, size, o = {}) {
  const { fill = C.ink2, weight = 400, anchor = 'start', spacing = 0, opacity = 1 } = o
  return `<text x="${x}" y="${y}" fill="${fill}" fill-opacity="${opacity}" font-family="Saira" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${spacing}">${esc(value)}</text>`
}

function mono(x, y, value, size, o = {}) {
  const { fill = C.muted, weight = 500, anchor = 'start', spacing = 2, opacity = 1 } = o
  return `<text x="${x}" y="${y}" fill="${fill}" fill-opacity="${opacity}" font-family="Spline Sans Mono" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${spacing}">${esc(value)}</text>`
}

function wordmark(x = 44, y = 108, scale = 1) {
  return `
    ${display(x, y, 'ENDURANCE', 58 * scale, { weight: 800, spacing: -1.2 * scale })}
    ${display(x + 296 * scale, y, 'FANTASY', 58 * scale, { weight: 800, fill: C.brand, spacing: -1.2 * scale })}
  `
}

function nav(active = 'HOME') {
  const items = ['HOME', 'STANDINGS', 'STATS']
  const itemX = [44, 240, 535]
  return `
    <rect width="${W}" height="300" fill="${C.black}"/>
    ${wordmark()}
    <circle cx="815" cy="88" r="48" fill="${C.surface2}" stroke="${C.line2}" stroke-width="3"/>
    ${display(815, 102, 'AK', 38, { fill: C.ink2, anchor: 'middle', weight: 700 })}
    ${display(1036, 98, 'SIGN OUT', 29, { fill: C.muted, anchor: 'end', weight: 600, spacing: 1.2 })}
    <line x1="0" y1="178" x2="${W}" y2="178" stroke="${C.line}" stroke-opacity=".6" stroke-width="2"/>
    ${items.map((item, i) => {
      const x = itemX[i]
      const selected = item === active
      return `
        ${display(x, 255, item, 38, { fill: selected ? C.ink : C.muted, weight: 600, spacing: 3 })}
        ${selected ? `<rect x="${x}" y="292" width="${item === 'STANDINGS' ? 190 : 112}" height="5" fill="${C.brand}"/>` : ''}
      `
    }).join('')}
    <rect y="297" width="${W}" height="5" fill="${C.brand}"/>
  `
}

function pill(x, y, label, { fill = C.surface2, stroke = 'none', color = C.ink2, width = 170 } = {}) {
  return `
    <rect x="${x}" y="${y}" width="${width}" height="54" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
    ${display(x + width / 2, y + 38, label, 28, { fill: color, anchor: 'middle', weight: 500, spacing: 1.2 })}
  `
}

function tapMarker(x, y, local, color = C.ink) {
  if (local < 0 || local > .52) return ''
  const contact = easeOut(local / .1) * (1 - easeOut((local - .19) / .14))
  const ripple = easeOut((local - .06) / .4)
  const rippleOpacity = clamp(1 - (local - .06) / .46)
  return `
    <circle cx="${x}" cy="${y}" r="${24 - contact * 4}" fill="${C.ink}" fill-opacity="${.92 * contact}" stroke="${C.bg}" stroke-opacity="${.7 * contact}" stroke-width="4"/>
    <circle cx="${x}" cy="${y}" r="${28 + ripple * 42}" fill="none" stroke="${color}" stroke-opacity="${.9 * rippleOpacity}" stroke-width="${6 - ripple * 3}"/>
  `
}

function appCarThumb(x, y, color, width = 210) {
  const height = width * 9 / 16
  return `
    <defs>
      <linearGradient id="thumb-${x}-${y}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity=".15"/>
        <stop offset="1" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="url(#thumb-${x}-${y})"/>
    <g transform="translate(${x + width * .29} ${y + height * .28}) scale(${width / 90})" fill="none" stroke="${color}" stroke-width=".75" opacity=".65">
      <path d="M3 13l2.2-5h13.6L21 13M5 13h14v4H5z"/>
      <circle cx="7.5" cy="17" r="1.6"/>
      <circle cx="16.5" cy="17" r="1.6"/>
    </g>
  `
}

function avatar(x, y, initials) {
  return `
    <circle cx="${x}" cy="${y}" r="23" fill="${C.surface2}" stroke="${C.line2}" stroke-width="3"/>
    ${display(x, y + 10, initials, 23, { fill: C.muted, anchor: 'middle', weight: 700 })}
  `
}

function landingScene(t) {
  const opened = t >= 1
  const press = easeOut((t - 1.75) / .28) * (1 - easeOut((t - 2.15) / .25))
  const heroOpacity = easeOut(t / .45)
  const countdownMinutes = Math.max(0, 3 - Math.floor(t / .3))
  const countdown = `2d  00h  ${String(countdownMinutes).padStart(2, '0')}m`
  const statusFill = opened ? C.brand : C.line
  const statusText = opened ? 'PICKS OPEN' : 'COMING SOON'
  return `
    <rect width="${W}" height="${H}" fill="${C.bg}"/>
    ${nav('HOME')}
    <rect y="302" width="${W}" height="1275" fill="${C.surface3}"/>
    <rect y="302" width="${W}" height="1275" fill="url(#heroFade)"/>
    <defs>
      <linearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${C.surface3}"/>
        <stop offset="1" stop-color="${C.bg}"/>
      </linearGradient>
    </defs>
    <g opacity="${heroOpacity}">
      ${mono(44, 410, '// NEXT_EVENT', 30, { spacing: 4 })}
      ${mono(400, 410, 'R08', 34, { fill: C.ink, weight: 700, spacing: 0 })}
      ${pill(508, 366, statusText, { fill: statusFill, color: opened ? C.ink : C.ink2, width: opened ? 216 : 244 })}

      ${display(44, 535, 'MOTUL SPORTSCAR', 94, { weight: 800 })}
      ${display(44, 625, 'ENDURANCE', 94, { weight: 800 })}
      ${display(44, 715, 'GRAND PRIX', 94, { weight: 800 })}
      ${sans(44, 778, 'Road America · Jul 30', 39, { fill: C.muted })}

      ${pill(44, 826, 'WeatherTech SportsCar Championship', { stroke: C.line3, width: 594, color: C.ink })}

      ${sans(44, 958, 'Endurance fantasy racing: pick your teams and drivers', 37, { fill: C.ink2 })}
      ${sans(44, 1010, 'within a salary cap and rack up points as they race.', 37, { fill: C.ink2 })}

      <rect x="44" y="1066" width="992" height="266" rx="8" fill="${C.black}" stroke="${C.line}" stroke-width="3"/>
      <rect x="90" y="1114" width="11" height="34" fill="${C.brand}" transform="skewX(-14)"/>
      ${display(122, 1143, 'PICKS LOCK IN', 30, { fill: C.muted, weight: 500, spacing: 4.5 })}
      ${mono(90, 1245, countdown, 91, { fill: C.ink, weight: 700, spacing: 1 })}
      ${mono(90, 1294, 'SAT · AUG 01 · 4:25 PM ET', 28, { spacing: 3 })}

      <rect x="${44 + press * 8}" y="${1372 + press * 5}" width="${992 - press * 16}" height="${126 - press * 10}" rx="8" fill="${C.brand}"/>
      ${display(540, 1453 + press * 2, 'SET YOUR LINEUP →', 47, { anchor: 'middle', weight: 700, italic: true, spacing: 2.5 })}
      ${tapMarker(540, 1435, t - 1.68, C.ink)}
    </g>
    <line x1="0" y1="1624" x2="${W}" y2="1624" stroke="${C.line}" stroke-width="3"/>
    ${mono(44, 1696, '// HOW_IT_WORKS', 29, { spacing: 4 })}
    ${display(44, 1763, 'PICK', 34, { weight: 700, spacing: 3 })}
    ${sans(198, 1763, 'Teams and Drivers within the salary cap', 29)}
    ${display(44, 1820, 'LOCK', 34, { weight: 700, spacing: 3 })}
    ${sans(198, 1820, 'Finalize your picks before qualifying starts', 29)}
    ${display(44, 1875, 'SCORE', 34, { weight: 700, spacing: 3 })}
    ${sans(198, 1875, 'You score points when your picks score points', 29)}
  `
}

function requirementPills(chosen, bonus = false) {
  return classes.map((cls, i) => {
    const x = 44 + i * 158
    const ok = chosen > i
    return `
      <rect x="${x}" y="511" width="142" height="92" rx="8" fill="${ok ? `${cls.color}1a` : 'transparent'}" stroke="${ok ? cls.color : C.line3}" stroke-width="2"/>
      ${mono(x + 71, 548, cls.label, 25, { fill: cls.color, anchor: 'middle', weight: 600, spacing: 0 })}
      ${mono(x + 71, 584, `${ok ? 1 : 0}/1`, 28, { fill: ok ? C.ink : C.warn, anchor: 'middle', spacing: 0 })}
    `
  }).join('') + `
    <rect x="676" y="511" width="142" height="92" rx="8" fill="${bonus ? `${C.bonus}1a` : 'transparent'}" stroke="${bonus ? C.bonus : C.line3}" stroke-width="2"/>
    ${mono(747, 548, 'BONUS', 25, { fill: C.ink2, anchor: 'middle', weight: 600, spacing: 0 })}
    ${mono(747, 584, `${bonus ? 1 : 0}/1`, 28, { fill: bonus ? C.ink : C.warn, anchor: 'middle', spacing: 0 })}
  `
}

function pickHeader(chosen, bonus = false, saving = false, saved = false, press = 0) {
  const spent = picks.slice(0, chosen).reduce((s, p) => s + p.price, 0)
  const left = 35 - spent
  const ready = chosen === 4
  return `
    <rect y="300" width="${W}" height="352" fill="${C.surface}"/>
    <line x1="0" y1="650" x2="${W}" y2="650" stroke="${C.line}" stroke-width="3"/>
    ${display(44, 350, 'MOTUL SPORTSCAR ENDURANCE GRAND PRIX', 29, { fill: C.muted, weight: 500, spacing: 3 })}
    ${mono(44, 414, '$35.0M', 55, { fill: C.ink, weight: 700, spacing: 0 })}
    ${sans(44, 463, `Spent $${spent.toFixed(1)}M`, 31, { fill: C.muted })}
    ${sans(558, 463, `$${left.toFixed(1)}M left`, 31, { fill: left === 0 ? C.success : C.success, anchor: 'end' })}
    <rect x="44" y="482" width="514" height="16" rx="8" fill="${C.line}"/>
    <rect x="44" y="482" width="${514 * spent / 35}" height="16" rx="8" fill="${C.success}"/>
    ${requirementPills(chosen, bonus)}
    <rect x="844" y="511" width="192" height="42" rx="8" fill="${C.surface2}" stroke="${C.line2}" stroke-width="2"/>
    <circle cx="866" cy="532" r="7" fill="${C.brand}"/>
    ${mono(884, 540, 'SAT 4:25 ET', 22, { fill: C.brand3, weight: 600, spacing: 0 })}
    <rect x="${844 + press * 5}" y="${565 + press * 4}" width="${192 - press * 10}" height="${64 - press * 8}" rx="8" fill="${ready ? C.brand : '#3a1614'}" opacity="${ready ? 1 : .6}"/>
    ${display(940, 608 + press * 2, saving ? 'SAVING…' : 'SAVE LINEUP', 31, { anchor: 'middle', weight: 700, italic: true, spacing: 1.5 })}
    ${saved ? `<rect y="651" width="${W}" height="70" fill="${C.success}" fill-opacity=".10"/>${sans(44, 698, 'Lineup saved.', 34, { fill: C.success })}` : ''}
  `
}

function emptySlot(i) {
  const cls = classes[i]
  const y = 810 + i * 235
  return `
    <g>
      ${mono(77, y + 47, cls.label, cls.label === 'GTD PRO' ? 22 : 26, { fill: cls.color, anchor: 'middle', weight: 700, spacing: 0 })}
      <rect x="111" y="${y + 66}" width="5" height="143" fill="${cls.color}"/>
      <rect x="143" y="${y}" width="893" height="205" rx="10" fill="none" stroke="${C.line3}" stroke-width="3" stroke-dasharray="14 12"/>
      <circle cx="210" cy="${y + 102}" r="29" fill="none" stroke="${cls.color}" stroke-width="4"/>
      <path d="M210 ${y + 86}v32M194 ${y + 102}h32" stroke="${cls.color}" stroke-width="4"/>
      ${display(265, y + 115, `ADD A ${cls.label} PICK`, 42, { fill: cls.color, weight: 700 })}
    </g>
  `
}

function pickCard(pick, i, local) {
  const y = 810 + i * 235
  const enter = easeOut(local / .42)
  const x = lerp(1120, 0, enter)
  const initialMap = {
    AITKEN: 'JA', BAMBER: 'EB', VESTI: 'FV',
    LUTKE: 'TL', BECHE: 'MB', HANSSON: 'DH',
    MILNER: 'TM', CATSBURG: 'NC',
    ANDREWS: 'SA', HODENIUS: 'LH', ROE: 'JR',
  }
  return `
    <g transform="translate(${x} 0)">
      ${mono(77, y + 47, pick.cls.label, pick.cls.label === 'GTD PRO' ? 22 : 26, { fill: pick.cls.color, anchor: 'middle', weight: 700, spacing: 0 })}
      <rect x="111" y="${y + 66}" width="5" height="143" fill="${pick.cls.color}" transform="skewX(-14)"/>
      <rect x="143" y="${y}" width="893" height="205" rx="10" fill="${C.surface2}" stroke="${C.line}" stroke-width="3"/>
      <rect x="173" y="${y + 37}" width="8" height="132" fill="${pick.cls.color}" transform="skewX(-14)"/>
      ${appCarThumb(205, y + 42, pick.cls.color, 220)}
      ${display(458, y + 69, `#${pick.number} ${pick.team}`, 43, { weight: 700 })}
      ${pick.drivers.map((driver, di) => {
        const ax = [480, 645, 840][di]
        return `${avatar(ax, y + 118, initialMap[driver] ?? driver.slice(0, 2))}${display(ax + 34, y + 126, driver, di === 2 ? 18 : 21, { fill: C.ink2, weight: 600 })}`
      }).join('')}
      ${mono(458, y + 178, `$${pick.price.toFixed(1)}M`, 34, { fill: C.ink2, spacing: 0 })}
      <circle cx="980" cy="${y + 102}" r="30" fill="${C.surface}" stroke="${C.line3}" stroke-width="3"/>
      <path d="M968 ${y + 90}l24 24M992 ${y + 90}l-24 24" stroke="${pick.cls.color}" stroke-width="4"/>
    </g>
  `
}

function boardEntry(pick, y, selected = false, pulse = 0) {
  const driverNames = pick.drivers.join(' · ')
  const driverSize = driverNames.length > 24 ? 17 : 20
  const title = `#${pick.number} ${pick.team}`
  const titleSize = title.length > 24 ? 27 : 34
  return `
    <rect x="44" y="${y}" width="992" height="150" fill="${selected ? `${C.success}0d` : C.surface3}" stroke="${selected ? C.success : C.line}" stroke-width="${selected ? 3 : 2}"/>
    ${appCarThumb(70, y + 29, pick.cls.color, 166)}
    <rect x="260" y="${y + 26}" width="78" height="35" rx="4" fill="${pick.cls.color}14" stroke="${pick.cls.color}66" stroke-width="2"/>
    ${mono(299, y + 51, pick.cls.label, 20, { fill: pick.cls.color, anchor: 'middle', weight: 700, spacing: 0 })}
    ${display(260, y + 96, title, titleSize, { weight: 700 })}
    ${display(260, y + 128, driverNames, driverSize, { fill: C.muted, weight: 600, spacing: .8 })}
    ${mono(864, y + 91, `$${pick.price.toFixed(1)}M`, 31, { fill: C.ink, anchor: 'end', weight: 700, spacing: 0 })}
    <circle cx="974" cy="${y + 75}" r="${31 - pulse * 4}" fill="${selected ? C.success : pulse > 0 ? C.ink2 : C.surface}" stroke="${selected ? C.success : pulse > 0 ? C.ink : C.line3}" stroke-width="3"/>
    <path d="${selected ? `M962 ${y + 75}h24` : `M974 ${y + 62}v26M961 ${y + 75}h26`}" stroke="${selected || pulse > 0 ? C.bg : C.ink2}" stroke-width="4"/>
  `
}

function generalPickScene(t) {
  const press = easeOut((t - .72) / .22) * (1 - easeOut((t - 1.08) / .2))
  return `
    <rect width="${W}" height="${H}" fill="${C.bg}"/>
    ${nav('HOME')}
    ${pickHeader(0)}
    <rect y="652" width="${W}" height="106" fill="${C.surface}"/>
    <rect x="44" y="674" width="480" height="64" rx="8" fill="${C.surface2}" stroke="${C.line3}" stroke-width="2"/>
    <rect x="44" y="733" width="480" height="5" fill="${C.brand}"/>
    ${display(284, 717, 'YOUR LINEUP', 31, { anchor: 'middle', weight: 700, spacing: 2 })}
    <rect x="${544 + press * 6}" y="${674 + press * 4}" width="${492 - press * 12}" height="${64 - press * 8}" rx="8" fill="${C.surface2}" stroke="${press > 0 ? C.ink2 : C.line2}" stroke-width="2"/>
    ${display(790, 717 + press * 2, 'ADD PICKS', 31, { fill: press > 0 ? C.ink : C.muted, anchor: 'middle', weight: 700, spacing: 2 })}
    ${tapMarker(790, 706, t - .62, C.ink)}
    <rect y="758" width="${W}" height="1162" fill="url(#generalPitGradient)"/>
    <defs>
      <linearGradient id="generalPitGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#15171a"/>
        <stop offset="1" stop-color="#0d0f11"/>
      </linearGradient>
    </defs>
    ${display(44, 796, 'YOUR PIT LANE', 31, { fill: C.muted, weight: 500, spacing: 4 })}
    ${emptySlot(0)}
    ${emptySlot(1)}
    ${emptySlot(2)}
    ${emptySlot(3)}
  `
}

function selectionScene(t) {
  const filtered = t >= .38
  const selecting = easeOut((t - 1.12) / .22) * (1 - easeOut((t - 1.48) / .24))
  const selected = t >= 1.34
  const board = [
    picks[0],
    { number: '93', team: 'ACURA MEYER SHANK RACING', cls: classes[0], price: 13.25, drivers: ['VAN DER ZANDE', 'YELLOLY'] },
    { number: '7', team: 'PORSCHE PENSKE MOTORSPORT', cls: classes[0], price: 12.5, drivers: ['NASR', 'ANDLAUER'] },
    { number: '6', team: 'PORSCHE PENSKE MOTORSPORT', cls: classes[0], price: 12, drivers: ['VANTHOOR', 'ESTRE'] },
  ]
  return `
    <rect width="${W}" height="${H}" fill="${C.bg}"/>
    ${nav('HOME')}
    ${pickHeader(selected ? 1 : 0)}
    <rect y="652" width="${W}" height="106" fill="${C.surface}"/>
    <rect x="44" y="674" width="480" height="64" rx="8" fill="${C.surface2}" stroke="${C.line2}" stroke-width="2"/>
    ${display(284, 717, 'YOUR LINEUP', 31, { fill: C.muted, anchor: 'middle', weight: 700, spacing: 2 })}
    <rect x="544" y="674" width="492" height="64" rx="8" fill="${C.surface2}" stroke="${C.line3}" stroke-width="2"/>
    <rect x="544" y="733" width="492" height="5" fill="${C.brand}"/>
    ${display(790, 717, 'ADD PICKS', 31, { anchor: 'middle', weight: 700, spacing: 2 })}

    <rect y="758" width="${W}" height="1162" fill="#0d0f11"/>
    ${display(44, 816, 'TEAMS', 33, { weight: 700, spacing: 2 })}
    ${mono(159, 814, '· 11 OF 54', 22, { spacing: 1 })}
    <rect x="44" y="844" width="992" height="66" rx="5" fill="${C.surface2}" stroke="${C.line2}" stroke-width="2"/>
    <circle cx="80" cy="877" r="12" fill="none" stroke="${C.muted}" stroke-width="3"/>
    <path d="M89 886l12 12" stroke="${C.muted}" stroke-width="3"/>
    ${sans(116, 888, 'Search teams…', 27, { fill: C.muted })}

    ${['ALL', 'GTP', 'LMP2', 'GTD PRO', 'GTD'].map((label, i) => {
      const widths = [110, 116, 132, 174, 116]
      const x = [44, 168, 298, 444, 632][i]
      const active = filtered ? label === 'GTP' : label === 'ALL'
      return `
        <rect x="${x}" y="932" width="${widths[i]}" height="58" rx="4" fill="${active ? C.surface2 : 'transparent'}" stroke="${active ? C.line3 : C.line2}" stroke-width="2"/>
        ${display(x + widths[i] / 2, 970, label, 25, { fill: active ? C.ink : C.muted, anchor: 'middle', weight: 600, spacing: 1 })}
        ${active ? `<rect x="${x}" y="986" width="${widths[i]}" height="4" fill="${C.brand}"/>` : ''}
      `
    }).join('')}

    ${display(44, 1041, 'SORT', 23, { fill: C.muted, weight: 500, spacing: 3 })}
    <rect x="132" y="1007" width="172" height="54" rx="4" fill="${C.surface2}" stroke="${C.line3}" stroke-width="2"/>
    ${display(218, 1043, 'PRICE ↓', 24, { anchor: 'middle', weight: 600, spacing: 1 })}
    ${pill(320, 1007, 'NUMBER', { stroke: C.line2, color: C.muted, width: 172 })}
    ${pill(508, 1007, 'NAME', { stroke: C.line2, color: C.muted, width: 142 })}

    ${board.map((pick, i) => boardEntry(pick, 1082 + i * 164, selected && i === 0, i === 0 ? selecting : 0)).join('')}
    ${tapMarker(226, 961, t - .18, C.brand)}
    ${tapMarker(974, 1157, t - 1.02, C.success)}
    ${mono(44, 1800, selected ? '// GTP PICK ADDED' : '// FILTER GTP · CHOOSE ONE TEAM', 27, { fill: selected ? C.success : C.muted, spacing: 3 })}
  `
}

function pickScene(t) {
  const starts = [-1, .24, 1.02, 1.8]
  const chosen = starts.filter((s) => t >= s).length
  let rows = ''
  for (let i = 0; i < 4; i += 1) {
    rows += t >= starts[i] ? pickCard(picks[i], i, t - starts[i]) : emptySlot(i)
  }
  const pickTaps = starts.slice(1).map((start, i) =>
    tapMarker(210, 810 + (i + 1) * 235 + 102, t - (start - .18), classes[i + 1].color)
  ).join('')
  return `
    <rect width="${W}" height="${H}" fill="${C.bg}"/>
    ${nav('HOME')}
    ${pickHeader(chosen)}
    <rect y="652" width="${W}" height="106" fill="${C.surface}"/>
    <rect x="44" y="674" width="480" height="64" rx="8" fill="${C.surface2}" stroke="${C.line3}" stroke-width="2"/>
    <rect x="44" y="733" width="480" height="5" fill="${C.brand}"/>
    ${display(284, 717, 'YOUR LINEUP', 31, { anchor: 'middle', weight: 700, spacing: 2 })}
    <rect x="544" y="674" width="492" height="64" rx="8" fill="${C.surface2}" stroke="${C.line2}" stroke-width="2"/>
    ${display(790, 717, 'ADD PICKS', 31, { fill: C.muted, anchor: 'middle', weight: 700, spacing: 2 })}
    <rect y="758" width="${W}" height="1162" fill="url(#pitGradient)"/>
    <defs>
      <linearGradient id="pitGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#15171a"/>
        <stop offset="1" stop-color="#0d0f11"/>
      </linearGradient>
    </defs>
    ${display(44, 796, 'YOUR PIT LANE', 31, { fill: C.muted, weight: 500, spacing: 4 })}
    ${rows}
    ${pickTaps}
  `
}

function bonusScene(t) {
  const selected = t >= .8
  const pressed = t >= 2.15
  const saved = t >= 2.62
  const saveShift = 70 * easeOut((t - 2.62) / .3)
  const pulse = easeOut((t - .72) / .3) * (1 - easeOut((t - 1.2) / .35))
  const savePress = easeOut((t - 2.08) / .12) * (1 - easeOut((t - 2.34) / .16))
  const chip = (x, y, label, active = false, width = 220) => `
    <rect x="${x + pulse * (active ? 4 : 0)}" y="${y + pulse * (active ? 3 : 0)}" width="${width - pulse * (active ? 8 : 0)}" height="${64 - pulse * (active ? 6 : 0)}" rx="8"
      fill="${active ? `${C.bonus}1f` : 'transparent'}" stroke="${active ? C.bonus : C.line3}" stroke-width="3"/>
    ${display(x + width / 2, y + 42, label, 30, { fill: active ? C.ink : C.muted, anchor: 'middle', weight: 600 })}
  `
  return `
    <rect width="${W}" height="${H}" fill="${C.bg}"/>
    ${nav('HOME')}
    ${pickHeader(4, selected, pressed && !saved, saved, savePress)}
    ${tapMarker(940, 597, t - 2.02, C.ink)}
    <rect y="${652 + saveShift}" width="${W}" height="${1268 - saveShift}" fill="url(#pitGradientBonus)"/>
    <defs>
      <linearGradient id="pitGradientBonus" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#15171a"/>
        <stop offset="1" stop-color="#0d0f11"/>
      </linearGradient>
    </defs>
    <g transform="translate(0 ${saveShift})">
      <rect x="44" y="714" width="992" height="946" rx="10" fill="${C.surface3}" stroke="${C.line}" stroke-width="3"/>
      <path d="M95 760l-22 44h27l-8 39 49-62h-30l18-21z" fill="${C.bonus}"/>
      ${display(164, 807, 'BONUSES', 42, { weight: 700, spacing: 1.5 })}
      <rect x="88" y="866" width="904" height="694" rx="10" fill="${C.surface2}" stroke="${C.line2}" stroke-width="3"/>
      ${display(132, 933, 'DOUBLE POINTS TEAM', 39, { weight: 700, spacing: 1 })}
      ${sans(132, 988, 'One of your teams scores double.', 30, { fill: C.muted })}
      ${chip(132, 1055, '#31 CADILLAC WHELEN', selected, 360)}
      ${tapMarker(312, 1087, t - .62, C.bonus)}
      ${chip(516, 1055, '#11 TDS RACING', false, 290)}
      ${chip(132, 1140, '#62 RISI COMPETIZIONE', false, 330)}
      ${chip(486, 1140, '#80 LONE STAR RACING', false, 360)}
      ${selected ? `
        <rect x="132" y="1265" width="816" height="116" rx="8" fill="${C.bonus}" fill-opacity=".10" stroke="${C.bonus}" stroke-width="2"/>
        ${display(540, 1337, 'DOUBLE POINTS TEAM → #31', 36, { fill: C.ink, anchor: 'middle', weight: 700 })}
      ` : ''}
      ${mono(44, 1744, saved ? '// LINEUP CONFIRMED' : '// SELECT ONE TEAM · SAVE LINEUP', 29, { fill: saved ? C.success : C.muted, spacing: 4 })}
    </g>
  `
}

function endScene(t) {
  const a = easeOut(t / .45)
  const cta = easeOut((t - .55) / .45)
  return `
    <rect width="${W}" height="${H}" fill="${C.bg}"/>
    <rect width="${W}" height="10" fill="${C.brand}"/>
    <g opacity="${a}">
      ${wordmark(64, 270, 1.48)}
      <rect x="64" y="356" width="952" height="3" fill="${C.line}"/>
      ${display(64, 510, 'PICK YOUR TEAM.', 94, { fill: C.ink2, weight: 700 })}
      ${display(64, 598, 'SCORE POINTS AS', 94, { fill: C.ink2, weight: 700 })}
      ${display(64, 704, 'THEY RACE.', 104, { weight: 800 })}

      ${mono(64, 886, '// HOW_IT_WORKS', 30, { spacing: 4 })}
      ${display(64, 972, 'PICK', 40, { weight: 700, spacing: 4 })}
      ${sans(248, 972, 'Teams and Drivers within the salary cap', 31)}
      ${display(64, 1056, 'LOCK', 40, { weight: 700, spacing: 4 })}
      ${sans(248, 1056, 'Finalize your picks before qualifying starts', 31)}
      ${display(64, 1140, 'SCORE', 40, { weight: 700, spacing: 4 })}
      ${sans(248, 1140, 'You score points when your picks score points', 31)}

      <rect x="64" y="1294" width="952" height="126" rx="8" fill="${C.brand}" opacity="${cta}"/>
      ${display(540, 1375, 'SIGN IN TO PLAY', 47, { anchor: 'middle', weight: 700, italic: true, spacing: 3, opacity: cta })}
      ${mono(64, 1538, 'FANTASY.ARJUNAKANKIPATI.COM', 30, { spacing: 2.5, opacity: cta })}
      <rect x="64" y="1610" width="952" height="3" fill="${C.line}"/>
      ${mono(64, 1705, '2026 SEASON', 28, { spacing: 4, opacity: cta })}
      ${mono(1016, 1705, 'ENDURANCE FANTASY', 28, { anchor: 'end', spacing: 4, opacity: cta })}
    </g>
  `
}

function frameSvg(frame) {
  const t = frame / FPS
  let body
  if (t < 2.4) body = landingScene(t)
  else if (t < 3.7) body = generalPickScene(t - 2.4)
  else if (t < 5.8) body = selectionScene(t - 3.7)
  else if (t < 8.7) body = pickScene(t - 5.8)
  else if (t < 12.6) body = bonusScene(t - 8.7)
  else body = endScene(t - 12.6)
  const cuts = [2.4, 3.7, 5.8, 8.7, 12.6]
  const flash = cuts.reduce((m, cut) => Math.max(m, clamp(1 - Math.abs(t - cut) / .055)), 0)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${body}
    <rect width="${W}" height="${H}" fill="${C.ink}" opacity="${flash * .16}"/>
  </svg>`
}

const b64 = (name) => fs.readFileSync(path.join(FONTS, name)).toString('base64')
const fontCss = `
  @font-face { font-family:'Saira'; src:url(data:font/woff2;base64,${b64('saira-variable.woff2')}) format('woff2'); font-style:normal; font-weight:400 700; }
  @font-face { font-family:'Spline Sans Mono'; src:url(data:font/woff2;base64,${b64('spline-sans-mono-variable.woff2')}) format('woff2'); font-style:normal; font-weight:400 700; }
  @font-face { font-family:'Saira Semi Condensed'; src:url(data:font/woff2;base64,${b64('saira-semi-condensed-500.woff2')}) format('woff2'); font-style:normal; font-weight:500; }
  @font-face { font-family:'Saira Semi Condensed'; src:url(data:font/woff2;base64,${b64('saira-semi-condensed-600.woff2')}) format('woff2'); font-style:normal; font-weight:600; }
  @font-face { font-family:'Saira Semi Condensed'; src:url(data:font/woff2;base64,${b64('saira-semi-condensed-700.woff2')}) format('woff2'); font-style:normal; font-weight:700; }
  @font-face { font-family:'Saira Semi Condensed'; src:url(data:font/woff2;base64,${b64('saira-semi-condensed-800.woff2')}) format('woff2'); font-style:normal; font-weight:800; }
  html,body,#stage { margin:0; width:${W}px; height:${H}px; overflow:hidden; background:${C.bg}; }
  svg { display:block; text-rendering:geometricPrecision; }
`

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
})
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await page.setContent(`<style>${fontCss}</style><div id="stage"></div>`)
await page.evaluate(() => document.fonts.ready)

let previousSvg = null
let previousFramePath = null
for (let frame = 0; frame < FPS * DURATION; frame += 1) {
  const svg = frameSvg(frame)
  const framePath = path.join(FRAMES, `${String(frame).padStart(4, '0')}.png`)
  if (svg === previousSvg && previousFramePath) {
    fs.copyFileSync(previousFramePath, framePath)
    previousFramePath = framePath
    continue
  }
  await page.evaluate((markup) => { document.querySelector('#stage').innerHTML = markup }, svg)
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  }))
  await page.screenshot({
    path: framePath,
    type: 'png',
    animations: 'disabled',
  })
  previousSvg = svg
  previousFramePath = framePath
}
await browser.close()

// Original UI sound design: low pulse + click confirmations + end sting.
const sampleRate = 48000
const samples = sampleRate * DURATION
const pcm = Buffer.alloc(samples * 4)
const hits = [0.05, 1, 2.05, 2.4, 3.12, 3.7, 4.08, 4.82, 5.04, 5.8, 6.04, 6.82, 7.6, 8.7, 9.5, 10.85, 11.32, 12.6]
for (let i = 0; i < samples; i += 1) {
  const t = i / sampleRate
  let v = .012 * Math.sin(2 * Math.PI * 55 * t) * (.3 + .7 * Math.pow(Math.max(0, Math.sin(2 * Math.PI * 2 * t)), 10))
  for (const hit of hits) {
    const dt = t - hit
    if (dt >= 0 && dt < .16) {
      const env = Math.exp(-dt * 31)
      v += .055 * env * Math.sin(2 * Math.PI * 720 * dt)
      v += .023 * env * Math.sin(2 * Math.PI * 94 * dt)
    }
  }
  if (t > 12.6 && t < 14.7) {
    const dt = t - 12.6
    const env = Math.min(1, dt * 3) * Math.min(1, (14.7 - t) * 2)
    v += .025 * env * Math.sin(2 * Math.PI * (180 + dt * 65) * dt)
  }
  const s = Math.max(-1, Math.min(1, v * 3))
  const n = Math.round(s * 32767)
  pcm.writeInt16LE(n, i * 4)
  pcm.writeInt16LE(n, i * 4 + 2)
}

const wav = Buffer.alloc(44 + pcm.length)
wav.write('RIFF', 0)
wav.writeUInt32LE(36 + pcm.length, 4)
wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(2, 22)
wav.writeUInt32LE(sampleRate, 24)
wav.writeUInt32LE(sampleRate * 4, 28)
wav.writeUInt16LE(4, 32)
wav.writeUInt16LE(16, 34)
wav.write('data', 36)
wav.writeUInt32LE(pcm.length, 40)
pcm.copy(wav, 44)
fs.writeFileSync(path.join(OUTPUT, 'sound-design.wav'), wav)

const videoOnly = path.join(OUTPUT, 'video-only.mp4')
const finalVideo = path.join(OUTPUT, 'endurance-fantasy-promo-vertical.mp4')
const poster = path.join(OUTPUT, 'endurance-fantasy-promo-poster.png')

const encode = spawnSync('ffmpeg', [
  '-y', '-framerate', String(FPS), '-i', path.join(FRAMES, '%04d.png'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1',
  '-crf', '18', '-movflags', '+faststart', videoOnly,
], { stdio: 'inherit' })
if (encode.status !== 0) process.exit(encode.status ?? 1)

const mux = spawnSync('ffmpeg', [
  '-y', '-i', videoOnly, '-i', path.join(OUTPUT, 'sound-design.wav'),
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', finalVideo,
], { stdio: 'inherit' })
if (mux.status !== 0) process.exit(mux.status ?? 1)

fs.copyFileSync(path.join(FRAMES, `${String(Math.floor(13.5 * FPS)).padStart(4, '0')}.png`), poster)
console.log(`Rendered ${finalVideo}`)
console.log(`Poster ${poster}`)
