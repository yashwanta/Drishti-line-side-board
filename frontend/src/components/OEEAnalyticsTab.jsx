import React, { useState, useMemo } from 'react'
import { api } from '../api/client'

// ── Data extracted from Assembly OEE 2026.xlsx ─────────────────────────────────
const STATION_OEE = [
  { cell: 'Autotool_Spot',  oee: 66.0, parts: 208,  time: 420,  toolDT: 20,  maintDT: 60,  prodDT: 0,  matDT: 0,  qualDT: 30, mDTpct: 14.3, tDTpct: 4.8,  jph: 29.7,  program: 'P42', customer: 'Nissan' },
  { cell: 'Ball_Stud',      oee: 77.6, parts: 1494, time: 610,  toolDT: 0,   maintDT: 0,   prodDT: 28, matDT: 0,  qualDT: 0,  mDTpct: 0.0,  tDTpct: 0.0,  jph: 147.0, program: 'P42', customer: 'Nissan' },
  { cell: 'Bolt_Press',     oee: 81.4, parts: 1391, time: 410,  toolDT: 0,   maintDT: 15,  prodDT: 11, matDT: 0,  qualDT: 0,  mDTpct: 3.7,  tDTpct: 0.0,  jph: 203.6, program: 'P42', customer: 'Nissan' },
  { cell: 'Cell_200',       oee: 88.2, parts: 215,  time: 195,  toolDT: 0,   maintDT: 0,   prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 0.0,  tDTpct: 0.0,  jph: 66.2,  program: 'P33', customer: 'Nissan' },
  { cell: 'Cell_300',       oee: 87.9, parts: 385,  time: 460,  toolDT: 0,   maintDT: 20,  prodDT: 6,  matDT: 4,  qualDT: 10, mDTpct: 4.3,  tDTpct: 0.0,  jph: 50.2,  program: 'P33', customer: 'Nissan' },
  { cell: 'Cell_500_LH',   oee: 91.9, parts: 342,  time: 475,  toolDT: 0,   maintDT: 0,   prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 0.0,  tDTpct: 0.0,  jph: 43.2,  program: 'P33', customer: 'Nissan' },
  { cell: 'Cell_500_RH',   oee: 90.6, parts: 337,  time: 475,  toolDT: 0,   maintDT: 7,   prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 1.5,  tDTpct: 0.0,  jph: 42.6,  program: 'P33', customer: 'Nissan' },
  { cell: 'Cell_600',       oee: 90.5, parts: 381,  time: 470,  toolDT: 0,   maintDT: 0,   prodDT: 0,  matDT: 5,  qualDT: 0,  mDTpct: 0.0,  tDTpct: 0.0,  jph: 48.6,  program: 'P33', customer: 'Nissan' },
  { cell: 'Cell_610',       oee: 84.2, parts: 328,  time: 435,  toolDT: 0,   maintDT: 20,  prodDT: 8,  matDT: 0,  qualDT: 0,  mDTpct: 4.6,  tDTpct: 0.0,  jph: 45.2,  program: 'P33', customer: 'Nissan' },
  { cell: 'Cell_700',       oee: 89.6, parts: 381,  time: 475,  toolDT: 0,   maintDT: 50,  prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 10.5, tDTpct: 0.0,  jph: 48.1,  program: 'P33', customer: 'Nissan' },
  { cell: 'Cell_800',       oee: 87.0, parts: 568,  time: 870,  toolDT: 0,   maintDT: 80,  prodDT: 10, matDT: 0,  qualDT: 0,  mDTpct: 9.2,  tDTpct: 0.0,  jph: 39.2,  program: 'P33', customer: 'Hopkinsville' },
  { cell: 'Cell_900',       oee: 93.7, parts: 603,  time: 435,  toolDT: 0,   maintDT: 8,   prodDT: 9,  matDT: 0,  qualDT: 0,  mDTpct: 1.8,  tDTpct: 0.0,  jph: 83.2,  program: 'P42', customer: 'Hopkinsville' },
  { cell: 'CL_Spot',        oee: 90.6, parts: 602,  time: 790,  toolDT: 20,  maintDT: 15,  prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 1.9,  tDTpct: 2.5,  jph: 45.7,  program: 'P42', customer: 'Hopkinsville' },
  { cell: 'Laser_2',        oee: 76.3, parts: 447,  time: 840,  toolDT: 0,   maintDT: 0,   prodDT: 7,  matDT: 0,  qualDT: 0,  mDTpct: 0.0,  tDTpct: 0.0,  jph: 31.9,  program: 'P42', customer: 'Nissan' },
  { cell: 'Laser_7',        oee: 92.8, parts: 540,  time: 950,  toolDT: 0,   maintDT: 0,   prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 0.0,  tDTpct: 0.0,  jph: 34.1,  program: 'P42', customer: 'Nissan' },
  { cell: 'Laser_9',        oee: 93.5, parts: 236,  time: 526,  toolDT: 0,   maintDT: 34,  prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 6.5,  tDTpct: 0.0,  jph: 26.9,  program: 'P42', customer: 'Nissan' },
  { cell: 'Legacy_Battery', oee: 72.1, parts: 624,  time: 310,  toolDT: 0,   maintDT: 22,  prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 7.1,  tDTpct: 0.0,  jph: 120.8, program: 'P42', customer: 'Nissan' },
  { cell: 'Legacy_Cowl',    oee: 94.2, parts: 427,  time: 408,  toolDT: 0,   maintDT: 10,  prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 2.5,  tDTpct: 0.0,  jph: 62.8,  program: 'P42', customer: 'Nissan' },
  { cell: 'Mecsmart',       oee: 85.3, parts: 2200, time: 430,  toolDT: 0,   maintDT: 12,  prodDT: 12, matDT: 0,  qualDT: 0,  mDTpct: 2.8,  tDTpct: 0.0,  jph: 307.0, program: 'P42', customer: 'Nissan' },
  { cell: 'P33_Autotool_LH',oee: 92.7, parts: 774,  time: 395,  toolDT: 0,   maintDT: 6,   prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 1.5,  tDTpct: 0.0,  jph: 117.6, program: 'P42', customer: 'Nissan' },
  { cell: 'P33_Autotool_RH',oee: 93.4, parts: 820,  time: 410,  toolDT: 0,   maintDT: 6,   prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 1.5,  tDTpct: 0.0,  jph: 120.0, program: 'P42', customer: 'Nissan' },
  { cell: 'P33_Nut_Farm_1', oee: 70.2, parts: 1491, time: 425,  toolDT: 0,   maintDT: 107, prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 25.2, tDTpct: 0.0,  jph: 210.5, program: 'P42', customer: 'Nissan' },
  { cell: 'P33_Nut_Farm_2', oee: 89.8, parts: 1205, time: 425,  toolDT: 0,   maintDT: 0,   prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 0.0,  tDTpct: 0.0,  jph: 170.1, program: 'P42', customer: 'Nissan' },
  { cell: 'P33_Nut_Farm_3', oee: 95.3, parts: 838,  time: 425,  toolDT: 0,   maintDT: 0,   prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 0.0,  tDTpct: 0.0,  jph: 118.3, program: 'P42', customer: 'Nissan' },
  { cell: 'P33_Nut_Farm_4', oee: 95.2, parts: 4048, time: 425,  toolDT: 0,   maintDT: 25,  prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 5.9,  tDTpct: 0.0,  jph: 571.5, program: 'P42', customer: 'Nissan' },
  { cell: 'P42_Nut_Farm_1', oee: 84.8, parts: 1138, time: 425,  toolDT: 0,   maintDT: 22,  prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 5.2,  tDTpct: 0.0,  jph: 160.7, program: 'P42', customer: 'Nissan' },
  { cell: 'P42_Nut_Farm_2', oee: 93.3, parts: 1876, time: 305,  toolDT: 0,   maintDT: 26,  prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 8.5,  tDTpct: 0.0,  jph: 369.0, program: 'P42', customer: 'Nissan' },
  { cell: 'P42_Nut_Farm_3', oee: 66.7, parts: 1340, time: 425,  toolDT: 0,   maintDT: 100, prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 23.5, tDTpct: 0.0,  jph: 189.2, program: 'P42', customer: 'Nissan' },
  { cell: 'P42_Nut_Farm_4', oee: 75.5, parts: 1765, time: 425,  toolDT: 0,   maintDT: 16,  prodDT: 0,  matDT: 0,  qualDT: 7,  mDTpct: 3.8,  tDTpct: 0.0,  jph: 249.2, program: 'P42', customer: 'Nissan' },
  { cell: 'P42_Spot_NF_1',  oee: 79.0, parts: 295,  time: 420,  toolDT: 0,   maintDT: 23,  prodDT: 0,  matDT: 25, qualDT: 0,  mDTpct: 5.5,  tDTpct: 0.0,  jph: 42.1,  program: 'P42', customer: 'Nissan' },
  { cell: 'P42_Spot_NF_2',  oee: 58.0, parts: 534,  time: 460,  toolDT: 0,   maintDT: 95,  prodDT: 16, matDT: 43, qualDT: 0,  mDTpct: 20.7, tDTpct: 0.0,  jph: 69.7,  program: 'P42', customer: 'Nissan' },
  { cell: 'P42_Spot_NF_3',  oee: 76.3, parts: 738,  time: 430,  toolDT: 0,   maintDT: 31,  prodDT: 0,  matDT: 30, qualDT: 0,  mDTpct: 7.2,  tDTpct: 0.0,  jph: 103.0, program: 'P42', customer: 'Nissan' },
  { cell: 'P42_Spot_NF_4',  oee: 69.5, parts: 522,  time: 413,  toolDT: 0,   maintDT: 50,  prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 12.1, tDTpct: 0.0,  jph: 75.8,  program: 'P42', customer: 'Nissan' },
  { cell: 'Pierce_Nut',     oee: 86.3, parts: 887,  time: 425,  toolDT: 0,   maintDT: 0,   prodDT: 11, matDT: 0,  qualDT: 0,  mDTpct: 0.0,  tDTpct: 0.0,  jph: 125.2, program: 'P42', customer: 'Nissan' },
  { cell: 'Prodomax_100',   oee: 86.8, parts: 487,  time: 360,  toolDT: 0,   maintDT: 10,  prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 2.8,  tDTpct: 0.0,  jph: 81.2,  program: 'P42', customer: 'Hopkinsville' },
  { cell: 'Rivet',          oee: 80.0, parts: 724,  time: 418,  toolDT: 0,   maintDT: 14,  prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 3.3,  tDTpct: 0.0,  jph: 103.9, program: 'P42', customer: 'Nissan' },
  { cell: 'Rivet_7_LH',    oee: 98.5, parts: 732,  time: 425,  toolDT: 0,   maintDT: 0,   prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 0.0,  tDTpct: 0.0,  jph: 103.3, program: 'P33', customer: 'Nissan' },
  { cell: 'Rivet_7_RH',    oee: 98.5, parts: 732,  time: 425,  toolDT: 0,   maintDT: 0,   prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 0.0,  tDTpct: 0.0,  jph: 103.3, program: 'P33', customer: 'Nissan' },
  { cell: 'Stiffener',      oee: 88.4, parts: 469,  time: 860,  toolDT: 0,   maintDT: 0,   prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 0.0,  tDTpct: 0.0,  jph: 32.7,  program: 'P42', customer: 'Nissan' },
  { cell: 'Transit_A',      oee: 94.0, parts: 512,  time: 615,  toolDT: 0,   maintDT: 0,   prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 0.0,  tDTpct: 0.0,  jph: 50.0,  program: 'V363', customer: 'Ford' },
  { cell: 'Transit_B',      oee: 87.0, parts: 371,  time: 382,  toolDT: 0,   maintDT: 5,   prodDT: 6,  matDT: 0,  qualDT: 0,  mDTpct: 1.3,  tDTpct: 0.0,  jph: 58.3,  program: 'V363', customer: 'Ford' },
  { cell: 'Weld_10',        oee: 80.0, parts: 1275, time: 425,  toolDT: 0,   maintDT: 0,   prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 0.0,  tDTpct: 0.0,  jph: 180.0, program: 'P42', customer: 'Nissan' },
  { cell: 'Weld_11',        oee: 81.6, parts: 439,  time: 340,  toolDT: 0,   maintDT: 24,  prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 7.1,  tDTpct: 0.0,  jph: 77.5,  program: 'P33', customer: 'Nissan' },
  { cell: 'Weld_6',         oee: 92.8, parts: 2440, time: 790,  toolDT: 0,   maintDT: 50,  prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 6.3,  tDTpct: 0.0,  jph: 185.3, program: 'P42', customer: 'Nissan' },
  { cell: 'Weld_9',         oee: 75.8, parts: 1167, time: 445,  toolDT: 0,   maintDT: 65,  prodDT: 0,  matDT: 0,  qualDT: 0,  mDTpct: 14.6, tDTpct: 0.0,  jph: 157.3, program: 'P33', customer: 'Hopkinsville' },
]

// ── Operator performance (from operator pivot sheets — Semiko, Jasmine, etc.) ──
const OPERATOR_DATA = [
  { operator: 'Semiko',  oee: 75.4, parts: 9158,  timeMin: 9300,  maintDT: 525, prodDT: 142, mDTpct: 7.3 },
  { operator: 'Jasmine', oee: 82.1, parts: 7420,  timeMin: 7680,  maintDT: 310, prodDT: 88,  mDTpct: 4.9 },
  { operator: 'Tamela',  oee: 79.8, parts: 6810,  timeMin: 7200,  maintDT: 418, prodDT: 60,  mDTpct: 5.8 },
  { operator: 'Sharon',  oee: 83.6, parts: 8240,  timeMin: 8160,  maintDT: 265, prodDT: 72,  mDTpct: 3.2 },
  { operator: 'Tenesia', oee: 78.2, parts: 5930,  timeMin: 6480,  maintDT: 390, prodDT: 95,  mDTpct: 6.0 },
  { operator: 'Timothy', oee: 86.0, parts: 9870,  timeMin: 9600,  maintDT: 180, prodDT: 45,  mDTpct: 1.9 },
  { operator: 'Kita',    oee: 81.3, parts: 7150,  timeMin: 7200,  maintDT: 340, prodDT: 110, mDTpct: 4.7 },
  { operator: 'Mathis',  oee: 77.9, parts: 6420,  timeMin: 6960,  maintDT: 460, prodDT: 78,  mDTpct: 6.6 },
  { operator: 'Jada',    oee: 84.5, parts: 8650,  timeMin: 8640,  maintDT: 195, prodDT: 52,  mDTpct: 2.3 },
  { operator: 'Tora',    oee: 80.7, parts: 7090,  timeMin: 7440,  maintDT: 385, prodDT: 66,  mDTpct: 5.2 },
]

// ── Program & Customer aggregates (Pivot sheet) ────────────────────────────────
const PROGRAM_DATA = [
  { program: 'P33',   oee: 83.7, parts: 255497, stations: 14, topStation: 'P33_Nut_Farm_3', topOEE: 95.3 },
  { program: 'P42',   oee: 85.9, parts: 523212, stations: 28, topStation: 'Legacy_Cowl',    topOEE: 94.2 },
  { program: 'V363',  oee: 77.9, parts: 62580,  stations: 3,  topStation: 'Transit_A',      topOEE: 94.0 },
  { program: 'VW416', oee: 73.9, parts: 168541, stations: 2,  topStation: 'Cell_200',       topOEE: 88.2 },
  { program: 'WS',    oee: 81.4, parts: 188624, stations: 3,  topStation: 'Laser_8_RH',     topOEE: 80.3 },
]

const CUSTOMER_DATA = [
  { customer: 'Nissan',       parts: 10404100, fg: 7596441, wip: 2807659, oee: 86.1, color: '#00d4ff' },
  { customer: 'Hopkinsville', parts: 3301347,  fg: 3301347, wip: 0,       oee: 84.7, color: '#00ff88' },
  { customer: 'Ford',         parts: 523212,   fg: 255497,  wip: 267715,  oee: 77.9, color: '#a78bfa' },
  { customer: 'Stellantis',   parts: 188624,   fg: 188624,  wip: 0,       oee: 81.4, color: '#fb923c' },
  { customer: 'VW',           parts: 168541,   fg: 168541,  wip: 0,       oee: 73.9, color: '#ffaa00' },
]

// Top downtime issues (from INPUT sheet analysis)
const TOP_ISSUES = [
  { issue: 'Electrode Change',       type: 'Maintenance', mins: 263, count: 8 },
  { issue: 'Gun Over Travel',        type: 'Tooling',     mins: 231, count: 6 },
  { issue: 'Weld Adjustment',        type: 'Maintenance', mins: 192, count: 5 },
  { issue: 'Robot Fault',            type: 'Maintenance', mins: 175, count: 4 },
  { issue: 'Stand Down Meeting',     type: 'Production',  mins: 168, count: 12 },
  { issue: 'Weld Fault',             type: 'Maintenance', mins: 116, count: 3 },
  { issue: 'Waiting on Forklift',    type: 'Production',  mins: 82,  count: 5 },
  { issue: 'Nut Feeder Fault',       type: 'Maintenance', mins: 76,  count: 2 },
  { issue: 'Sensor Fault',           type: 'Maintenance', mins: 68,  count: 2 },
  { issue: 'Stud Feeder Fault',      type: 'Maintenance', mins: 65,  count: 1 },
  { issue: 'Mandrel Change',         type: 'Tooling',     mins: 58,  count: 2 },
  { issue: 'Water Flow Fault',       type: 'Maintenance', mins: 45,  count: 1 },
]

// Monthly parts produced (top stations, Jan 2025 – Jun 2026)
const MONTHLY_DATA = {
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', "Jan'26", "Feb'26", "Mar'26", "Apr'26", "May'26", "Jun'26"],
  stations: [
    { cell: 'Autotool_Spot', values: [4534,6636,7992,6609,5888,5663,8126,8191,7486,8651,5180,4993,1757,6480,3382,5125,3495,null] },
    { cell: 'Cell_800',      values: [3650,4990,6615,3890,5605,4677,4921,4502,5452,8186,4147,4132,2747,5702,4155,2003,1864,null] },
    { cell: 'CL_Spot',       values: [2670,5643,6934,5797,5123,5033,2493,1990,2159,2301,1889,1704,1322,1681,2752,1612,1763,null] },
    { cell: 'Weld_6',        values: [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null] },
    { cell: 'Mecsmart',      values: [3478,2921,3100,2379,2399,1987,2360,2363,2708,5589,2531,1467,1027,2725,2277,2194,1451,null] },
    { cell: 'Legacy_Cowl',   values: [2499,3187,6021,4635,2312,1802,3067,3528,2993,4054,2864,2443,1034,3124,2500,2611,2343,null] },
  ],
}

// ── Colour helpers ─────────────────────────────────────────────────────────────
const OEE_TARGET = 85
function oeeColor(v) {
  if (v >= OEE_TARGET) return '#00ff88'
  if (v >= 75) return '#ffaa00'
  return '#ff4444'
}
const DT_COLORS = {
  Tooling:     '#a78bfa',
  Maintenance: '#ff4444',
  Production:  '#ffaa00',
  Materials:   '#00d4ff',
  Quality:     '#fb923c',
}

// ── Mini horizontal bar ────────────────────────────────────────────────────────
export function Bar({ pct, color, height = 6 }) {
  return (
    <div style={{ height, background: '#21262d', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
    </div>
  )
}

// ── OEE gauge ring (pure CSS) ──────────────────────────────────────────────────
export function OEEGauge({ value, size = 110, label }) {
  const color = oeeColor(value)
  const deg = (value / 100) * 360
  const bg = `conic-gradient(${color} 0deg ${deg}deg, #21262d ${deg}deg 360deg)`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 24px ${color}33`,
      }}>
        <div style={{
          width: size - 20, height: size - 20, borderRadius: '50%',
          background: '#0d1117',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontFamily: 'monospace', fontSize: size > 90 ? 22 : 16, fontWeight: 800, color, lineHeight: 1 }}>
            {value.toFixed(1)}%
          </div>
          {size > 90 && <div style={{ fontSize: 9, color: '#6e7681', letterSpacing: 1 }}>OEE</div>}
        </div>
      </div>
      {label && <div style={{ fontSize: 11, color: '#8b949e', textAlign: 'center' }}>{label}</div>}
    </div>
  )
}

// ── Station table row ──────────────────────────────────────────────────────────
function StationRow({ s, idx, onSelect }) {
  const totalDT = s.toolDT + s.maintDT + s.prodDT + s.matDT + s.qualDT
  const dtPct = s.time > 0 ? (totalDT / s.time) * 100 : 0
  const color = oeeColor(s.oee)
  return (
    <tr onClick={() => onSelect(s)} title={`View ${s.cell} details`} style={{ background: idx % 2 === 0 ? '#0d1117' : '#161b2280', cursor: 'pointer' }}>
      <td style={TD}><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#00d4ff' }}>{s.cell}</span></td>
      <td style={TD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 800, color, width: 48 }}>{s.oee.toFixed(1)}%</span>
          <Bar pct={s.oee} color={color} height={5} />
          {s.oee >= OEE_TARGET
            ? <span style={{ fontSize: 10, color: '#00ff88' }}>✓</span>
            : <span style={{ fontSize: 10, color: '#ff4444' }}>✗</span>}
        </div>
      </td>
      <td style={{ ...TD, fontFamily: 'monospace', textAlign: 'right' }}>{s.parts.toLocaleString()}</td>
      <td style={{ ...TD, fontFamily: 'monospace', textAlign: 'right', color: '#a78bfa' }}>{s.jph.toFixed(1)}</td>
      <td style={TD}>
        <DTPills tooling={s.toolDT} maint={s.maintDT} prod={s.prodDT} mat={s.matDT} qual={s.qualDT} />
      </td>
      <td style={{ ...TD, fontFamily: 'monospace', fontSize: 11, color: dtPct > 15 ? '#ff4444' : dtPct > 5 ? '#ffaa00' : '#6e7681' }}>
        {dtPct.toFixed(1)}%
      </td>
      <td style={{ ...TD, fontSize: 11, color: '#6e7681' }}>{s.program}</td>
      <td style={{ ...TD, fontSize: 11, color: '#6e7681' }}>{s.customer}</td>
    </tr>
  )
}

function DTPills({ tooling, maint, prod, mat, qual }) {
  const items = [
    { label: 'T', val: tooling, color: DT_COLORS.Tooling },
    { label: 'M', val: maint,   color: DT_COLORS.Maintenance },
    { label: 'P', val: prod,    color: DT_COLORS.Production },
    { label: 'L', val: mat,     color: DT_COLORS.Materials },
    { label: 'Q', val: qual,    color: DT_COLORS.Quality },
  ].filter(i => i.val > 0)
  if (!items.length) return <span style={{ fontSize: 10, color: '#6e7681' }}>—</span>
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {items.map(({ label, val, color }) => (
        <span key={label} style={{
          fontSize: 10, padding: '1px 5px', borderRadius: 4,
          background: `${color}20`, color, border: `1px solid ${color}44`,
          fontFamily: 'monospace', fontWeight: 700,
        }} title={label === 'T' ? `Tooling: ${val}min` : label === 'M' ? `Maint: ${val}min` : label === 'P' ? `Prod: ${val}min` : label === 'L' ? `Materials: ${val}min` : `Quality: ${val}min`}>
          {label}:{val}
        </span>
      ))}
    </div>
  )
}

const TH = {
  background: '#161b22', color: '#8b949e', fontWeight: 700, fontSize: 10,
  letterSpacing: 1.5, textTransform: 'uppercase', padding: '9px 12px',
  textAlign: 'left', borderBottom: '1px solid #21262d', whiteSpace: 'nowrap',
  cursor: 'pointer', userSelect: 'none',
}
const TD = { padding: '9px 12px', borderBottom: '1px solid #21262d16', color: '#e6edf3', fontSize: 12 }

// ── Monthly sparkline ──────────────────────────────────────────────────────────
function Sparkline({ values, color = '#00d4ff' }) {
  const valid = values.filter(v => v != null)
  if (!valid.length) return <span style={{ color: '#6e7681', fontSize: 10 }}>—</span>
  const max = Math.max(...valid)
  const w = 80, h = 24
  const pts = values.map((v, i) => {
    if (v == null) return null
    const x = (i / (values.length - 1)) * w
    const y = h - (v / max) * h
    return `${x},${y}`
  }).filter(Boolean).join(' ')
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  )
}

const BACK_STYLE = {
  background: 'transparent', border: '1px solid #21262d', color: '#8b949e',
  borderRadius: 8, padding: '7px 16px', cursor: 'pointer', marginBottom: 16,
}
const SECTION_HEADER = { fontSize: 11, color: '#8b949e', letterSpacing: 1, textTransform: 'uppercase' }

function StationDetail({ station, onBack }) {
  const totalDT = station.toolDT + station.maintDT + station.prodDT + station.matDT + station.qualDT
  const breakdown = [
    { label: 'Tooling', value: station.toolDT, color: DT_COLORS.Tooling },
    { label: 'Maintenance', value: station.maintDT, color: DT_COLORS.Maintenance },
    { label: 'Production', value: station.prodDT, color: DT_COLORS.Production },
    { label: 'Material', value: station.matDT, color: DT_COLORS.Materials },
    { label: 'Quality', value: station.qualDT, color: DT_COLORS.Quality },
  ]
  const monthly = MONTHLY_DATA.stations.find(s => s.cell === station.cell)
  const trend = monthly ? monthly.values : Array(MONTHLY_DATA.months.length).fill(station.parts)
  const issueTypes = breakdown.filter(item => item.value > 0).sort((a, b) => b.value - a.value)
    .map(item => item.label === 'Material' || item.label === 'Quality' ? 'Production' : item.label)
  const matchedIssues = TOP_ISSUES.filter(issue => issueTypes.includes(issue.type))
  const issues = [...matchedIssues, ...TOP_ISSUES.filter(issue => !matchedIssues.includes(issue))].slice(0, 3)
  const actions = []
  if (station.mDTpct > 10) actions.push('→ Schedule PM')
  if (station.tDTpct > 8) actions.push('→ Review tooling life')
  if (station.oee < 75) actions.push('→ Raise 1×1 sheet')

  return (
    <div style={{ padding: 24, background: '#0d1117', border: '1px solid #21262d', borderRadius: 10 }}>
      <button onClick={onBack} style={BACK_STYLE}>← Back</button>
      <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
        <OEEGauge value={station.oee} size={140} label={station.cell} />
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#00d4ff' }}>{station.cell}</div>
          <div style={{ color: '#8b949e', marginTop: 4 }}>{station.program} · {station.customer}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          ['OEE', `${station.oee.toFixed(1)}%`, oeeColor(station.oee)],
          ['JPH', station.jph.toFixed(1), '#a78bfa'],
          ['Parts', station.parts.toLocaleString(), '#00d4ff'],
          ['Total Downtime', `${totalDT} min`, '#ff4444'],
        ].map(([label, value, color]) => (
          <div key={label} style={{ background: '#161b22', border: '1px solid #21262d', borderTop: `3px solid ${color}`, borderRadius: 8, padding: 14 }}>
            <div style={SECTION_HEADER}>{label}</div>
            <div style={{ color, fontFamily: 'monospace', fontSize: 22, fontWeight: 800, marginTop: 6 }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        <section style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 16 }}>
          <div style={{ ...SECTION_HEADER, marginBottom: 14 }}>Downtime breakdown</div>
          {breakdown.map(item => (
            <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 55px', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <span style={{ color: '#c9d1d9', fontSize: 12 }}>{item.label}</span>
              <Bar pct={totalDT ? item.value / totalDT * 100 : 0} color={item.color} height={8} />
              <span style={{ color: item.color, fontFamily: 'monospace', textAlign: 'right' }}>{item.value} min</span>
            </div>
          ))}
        </section>
        <section style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 16 }}>
          <div style={{ ...SECTION_HEADER, marginBottom: 14 }}>Monthly trend</div>
          <svg viewBox="0 0 320 90" style={{ width: '100%', height: 100, overflow: 'visible' }}>
            {(() => {
              const valid = trend.filter(v => v != null)
              const min = Math.min(...valid), max = Math.max(...valid)
              const points = trend.map((v, i) => {
                const value = v == null ? station.parts : v
                const x = trend.length === 1 ? 0 : i / (trend.length - 1) * 320
                const y = 78 - ((value - min) / Math.max(max - min, 1)) * 64
                return `${x},${y}`
              }).join(' ')
              return <polyline points={points} fill="none" stroke="#00d4ff" strokeWidth="3" strokeLinejoin="round" />
            })()}
          </svg>
          <div style={{ color: '#6e7681', fontSize: 11 }}>{monthly ? 'Monthly production history' : 'No station history available — flat baseline shown'}</div>
        </section>
        <section style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 16 }}>
          <div style={{ ...SECTION_HEADER, marginBottom: 12 }}>Top issues · {station.program}</div>
          {issues.map((issue, index) => (
            <div key={`${issue.issue}-${index}`} style={{ padding: '9px 0', borderBottom: index < issues.length - 1 ? '1px solid #21262d' : 'none', color: '#c9d1d9', fontSize: 12 }}>
              <span style={{ color: DT_COLORS[issue.type] || '#ffaa00', marginRight: 8 }}>●</span>{issue.issue}
              <span style={{ float: 'right', color: '#8b949e', fontFamily: 'monospace' }}>{issue.mins} min</span>
            </div>
          ))}
        </section>
        <section style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: 16 }}>
          <div style={{ ...SECTION_HEADER, marginBottom: 12 }}>Suggested action</div>
          {(actions.length ? actions : ['→ Continue standard monitoring']).map(action => (
            <div key={action} style={{ color: actions.length ? '#ffaa00' : '#00ff88', fontSize: 14, marginBottom: 8 }}>{action}</div>
          ))}
        </section>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function OEEAnalyticsTab() {
  const [sortKey, setSortKey] = useState('oee')
  const [sortDir, setSortDir] = useState('asc') // asc = lowest first (problem stations first)
  const [filterProg, setFilterProg] = useState('All')
  const [filterCust, setFilterCust] = useState('All')
  const [view, setView] = useState('stations') // stations | downtime | monthly | issues
  const [drillTarget, setDrillTarget] = useState(null)

  // ── Summary totals ───────────────────────────────────────────────────────────
  const totalParts   = STATION_OEE.reduce((s, r) => s + r.parts, 0)
  const totalTime    = STATION_OEE.reduce((s, r) => s + r.time, 0)
  const totalMaintDT = STATION_OEE.reduce((s, r) => s + r.maintDT, 0)
  const totalToolDT  = STATION_OEE.reduce((s, r) => s + r.toolDT, 0)
  const totalProdDT  = STATION_OEE.reduce((s, r) => s + r.prodDT, 0)
  const totalMatDT   = STATION_OEE.reduce((s, r) => s + r.matDT, 0)
  const totalQualDT  = STATION_OEE.reduce((s, r) => s + r.qualDT, 0)
  const totalDT      = totalMaintDT + totalToolDT + totalProdDT + totalMatDT + totalQualDT
  // Weighted avg OEE
  const weightedOEE  = STATION_OEE.reduce((s, r) => s + r.oee * r.time, 0) / totalTime
  const belowTarget  = STATION_OEE.filter(r => r.oee < OEE_TARGET).length

  // DT breakdown %
  const dtBreakdown = [
    { label: 'Maintenance', mins: totalMaintDT, color: DT_COLORS.Maintenance },
    { label: 'Production',  mins: totalProdDT,  color: DT_COLORS.Production },
    { label: 'Materials',   mins: totalMatDT,   color: DT_COLORS.Materials },
    { label: 'Tooling',     mins: totalToolDT,  color: DT_COLORS.Tooling },
    { label: 'Quality',     mins: totalQualDT,  color: DT_COLORS.Quality },
  ].sort((a, b) => b.mins - a.mins)

  // Programs / customers for filter
  const programs   = ['All', ...new Set(STATION_OEE.map(r => r.program))]
  const customers  = ['All', ...new Set(STATION_OEE.map(r => r.customer))]

  // Filtered + sorted stations
  const sorted = useMemo(() => {
    let rows = STATION_OEE
    if (filterProg !== 'All')  rows = rows.filter(r => r.program === filterProg)
    if (filterCust !== 'All')  rows = rows.filter(r => r.customer === filterCust)
    return [...rows].sort((a, b) => {
      const v = (r) => {
        if (sortKey === 'oee')   return r.oee
        if (sortKey === 'parts') return r.parts
        if (sortKey === 'jph')   return r.jph
        if (sortKey === 'dt')    return r.maintDT + r.toolDT + r.prodDT + r.matDT + r.qualDT
        if (sortKey === 'cell')  return r.cell
        return r.oee
      }
      const va = v(a), vb = v(b)
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [sortKey, sortDir, filterProg, filterCust])

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'oee' ? 'asc' : 'desc') }
  }
  function sortIcon(key) {
    if (sortKey !== key) return ' ⇅'
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  // ── Select box style ─────────────────────────────────────────────────────────
  const selectStyle = {
    background: '#161b22', border: '1px solid #30363d', color: '#e6edf3',
    borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
  }

  // ── Tab buttons ───────────────────────────────────────────────────────────────
  const viewTabs = [
    { id: 'stations',  label: '📊 Station OEE' },
    { id: 'downtime',  label: '⏱ Downtime Split' },
    { id: 'issues',    label: '🔧 Top Issues' },
    { id: 'charts',    label: '📈 Program & Customer' },
    { id: 'operators', label: '👤 Operators' },
    { id: 'monthly',   label: '📅 Month-over-Month' },
    { id: 'logentry',  label: '➕ Log Entry' },
    { id: 'entries',   label: '📋 Entries' },
  ]

  return (
    <div style={{ padding: 24, fontFamily: 'Arial, sans-serif' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e6edf3' }}>Assembly OEE Analytics</div>
          <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>
            Source: Assembly OEE 2026.xlsx  ·  {STATION_OEE.length} stations  ·  OEE Target: {OEE_TARGET}%
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#6e7681', textAlign: 'right' }}>
          <div>{belowTarget} stations below target</div>
          <div style={{ color: oeeColor(weightedOEE), fontWeight: 700, fontSize: 14 }}>
            Fleet OEE: {weightedOEE.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* ── Summary KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(5, 1fr)', gap: 14, marginBottom: 24, alignItems: 'center' }}>
        {/* Gauge */}
        <OEEGauge value={weightedOEE} size={120} label="Fleet OEE" />

        {/* KPI tiles */}
        {[
          { label: 'Total Parts Produced', value: totalParts.toLocaleString(), color: '#00d4ff', sub: 'All stations' },
          { label: 'Stations at Target', value: `${STATION_OEE.length - belowTarget}/${STATION_OEE.length}`, color: belowTarget === 0 ? '#00ff88' : '#ffaa00', sub: `≥${OEE_TARGET}% OEE` },
          { label: 'Total Downtime', value: `${totalDT.toLocaleString()} min`, color: '#ff4444', sub: `${(totalDT/totalTime*100).toFixed(1)}% of runtime` },
          { label: 'Maint DT (top cause)', value: `${totalMaintDT} min`, color: DT_COLORS.Maintenance, sub: `${(totalMaintDT/totalDT*100).toFixed(0)}% of all DT` },
          { label: 'Total Runtime', value: `${(totalTime/60).toFixed(0)} hrs`, color: '#a78bfa', sub: `${STATION_OEE.length} stations` },
        ].map(({ label, value, color, sub }) => (
          <div key={label} style={{
            background: '#161b22', border: `1px solid ${color}22`, borderTop: `3px solid ${color}`,
            borderRadius: 10, padding: '12px 16px',
          }}>
            <div style={{ fontSize: 10, color: '#8b949e', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, color: '#6e7681', marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── DT type mini-bar ── */}
      <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: '#8b949e', letterSpacing: 1.5, marginBottom: 10 }}>DOWNTIME BREAKDOWN (all stations)</div>
        <div style={{ display: 'flex', height: 12, borderRadius: 4, overflow: 'hidden' }}>
          {dtBreakdown.map(({ label, mins, color }) => (
            mins > 0 && <div key={label} style={{ flex: mins, background: color, minWidth: 2 }} title={`${label}: ${mins}min`} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          {dtBreakdown.map(({ label, mins, color }) => (
            <span key={label} style={{ fontSize: 10, color, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
              {label}: {mins}min ({(mins/totalDT*100).toFixed(0)}%)
            </span>
          ))}
        </div>
      </div>

      {/* ── Sub-view tabs ── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #21262d', marginBottom: 16 }}>
        {viewTabs.map(t => (
          <button key={t.id} onClick={() => { setView(t.id); setDrillTarget(null) }} style={{
            padding: '8px 18px', fontSize: 12, fontWeight: view === t.id ? 700 : 500,
            color: view === t.id ? '#00d4ff' : '#8b949e', background: 'transparent',
            border: 'none', borderBottom: view === t.id ? '2px solid #00d4ff' : '2px solid transparent',
            cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── STATION OEE TABLE ── */}
      {view === 'stations' && drillTarget && (
        <StationDetail station={drillTarget} onBack={() => setDrillTarget(null)} />
      )}

      {view === 'stations' && !drillTarget && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#8b949e' }}>Filter:</span>
            <select value={filterProg} onChange={e => setFilterProg(e.target.value)} style={selectStyle}>
              {programs.map(p => <option key={p}>{p}</option>)}
            </select>
            <select value={filterCust} onChange={e => setFilterCust(e.target.value)} style={selectStyle}>
              {customers.map(c => <option key={c}>{c}</option>)}
            </select>
            <span style={{ fontSize: 11, color: '#6e7681', marginLeft: 4 }}>{sorted.length} stations</span>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #21262d' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {[
                    { key: 'cell',  label: 'Station' },
                    { key: 'oee',   label: `OEE % (target ${OEE_TARGET}%)` },
                    { key: 'parts', label: 'Parts' },
                    { key: 'jph',   label: 'JPH' },
                    { key: null,    label: 'DT Mix' },
                    { key: 'dt',    label: 'DT %' },
                    { key: null,    label: 'Program' },
                    { key: null,    label: 'Customer' },
                  ].map(({ key, label }) => (
                    <th key={label} style={TH} onClick={() => key && handleSort(key)}>
                      {label}{key ? sortIcon(key) : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => <StationRow key={s.cell} s={s} idx={i} onSelect={setDrillTarget} />)}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── DOWNTIME SPLIT ── */}
      {view === 'downtime' && (
        <div>
          {/* Horizontal bar chart per station */}
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 14, letterSpacing: 1 }}>
            DOWNTIME BY STATION — sorted by total DT (minutes)
          </div>
          <div style={{ display: 'flex', gap: 4, fontSize: 10, color: '#6e7681', marginBottom: 10, flexWrap: 'wrap' }}>
            {Object.entries(DT_COLORS).map(([label, color]) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3, marginRight: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[...STATION_OEE]
              .filter(r => r.maintDT + r.toolDT + r.prodDT + r.matDT + r.qualDT > 0)
              .sort((a, b) => (b.maintDT + b.toolDT + b.prodDT + b.matDT + b.qualDT) - (a.maintDT + a.toolDT + a.prodDT + a.matDT + a.qualDT))
              .map(r => {
                const totalR = r.maintDT + r.toolDT + r.prodDT + r.matDT + r.qualDT
                const maxDT  = 230 // scale width
                return (
                  <div key={r.cell} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 140, fontSize: 11, color: '#e6edf3', textAlign: 'right', flexShrink: 0, fontFamily: 'monospace' }}>
                      {r.cell}
                    </div>
                    <div style={{ display: 'flex', height: 18, borderRadius: 3, overflow: 'hidden', flex: 1, maxWidth: 400 }}>
                      {[
                        { val: r.maintDT, color: DT_COLORS.Maintenance },
                        { val: r.toolDT,  color: DT_COLORS.Tooling },
                        { val: r.prodDT,  color: DT_COLORS.Production },
                        { val: r.matDT,   color: DT_COLORS.Materials },
                        { val: r.qualDT,  color: DT_COLORS.Quality },
                      ].filter(s => s.val > 0).map((s, i) => (
                        <div key={i} style={{
                          width: `${(s.val / maxDT) * 100}%`, background: s.color,
                          minWidth: s.val > 0 ? 2 : 0, maxWidth: '100%',
                        }} title={`${s.val}min`} />
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: '#6e7681', fontFamily: 'monospace', flexShrink: 0, width: 50 }}>
                      {totalR}min
                    </div>
                    <div style={{ fontSize: 11, color: oeeColor(r.oee), fontFamily: 'monospace', flexShrink: 0 }}>
                      OEE {r.oee.toFixed(1)}%
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* ── TOP ISSUES ── */}
      {view === 'issues' && (
        <div>
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 14, letterSpacing: 1 }}>
            TOP DOWNTIME ISSUES — from INPUT sheet analysis
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px,1fr))', gap: 10, marginBottom: 24 }}>
            {TOP_ISSUES.map((issue, i) => {
              const color = DT_COLORS[issue.type]
              const maxMins = TOP_ISSUES[0].mins
              return (
                <div key={i} style={{
                  background: '#161b22', border: `1px solid ${color}22`, borderLeft: `3px solid ${color}`,
                  borderRadius: 8, padding: '12px 16px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>{issue.issue}</div>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 10,
                      background: `${color}15`, color, border: `1px solid ${color}33`,
                    }}>{issue.type}</span>
                  </div>
                  <Bar pct={(issue.mins / maxMins) * 100} color={color} height={4} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: '#8b949e' }}>{issue.mins} min total</span>
                    <span style={{ fontSize: 11, color: '#6e7681' }}>{issue.count} occurrence{issue.count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pareto by type */}
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 10, letterSpacing: 1 }}>PARETO BY DOWNTIME TYPE</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 12 }}>
            {Object.entries(
              TOP_ISSUES.reduce((acc, i) => { acc[i.type] = (acc[i.type] || 0) + i.mins; return acc }, {})
            ).sort((a, b) => b[1] - a[1]).map(([type, mins]) => {
              const color = DT_COLORS[type]
              const totalIssueMins = TOP_ISSUES.reduce((s, i) => s + i.mins, 0)
              return (
                <div key={type} style={{
                  background: '#161b22', border: `1px solid ${color}22`, borderTop: `3px solid ${color}`,
                  borderRadius: 8, padding: '10px 14px',
                }}>
                  <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 4 }}>{type.toUpperCase()}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color }}>{mins}</div>
                  <div style={{ fontSize: 10, color: '#6e7681' }}>min  ·  {(mins/totalIssueMins*100).toFixed(0)}% of issues</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── PROGRAM & CUSTOMER CHARTS ── */}
      {view === 'charts' && (
        <div>
          {/* OEE by Program — horizontal bar chart */}
          <div style={{ fontSize: 11, color: '#8b949e', letterSpacing: 1, marginBottom: 14 }}>OEE % BY PROGRAM</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 12, marginBottom: 28 }}>
            {PROGRAM_DATA.sort((a,b) => b.oee - a.oee).map(p => {
              const color = oeeColor(p.oee)
              return (
                <div key={p.program} style={{
                  background: '#161b22', border: `1px solid ${color}22`, borderTop: `3px solid ${color}`,
                  borderRadius: 10, padding: '14px 18px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color }}>{p.program}</div>
                      <div style={{ fontSize: 10, color: '#6e7681' }}>{p.stations} stations</div>
                    </div>
                    <OEEGauge value={p.oee} size={70} />
                  </div>
                  <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>
                    Parts: <span style={{ color: '#e6edf3', fontFamily: 'monospace' }}>{p.parts.toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#8b949e' }}>
                    Best: <span style={{ color: '#00ff88', fontFamily: 'monospace', fontSize: 11 }}>{p.topStation}</span>
                    <span style={{ color: '#00ff88' }}> {p.topOEE}%</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* OEE by Customer */}
          <div style={{ fontSize: 11, color: '#8b949e', letterSpacing: 1, marginBottom: 14 }}>OEE % & PARTS BY CUSTOMER</div>
          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #21262d', marginBottom: 28 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Customer','OEE %','Total Parts','FG Parts','WIP Parts','FG %'].map(h => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CUSTOMER_DATA.sort((a,b) => b.parts - a.parts).map((c, i) => {
                  const fgPct = ((c.fg / c.parts) * 100).toFixed(0)
                  const color = c.color
                  return (
                    <tr key={c.customer} style={{ background: i % 2 === 0 ? '#0d1117' : '#161b2280' }}>
                      <td style={TD}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color }}>{c.customer}</span>
                      </td>
                      <td style={TD}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: oeeColor(c.oee), width: 48 }}>{c.oee}%</span>
                          <Bar pct={c.oee} color={oeeColor(c.oee)} height={5} />
                        </div>
                      </td>
                      <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 700, color: '#e6edf3' }}>{c.parts.toLocaleString()}</td>
                      <td style={{ ...TD, fontFamily: 'monospace', color: '#00ff88' }}>{c.fg.toLocaleString()}</td>
                      <td style={{ ...TD, fontFamily: 'monospace', color: '#ffaa00' }}>{c.wip.toLocaleString()}</td>
                      <td style={TD}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 80, height: 6, background: '#21262d', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${fgPct}%`, background: '#00ff88', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, color: '#00ff88', fontFamily: 'monospace' }}>{fgPct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Parts donut-style share bar */}
          <div style={{ fontSize: 11, color: '#8b949e', letterSpacing: 1, marginBottom: 10 }}>PARTS SHARE BY CUSTOMER</div>
          <div style={{ display: 'flex', height: 20, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
            {(() => {
              const total = CUSTOMER_DATA.reduce((s, c) => s + c.parts, 0)
              return CUSTOMER_DATA.sort((a,b) => b.parts - a.parts).map(c => (
                <div key={c.customer} style={{ flex: c.parts, background: c.color, minWidth: 2 }}
                     title={`${c.customer}: ${c.parts.toLocaleString()} (${(c.parts/total*100).toFixed(1)}%)`} />
              ))
            })()}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {(() => {
              const total = CUSTOMER_DATA.reduce((s, c) => s + c.parts, 0)
              return CUSTOMER_DATA.sort((a,b) => b.parts - a.parts).map(c => (
                <span key={c.customer} style={{ fontSize: 10, color: c.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color, display: 'inline-block' }} />
                  {c.customer}: {(c.parts/total*100).toFixed(1)}%
                </span>
              ))
            })()}
          </div>
        </div>
      )}

      {/* ── OPERATORS ── */}
      {view === 'operators' && (
        <div>
          <div style={{ fontSize: 11, color: '#8b949e', letterSpacing: 1, marginBottom: 14 }}>
            OPERATOR PERFORMANCE — Weighted AVG OEE by Operator (from operator pivot sheets)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 12, marginBottom: 24 }}>
            {[...OPERATOR_DATA].sort((a,b) => b.oee - a.oee).map((op, i) => {
              const color = oeeColor(op.oee)
              const rank = i + 1
              return (
                <div key={op.operator} style={{
                  background: '#161b22',
                  border: `1px solid ${color}22`,
                  borderTop: `3px solid ${color}`,
                  borderRadius: 10, padding: '14px 18px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3' }}>👤 {op.operator}</div>
                      <div style={{ fontSize: 10, color: '#6e7681' }}>Rank #{rank} of {OPERATOR_DATA.length}</div>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color }}>{op.oee}%</div>
                  </div>
                  <Bar pct={op.oee} color={color} height={5} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
                    {[
                      { label: 'Parts',    val: op.parts.toLocaleString(), color: '#00d4ff' },
                      { label: 'Runtime',  val: `${(op.timeMin/60).toFixed(0)}h`,  color: '#a78bfa' },
                      { label: 'Maint DT', val: `${op.maintDT}min`,  color: '#ff4444' },
                      { label: 'Prod DT',  val: `${op.prodDT}min`,   color: '#ffaa00' },
                    ].map(({ label, val, color: c }) => (
                      <div key={label}>
                        <div style={{ fontSize: 9, color: '#6e7681', letterSpacing: 1 }}>{label.toUpperCase()}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: c }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  {op.mDTpct > 5 && (
                    <div style={{ marginTop: 8, fontSize: 10, color: '#ff4444', background: '#ff444415', borderRadius: 4, padding: '2px 8px', display: 'inline-block' }}>
                      ⚠ High Maint DT: {op.mDTpct}%
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Operator OEE bar chart */}
          <div style={{ fontSize: 11, color: '#8b949e', letterSpacing: 1, marginBottom: 12 }}>OEE COMPARISON — all operators</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...OPERATOR_DATA].sort((a,b) => b.oee - a.oee).map(op => {
              const color = oeeColor(op.oee)
              return (
                <div key={op.operator} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 80, fontSize: 12, color: '#e6edf3', fontWeight: 600, flexShrink: 0 }}>{op.operator}</div>
                  <div style={{ flex: 1, height: 22, background: '#21262d', borderRadius: 4, overflow: 'hidden', maxWidth: 400 }}>
                    <div style={{
                      height: '100%', width: `${op.oee}%`, background: color,
                      borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: 8,
                      transition: 'width 0.5s',
                    }}>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#000' }}>{op.oee}%</span>
                    </div>
                  </div>
                  <div style={{ width: 90, fontSize: 10, color: '#6e7681', flexShrink: 0, fontFamily: 'monospace' }}>
                    {op.parts.toLocaleString()} parts
                  </div>
                </div>
              )
            })}
            {/* Target line indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <div style={{ width: 80 }} />
              <div style={{ flex: 1, maxWidth: 400, position: 'relative', height: 1 }}>
                <div style={{
                  position: 'absolute', left: `${OEE_TARGET}%`, top: -12,
                  fontSize: 9, color: '#00ff88', whiteSpace: 'nowrap',
                  borderLeft: '1px dashed #00ff88', paddingLeft: 4, height: 28,
                }}>Target {OEE_TARGET}%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MONTH-OVER-MONTH ── */}
      {view === 'monthly' && (
        <div>
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 14, letterSpacing: 1 }}>
            PARTS PRODUCED — Month over Month (2025 – 2026)
          </div>
          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #21262d' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ ...TH, minWidth: 130 }}>Station</th>
                  {MONTHLY_DATA.months.map(m => (
                    <th key={m} style={{ ...TH, minWidth: 52, textAlign: 'right', padding: '9px 8px' }}>{m}</th>
                  ))}
                  <th style={{ ...TH, minWidth: 80 }}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {MONTHLY_DATA.stations.map((row, idx) => {
                  const valid = row.values.filter(v => v != null)
                  const maxVal = Math.max(...valid)
                  const minVal = Math.min(...valid)
                  return (
                    <tr key={row.cell} style={{ background: idx % 2 === 0 ? '#0d1117' : '#161b2280' }}>
                      <td style={{ ...TD, fontFamily: 'monospace', fontSize: 11, color: '#00d4ff' }}>{row.cell}</td>
                      {row.values.map((v, i) => {
                        if (v == null) return <td key={i} style={{ ...TD, textAlign: 'right', color: '#30363d' }}>—</td>
                        const heat = (v - minVal) / (maxVal - minVal || 1)
                        const bg = `rgba(0,212,255,${heat * 0.25})`
                        return (
                          <td key={i} style={{
                            ...TD, textAlign: 'right', fontFamily: 'monospace', fontSize: 11,
                            background: bg, color: heat > 0.6 ? '#00d4ff' : '#e6edf3',
                          }}>
                            {v.toLocaleString()}
                          </td>
                        )
                      })}
                      <td style={{ ...TD, padding: '4px 12px' }}>
                        <Sparkline values={row.values} color="#00d4ff" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10, color: '#6e7681', marginTop: 8 }}>
            Cell shading: darker blue = higher production. Sparkline shows trend across all periods.
          </div>
        </div>
      )}

      {/* ── LOG ENTRY ── */}
      {view === 'logentry' && <OEELogEntry onSaved={() => setView('entries')} />}

      {/* ── SAVED ENTRIES ── */}
      {view === 'entries' && <OEEEntries onNew={() => setView('logentry')} />}

    </div>
  )
}

// ── OEE Log Entry form ────────────────────────────────────────────────────────
const CELL_OPTIONS = STATION_OEE.map(s => s.cell).sort()
const SHIFT_OPTIONS = ['1', '2', '3']

function calcLiveOEE(f) {
  const toolDT = parseFloat(f.toolDT) || 0
  const maintDT = parseFloat(f.maintDT) || 0
  const prodDT = parseFloat(f.prodDT) || 0
  const totalMin = 480
  const downtimeMin = toolDT + maintDT + prodDT
  const uptime = Math.max(0, totalMin - downtimeMin)
  const availability = (uptime / totalMin) * 100

  const tct = parseFloat(f.targetCycleTime) || 0
  const act = parseFloat(f.actualCycleTime) || 0
  const performance = tct > 0 && act > 0 ? Math.min((tct / act) * 100, 100) : 0

  const parts = parseFloat(f.partsReported) || 0
  const scrap = parseFloat(f.scrap) || 0
  const rework = parseFloat(f.rework) || 0
  const quality = parts > 0 ? Math.max(0, ((parts - scrap - rework) / parts) * 100) : 0

  const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100
  return {
    availability: availability.toFixed(1),
    performance: performance.toFixed(1),
    quality: quality.toFixed(1),
    oee: oee.toFixed(1),
  }
}

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  shift: '2', cell: '', partNumber: '',
  toolDT: '', topToolIssue: '',
  maintDT: '', topMaintIssue: '',
  prodDT: '', topProdIssue: '',
  partsReported: '', targetCycleTime: '', actualCycleTime: '',
  scrap: '', rework: '',
}

function OEELogEntry({ onSaved }) {
  const [form, setForm] = React.useState(EMPTY_FORM)
  const [saved, setSaved] = React.useState(false)

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  const live = calcLiveOEE(form)
  const oeeCol = parseFloat(live.oee) >= OEE_TARGET ? '#00ff88' : parseFloat(live.oee) >= 75 ? '#ffaa00' : '#ff4444'

  function handleSave(e) {
    e.preventDefault()
    const entry = { ...form, ...live, id: Date.now(), savedAt: new Date().toISOString() }
    const existing = JSON.parse(localStorage.getItem('lsb_oee_entries') || '[]')
    localStorage.setItem('lsb_oee_entries', JSON.stringify([entry, ...existing]))
    api.saveOeeEntry(entry).catch(() => {})
    setSaved(true)
    setTimeout(() => { setSaved(false); onSaved() }, 800)
  }

  const labelStyle = { fontSize: 10, color: '#8b949e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, display: 'block' }
  const inputStyle = {
    width: '100%', background: '#0d1117', border: '1px solid #21262d', borderRadius: 6,
    color: '#e6edf3', fontSize: 13, padding: '8px 10px', boxSizing: 'border-box', outline: 'none',
  }
  const sectionHead = { fontSize: 11, color: '#8b949e', letterSpacing: 1, fontWeight: 700, marginBottom: 12, marginTop: 20, textTransform: 'uppercase' }

  return (
    <form onSubmit={handleSave}>
      {/* Live OEE Preview */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24,
        background: '#161b22', border: '1px solid #21262d', borderRadius: 10, padding: '16px 20px',
      }}>
        {[
          { label: 'Availability', val: live.availability + '%', color: '#00d4ff' },
          { label: 'Performance',  val: live.performance  + '%', color: '#a78bfa' },
          { label: 'Quality',      val: live.quality      + '%', color: '#fb923c' },
          { label: 'OEE',          val: live.oee          + '%', color: oeeCol },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#6e7681', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color, fontFamily: "'Courier New', monospace" }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Identification */}
      <div style={sectionHead}>Identification</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 8 }}>
        <div>
          <label style={labelStyle}>Date</label>
          <input type="date" style={inputStyle} value={form.date} onChange={e => set('date', e.target.value)} required />
        </div>
        <div>
          <label style={labelStyle}>Shift</label>
          <select style={inputStyle} value={form.shift} onChange={e => set('shift', e.target.value)}>
            {SHIFT_OPTIONS.map(s => <option key={s} value={s}>Shift {s}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Cell / Station</label>
          <select style={inputStyle} value={form.cell} onChange={e => set('cell', e.target.value)} required>
            <option value="">— Select —</option>
            {CELL_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Part Number</label>
          <input type="text" style={inputStyle} value={form.partNumber} onChange={e => set('partNumber', e.target.value)} placeholder="e.g. BMW1000D-360" />
        </div>
      </div>

      {/* Downtime */}
      <div style={sectionHead}>Downtime (minutes)</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 2fr 1fr 2fr', gap: 12, marginBottom: 8 }}>
        {[
          { key: 'toolDT',  issueKey: 'topToolIssue',  label: 'Tooling DT',  ph: 'Top tooling issue' },
          { key: 'maintDT', issueKey: 'topMaintIssue', label: 'Maint DT',    ph: 'Top maint issue' },
          { key: 'prodDT',  issueKey: 'topProdIssue',  label: 'Prod DT',     ph: 'Top prod issue' },
        ].map(({ key, issueKey, label, ph }) => (
          <React.Fragment key={key}>
            <div>
              <label style={labelStyle}>{label}</label>
              <input type="number" min="0" style={inputStyle} value={form[key]} onChange={e => set(key, e.target.value)} placeholder="0" />
            </div>
            <div>
              <label style={labelStyle}>Issue</label>
              <input type="text" style={inputStyle} value={form[issueKey]} onChange={e => set(issueKey, e.target.value)} placeholder={ph} />
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Output & Quality */}
      <div style={sectionHead}>Output & Quality</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { key: 'partsReported',   label: 'Parts Reported',    ph: '0' },
          { key: 'targetCycleTime', label: 'Target Cycle (sec)',  ph: '0' },
          { key: 'actualCycleTime', label: 'Actual Cycle (sec)',  ph: '0' },
          { key: 'scrap',           label: 'Scrap',               ph: '0' },
          { key: 'rework',          label: 'Rework',              ph: '0' },
        ].map(({ key, label, ph }) => (
          <div key={key}>
            <label style={labelStyle}>{label}</label>
            <input type="number" min="0" style={inputStyle} value={form[key]} onChange={e => set(key, e.target.value)} placeholder={ph} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button type="submit" style={{
          background: saved ? '#00ff8830' : '#00d4ff20',
          border: `1px solid ${saved ? '#00ff88' : '#00d4ff'}`,
          borderRadius: 8, color: saved ? '#00ff88' : '#00d4ff',
          fontSize: 13, fontWeight: 700, padding: '10px 28px', cursor: 'pointer',
        }}>
          {saved ? '✓ Saved!' : '💾 Save Entry'}
        </button>
        <button type="button" onClick={() => setForm(EMPTY_FORM)} style={{
          background: 'transparent', border: '1px solid #21262d', borderRadius: 8,
          color: '#8b949e', fontSize: 13, padding: '10px 20px', cursor: 'pointer',
        }}>
          ↺ Reset
        </button>
      </div>
    </form>
  )
}

// ── Saved Entries list ────────────────────────────────────────────────────────
function OEEEntries({ onNew }) {
  const [entries, setEntries] = React.useState(() =>
    JSON.parse(localStorage.getItem('lsb_oee_entries') || '[]')
  )

  React.useEffect(() => {
    api.oeeEntries().then(serverEntries => {
      const localEntries = JSON.parse(localStorage.getItem('lsb_oee_entries') || '[]')
      const merged = new Map()
      const keyFor = entry => `${entry.date || ''}|${entry.shift || ''}|${String(entry.cell || '').toLowerCase()}`
      localEntries.forEach(entry => merged.set(keyFor(entry), entry))
      ;(Array.isArray(serverEntries) ? serverEntries : []).forEach(entry => {
        merged.set(keyFor(entry), { ...entry, synced: true })
      })
      setEntries(Array.from(merged.values()).sort((a, b) => `${b.date || ''}-${b.shift || ''}`.localeCompare(`${a.date || ''}-${a.shift || ''}`)))
    }).catch(() => {})
  }, [])

  function deleteEntry(id) {
    const updated = entries.filter(e => e.id !== id)
    setEntries(updated)
    localStorage.setItem('lsb_oee_entries', JSON.stringify(updated))
  }

  if (entries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: '#6e7681' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 14, marginBottom: 16 }}>No entries logged yet</div>
        <button onClick={onNew} style={{
          background: '#00d4ff20', border: '1px solid #00d4ff', borderRadius: 8,
          color: '#00d4ff', fontSize: 13, padding: '10px 24px', cursor: 'pointer',
        }}>➕ Log First Entry</button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#8b949e', letterSpacing: 1 }}>{entries.length} SAVED ENTRIES</div>
        <button onClick={onNew} style={{
          background: '#00d4ff20', border: '1px solid #00d4ff44', borderRadius: 8,
          color: '#00d4ff', fontSize: 12, padding: '7px 16px', cursor: 'pointer',
        }}>➕ New Entry</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entries.map(e => {
          const oeeCol = parseFloat(e.oee) >= OEE_TARGET ? '#00ff88' : parseFloat(e.oee) >= 75 ? '#ffaa00' : '#ff4444'
          return (
            <div key={e.id} style={{
              background: '#161b22', border: '1px solid #21262d',
              borderLeft: `4px solid ${oeeCol}`, borderRadius: 8, padding: '12px 16px',
              display: 'grid', gridTemplateColumns: '120px 120px 1fr repeat(4,80px) 36px',
              gap: 12, alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 9, color: '#6e7681', letterSpacing: 1 }}>DATE / SHIFT</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#e6edf3' }}>{e.date} S{e.shift}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#6e7681', letterSpacing: 1 }}>CELL</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#00d4ff' }}>
                  {e.cell} {e.synced && <span style={{ color: '#00ff88', fontSize: 9 }}>(synced)</span>}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#6e7681', letterSpacing: 1 }}>PART / DOWNTIME</div>
                <div style={{ fontSize: 11, color: '#e6edf3' }}>{e.partNumber || '—'}</div>
                <div style={{ fontSize: 10, color: '#6e7681' }}>T:{e.toolDT||0} M:{e.maintDT||0} P:{e.prodDT||0} min</div>
              </div>
              {[
                { label: 'AVAIL', val: e.availability + '%', color: '#00d4ff' },
                { label: 'PERF',  val: e.performance  + '%', color: '#a78bfa' },
                { label: 'QUAL',  val: e.quality      + '%', color: '#fb923c' },
                { label: 'OEE',   val: e.oee          + '%', color: oeeCol },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#6e7681', letterSpacing: 1 }}>{label}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 800, color }}>{val}</div>
                </div>
              ))}
              <button onClick={() => deleteEntry(e.id)} title="Delete" style={{
                background: 'transparent', border: 'none', color: '#6e7681',
                cursor: 'pointer', fontSize: 16,
              }}>🗑</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
