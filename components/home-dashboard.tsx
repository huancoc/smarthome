'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AirVent, ArrowDownRight, ArrowUpRight, AudioLines, Battery, ChevronDown, ChevronRight, CircleHelp, CloudSun, DoorOpen, Fan, Gauge, Home, Lightbulb, Lock, Moon, MoreHorizontal, PanelRightClose, Radio, Settings2, ShieldCheck, Sun, Thermometer, Users, Waves, Wind, Zap } from 'lucide-react'

type RoomKey =
  | 'kho'
  | 'bep'
  | 'veSinh'
  | 'phongAn'
  | 'khach'
  | 'hienTrai'
  | 'hienPhai'
  | 'sanBe'
  | 'cuaBuong'
  | 'denTranh'
  | 'warmDownlight'
  | 'whiteDownlight'
  | 'yeelightPN'
  | 'sanVuon'
  | 'denCong'

// Presence sensor keys - 7 zones (+ phongNgu optional)
type SensorKey =
  | 'sanVuon'
  | 'phongOngBa'
  | 'nhaVeSinh'
  | 'bep'
  | 'phongAn'
  | 'sanBe'
  | 'hienNha'
  | 'phongNgu'

// Exhaust / fresh-air fan keys
type FanKey = 'exhaustBedroom' | 'freshAirFan' | 'exhaustDining'

// Pin kinds: original ones + group kinds
type PinKind = 'light' | 'sensor' | 'climate' | 'door' | 'weather' | 'ambient' | 'fan' | 'air' | 'group-lights' | 'group-sensors'

type Pin = {
  id: string
  x: number
  y: number
  title: string
  kind: PinKind
  room?: RoomKey
  sensor?: SensorKey
  fan?: FanKey
  // Group pins
  rooms?: RoomKey[]        // for group-lights
  sensors?: SensorKey[]    // for group-sensors
  showAir?: boolean        // for group-sensors: show MQ2/CO2
  showLux?: boolean        // for group-sensors: show lux
  showClimate?: boolean    // for group-sensors: show temp/hum
  detail?: string
}
type Mode = 'demo' | 'live'
type HAState = { entity_id: string; state: string; attributes?: Record<string, unknown> }

const HA_API_PATH = '/api/ha'

const ENTITY_MAP = {
  lights: {
    kho: 'light.kho',
    bep: 'light.bep',
    phongAn: 'light.phong_an',
    veSinh: 'light.ve_sinh',
    khach: 'light.phong_khach',
    hienTrai: 'light.hien_trai',
    hienPhai: 'light.hien_phai',
    sanBe: 'light.san_be',
    cuaBuong: 'light.cua_buong',
    denTranh: 'light.den_tranh',
    warmDownlight: 'light.downlight_vang',
    whiteDownlight: 'light.downlight_trang',
    yeelightPN: 'light.yeelight_pn',
    sanVuon: 'light.san_vuon',
    denCong: 'light.den_cong',
  } as Record<RoomKey, string>,
  sensors: {
    // 7-zone LD2410 presence
    sanVuonPresence: 'binary_sensor.ld2410_san_vuon',
    sanVuonDistance: 'sensor.ld2410_san_vuon_distance',
    phongOngBaPresence: 'binary_sensor.ld2410_phong_ong_ba',
    phongOngBaDistance: 'sensor.ld2410_phong_ong_ba_distance',
    nhaVeSinhPresence: 'binary_sensor.ld2410_wc',
    nhaVeSinhDistance: 'sensor.ld2410_wc_distance',
    bepPresence: 'binary_sensor.ld2410_bep',
    bepDistance: 'sensor.ld2410_bep_distance',
    phongAnPresence: 'binary_sensor.ld2410_phong_an',
    phongAnDistance: 'sensor.ld2410_phong_an_distance',
    sanBePresence: 'binary_sensor.ld2410_san_be',
    sanBeDistance: 'sensor.ld2410_san_be_distance',
    hienNhaPresence: 'binary_sensor.ld2410_hien_nha',
    hienNhaDistance: 'sensor.ld2410_hien_nha_distance',
    phongNguPresence: 'binary_sensor.ld2410_ngu',
    phongNguDistance: 'sensor.ld2410_ngu_distance',
    // Environment
    lux: 'sensor.cam_bien_anh_sang',
    // Outdoor (Sân vườn)
    outdoorTemp: 'sensor.nhiet_do_san_vuon',
    outdoorHum: 'sensor.do_am_san_vuon',
    // Phòng ông bà / Phòng khách
    grandparentsTemp: 'sensor.nhiet_do_phong_ong_ba',
    grandparentsHum: 'sensor.do_am_phong_ong_ba',
    // Phòng ăn
    diningTemp: 'sensor.nhiet_do_phong_an',
    diningHum: 'sensor.do_am_phong_an',
    // Safety & air
    mq2Bedroom: 'sensor.cam_bien_khoi_mq2_phong_ngu',
    co2Dining: 'sensor.co2_phong_an_chua_cau_hinh',
  },
  climate: {
    ac: 'climate.daikin',
    fan: 'fan.quat_tran',
  },
  fans: {
    exhaustBedroom: 'switch.quat_hut_mui_phong_ngu',
    freshAirFan: 'switch.quat_gio_tuoi',
    exhaustDining: 'switch.quat_hut_mui_phong_an',
  } as Record<FanKey, string>,
}

const floorImage = '/floor-plan/bg.jpg'

const roomLightImages: Record<RoomKey, string | null> = {
  kho: '/floor-plan/kho.png',
  bep: '/floor-plan/bep.png',
  veSinh: null,
  phongAn: '/floor-plan/phong-an.png',
  khach: '/floor-plan/phong-ong-ba.png',
  hienTrai: '/floor-plan/he-trai.png',
  hienPhai: '/floor-plan/he-phai.png',
  sanBe: '/floor-plan/san-be.png',
  cuaBuong: '/floor-plan/cua-buong.png',
  denTranh: '/floor-plan/den-tranh.png',
  warmDownlight: '/floor-plan/warm-downlight.png',
  whiteDownlight: '/floor-plan/white-downlight.png',
  yeelightPN: '/floor-plan/yeelight-PN.png',
  sanVuon: '/floor-plan/san-vuon.png',
  denCong: '/floor-plan/den-cong.png',
}

// Short names for rooms/lights
const ROOM_SHORT: Record<RoomKey, string> = {
  kho: 'Kho',
  bep: 'Bếp',
  veSinh: 'WC',
  phongAn: 'PA',
  khach: 'PK',
  hienTrai: 'Hiên trái',
  hienPhai: 'Hiên phải',
  sanBe: 'SB',
  cuaBuong: 'Cửa',
  denTranh: 'Tranh',
  warmDownlight: 'Vàng',
  whiteDownlight: 'Trắng',
  yeelightPN: 'Yeelight',
  sanVuon: 'Sân vườn',
  denCong: 'Cổng',
}

const ROOM_TITLE: Record<RoomKey, string> = {
  kho: 'Đèn Kho',
  bep: 'Đèn Bếp',
  veSinh: 'Đèn WC',
  phongAn: 'Đèn PA',
  khach: 'Đèn PK',
  hienTrai: 'Đèn Hiên trái',
  hienPhai: 'Đèn Hiên phải',
  sanBe: 'Đèn SB',
  cuaBuong: 'Đèn Cửa buồng',
  denTranh: 'Đèn Tranh',
  warmDownlight: 'Downlight vàng',
  whiteDownlight: 'Downlight trắng',
  yeelightPN: 'Yeelight PN',
  sanVuon: 'Đèn Sân vườn',
  denCong: 'Đèn Cổng',
}

// Pin map: short labels, grouped lights, grouped sensors
const initialPins: Pin[] = [
  // Single lights
  { id: 'kho', x: 25, y: 25, title: 'Đèn Kho', kind: 'light', room: 'kho' },
  { id: 'bep', x: 25, y: 50, title: 'Đèn Bếp', kind: 'light', room: 'bep' },
  { id: 'an', x: 24.4, y: 67.9, title: 'Đèn PA', kind: 'light', room: 'phongAn' },
  { id: 'wc', x: 42.7, y: 13.4, title: 'Đèn WC', kind: 'light', room: 'veSinh' },
  { id: 'living', x: 55, y: 30, title: 'Đèn PK', kind: 'light', room: 'khach' },
  { id: 'yard', x: 46.8, y: 34.5, title: 'Đèn SB', kind: 'light', room: 'sanBe' },
  { id: 'door', x: 75.3, y: 38.1, title: 'Cửa buồng · RFID', kind: 'door', room: 'cuaBuong' },

  // Group lights - PN (4 lights)
  { id: 'group-lights-pn', x: 82.5, y: 18.5, title: 'Nhóm Đèn PN', kind: 'group-lights', rooms: ['denTranh', 'warmDownlight', 'whiteDownlight', 'yeelightPN'] },
  // Group lights - Hiên (2 lights)
  { id: 'group-lights-hien', x: 63.5, y: 49.5, title: 'Nhóm Đèn Hiên', kind: 'group-lights', rooms: ['hienTrai', 'hienPhai'] },
  // Group lights - Ngoài trời (Sân vườn + Cổng)
  { id: 'group-lights-outdoor', x: 85.5, y: 76.5, title: 'Nhóm Đèn SV', kind: 'group-lights', rooms: ['sanVuon', 'denCong'] },

  // Group sensors - PN (presence + temp/hum + MQ2)
  { id: 'group-sensors-pn', x: 88.5, y: 36.5, title: 'PN', kind: 'group-sensors', sensors: ['phongNgu'], showClimate: true, showAir: true },
  // Group sensors - PA (presence + temp/hum + CO2)
  { id: 'group-sensors-pa', x: 30.5, y: 78.5, title: 'PA', kind: 'group-sensors', sensors: ['phongAn'], showClimate: true, showAir: true },
  // Group sensors - PK (presence + temp/hum)
  { id: 'group-sensors-pk', x: 66.5, y: 32.5, title: 'PK', kind: 'group-sensors', sensors: ['phongOngBa'], showClimate: true },
  // Group sensors - SV (presence + temp/hum + lux)
  { id: 'group-sensors-sv', x: 87.5, y: 64.5, title: 'SV', kind: 'group-sensors', sensors: ['sanVuon'], showClimate: true, showLux: true },

  // Single presence sensors
  { id: 'wc-presence', x: 42.2, y: 4.8, title: 'WC', kind: 'sensor', sensor: 'nhaVeSinh' },
  { id: 'kitchen-presence', x: 28.5, y: 43.5, title: 'Bếp', kind: 'sensor', sensor: 'bep' },
  { id: 'yard-presence', x: 52.5, y: 37.5, title: 'SB', kind: 'sensor', sensor: 'sanBe' },
  { id: 'porch-presence', x: 62.5, y: 57.5, title: 'Hiên', kind: 'sensor', sensor: 'hienNha' },

  // Fans
  { id: 'dining-fan', x: 20.5, y: 76.5, title: 'Hút mùi PA', kind: 'fan', fan: 'exhaustDining' },
  { id: 'bedroom-fan', x: 92.5, y: 42.5, title: 'Hút mùi PN', kind: 'fan', fan: 'exhaustBedroom' },
  { id: 'fresh-air-fan', x: 58.5, y: 42.5, title: 'Gió tươi', kind: 'fan', fan: 'freshAirFan' },

  // Climate AC + Weather + ambient
  { id: 'bedroom-climate', x: 76.5, y: 34.5, title: 'Điều hòa', kind: 'climate' },
  { id: 'ambient', x: 92, y: 25, title: 'Ánh sáng', kind: 'ambient' },
  { id: 'weather', x: 94, y: 9, title: 'Thời tiết', kind: 'weather', detail: '31° · 76%' },
]

const initialLights: Record<RoomKey, boolean> = {
  kho: false,
  bep: true,
  veSinh: false,
  phongAn: false,
  khach: false,
  hienTrai: false,
  hienPhai: false,
  sanBe: false,
  cuaBuong: false,
  denTranh: false,
  warmDownlight: false,
  whiteDownlight: false,
  yeelightPN: false,
  sanVuon: false,
  denCong: false,
}

const initialFans: Record<FanKey, boolean> = { exhaustBedroom: false, freshAirFan: false, exhaustDining: false }

const initialPresence: Record<SensorKey, boolean> = {
  sanVuon: false,
  phongOngBa: true,
  nhaVeSinh: false,
  bep: false,
  phongAn: false,
  sanBe: false,
  hienNha: false,
  phongNgu: false,
}

const initialDistances: Record<SensorKey, number> = {
  sanVuon: 0,
  phongOngBa: 1.8,
  nhaVeSinh: 1.2,
  bep: 0,
  phongAn: 0,
  sanBe: 0,
  hienNha: 0,
  phongNgu: 1.5,
}

const SENSOR_LABELS: Record<SensorKey, string> = {
  sanVuon: 'Sân vườn',
  phongOngBa: 'Phòng ông bà',
  nhaVeSinh: 'Nhà vệ sinh',
  bep: 'Bếp',
  phongAn: 'Phòng ăn',
  sanBe: 'Sân bể',
  hienNha: 'Hiên nhà',
  phongNgu: 'Phòng ngủ',
}

const SENSOR_SHORT: Record<SensorKey, string> = {
  sanVuon: 'SV',
  phongOngBa: 'PK',
  nhaVeSinh: 'WC',
  bep: 'Bếp',
  phongAn: 'PA',
  sanBe: 'SB',
  hienNha: 'Hiên',
  phongNgu: 'PN',
}

const FAN_LABELS: Record<FanKey, string> = {
  exhaustBedroom: 'Quạt hút mùi phòng ngủ',
  freshAirFan: 'Quạt gió tươi',
  exhaustDining: 'Quạt hút mùi phòng ăn',
}

function timeLabel() { return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date()) }

function pinsToCode(pins: Pin[]) {
  const lines = pins.map(pin => {
    const parts: string[] = [`id: '${pin.id}'`, `x: ${pin.x}`, `y: ${pin.y}`, `title: '${pin.title.replace(/'/g, "\\'")}'`, `kind: '${pin.kind}'`]
    if (pin.room) parts.push(`room: '${pin.room}'`)
    if (pin.sensor) parts.push(`sensor: '${pin.sensor}'`)
    if (pin.fan) parts.push(`fan: '${pin.fan}'`)
    if (pin.rooms) parts.push(`rooms: [${pin.rooms.map(r => `'${r}'`).join(', ')}]`)
    if (pin.sensors) parts.push(`sensors: [${pin.sensors.map(s => `'${s}'`).join(', ')}]`)
    if (pin.showAir) parts.push(`showAir: true`)
    if (pin.showLux) parts.push(`showLux: true`)
    if (pin.showClimate) parts.push(`showClimate: true`)
    if (pin.detail) parts.push(`detail: '${pin.detail.replace(/'/g, "\\'")}'`)
    return `  { ${parts.join(', ')} },`
  })
  return `const pins: Pin[] = [\n${lines.join('\n')}\n]`
}

function formatErrorDetail(payload: unknown): string {
  if (payload == null) return ''
  if (typeof payload === 'string') return payload
  if (typeof payload === 'object') {
    const obj = payload as Record<string, unknown>
    if (typeof obj.detail === 'string' && obj.detail) return obj.detail
    if (obj.detail != null) {
      try { return JSON.stringify(obj.detail) } catch (error) { return String(obj.detail) }
    }
    if (typeof obj.error === 'string' && obj.error) return obj.error
    try { return JSON.stringify(obj) } catch (error) { return String(obj) }
  }
  return String(payload)
}

export function HomeDashboard() {
  const [mode, setMode] = useState<Mode>('demo')
  const [adminPassword, setAdminPassword] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [liveConnected, setLiveConnected] = useState(false)
  const [pins, setPins] = useState<Pin[]>(initialPins)
  const [lights, setLights] = useState(initialLights)
  const [fans, setFans] = useState<Record<FanKey, boolean>>(initialFans)
  const [presence, setPresence] = useState<Record<SensorKey, boolean>>(initialPresence)
  const [distances, setDistances] = useState<Record<SensorKey, number>>(initialDistances)
  const [lux, setLux] = useState(126)

  const [outdoorTemp, setOutdoorTemp] = useState(31)
  const [outdoorHum, setOutdoorHum] = useState(76)
  const [grandparentsTemp, setGrandparentsTemp] = useState(28.2)
  const [grandparentsHum, setGrandparentsHum] = useState(72)
  const [diningTemp, setDiningTemp] = useState(26.4)
  const [diningHum, setDiningHum] = useState(68)

  const [mq2Bedroom, setMq2Bedroom] = useState(120)
  const [co2Dining, setCo2Dining] = useState(650)
  const [mq2Threshold, setMq2Threshold] = useState(300)
  const [co2Threshold, setCo2Threshold] = useState(1000)

  const [automation, setAutomation] = useState(true)
  const [acOn, setAcOn] = useState(false)
  const [fanOn, setFanOn] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [copied, setCopied] = useState(false)
  const [events, setEvents] = useState([{ time: '14:02:10', message: 'LD2410 Phòng ông bà phát hiện người (1.8m) + Trời tối → Bật đèn phòng khách', type: 'auto' }, { time: '14:01:42', message: 'Hệ thống nhà thông minh đã sẵn sàng', type: 'system' }, { time: '13:58:06', message: 'Cảm biến sân vườn cập nhật 126 Lux', type: 'sensor' }])
  const isDay = lux > 300
  const floorCanvasRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{ id: string | null }>({ id: null })
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Automation timing refs
  const co2EscalationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const co2OffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const co2OffTickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [co2EscalationRemaining, setCo2EscalationRemaining] = useState<number | null>(null)
  const [co2OffRemaining, setCo2OffRemaining] = useState<number | null>(null)
  const co2EscalationStartedRef = useRef(false)
  const co2OffPendingRef = useRef(false)
  const naturalCoolingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const naturalCoolingTickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [naturalCoolingRemaining, setNaturalCoolingRemaining] = useState<number | null>(null)
  const naturalCoolingActiveRef = useRef(false)

  const addEvent = (message: string, type: 'auto' | 'manual' | 'sensor' | 'system' = 'manual') => setEvents(current => [{ time: timeLabel(), message, type }, ...current].slice(0, 12))

  const callHA = useCallback(async (init?: RequestInit & { password?: string }) => {
    const password = init?.password ?? adminPassword
    if (!password) throw new Error('Chưa có mật khẩu')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-admin-password': password,
      ...(init?.headers as Record<string, string> | undefined),
    }
    const response = await fetch(HA_API_PATH, { ...init, headers, cache: 'no-store' })
    return response
  }, [adminPassword])

  const applyStates = useCallback((states: HAState[]) => {
    const byId = new Map<string, HAState>()
    states.forEach(state => byId.set(state.entity_id, state))

    const readBool = (entityId: string): boolean | null => {
      if (!entityId) return null
      const state = byId.get(entityId)
      if (!state) return null
      return state.state === 'on'
    }
    const readNumber = (entityId: string): number | null => {
      if (!entityId) return null
      const state = byId.get(entityId)
      if (!state) return null
      const value = Number(state.state)
      return Number.isFinite(value) ? value : null
    }

    setLights(previous => {
      const updated = { ...previous }
      ;(Object.keys(ENTITY_MAP.lights) as RoomKey[]).forEach(room => {
        const value = readBool(ENTITY_MAP.lights[room])
        if (value !== null) updated[room] = value
      })
      return updated
    })

    setFans(previous => {
      const updated = { ...previous }
      ;(Object.keys(ENTITY_MAP.fans) as FanKey[]).forEach(key => {
        const value = readBool(ENTITY_MAP.fans[key])
        if (value !== null) updated[key] = value
      })
      return updated
    })

    const presenceMap: Record<SensorKey, string> = {
      sanVuon: ENTITY_MAP.sensors.sanVuonPresence,
      phongOngBa: ENTITY_MAP.sensors.phongOngBaPresence,
      nhaVeSinh: ENTITY_MAP.sensors.nhaVeSinhPresence,
      bep: ENTITY_MAP.sensors.bepPresence,
      phongAn: ENTITY_MAP.sensors.phongAnPresence,
      sanBe: ENTITY_MAP.sensors.sanBePresence,
      hienNha: ENTITY_MAP.sensors.hienNhaPresence,
      phongNgu: ENTITY_MAP.sensors.phongNguPresence,
    }
    setPresence(previous => {
      const updated = { ...previous }
      ;(Object.keys(presenceMap) as SensorKey[]).forEach(key => {
        const value = readBool(presenceMap[key])
        if (value !== null) updated[key] = value
      })
      return updated
    })

    const distanceMap: Record<SensorKey, string> = {
      sanVuon: ENTITY_MAP.sensors.sanVuonDistance,
      phongOngBa: ENTITY_MAP.sensors.phongOngBaDistance,
      nhaVeSinh: ENTITY_MAP.sensors.nhaVeSinhDistance,
      bep: ENTITY_MAP.sensors.bepDistance,
      phongAn: ENTITY_MAP.sensors.phongAnDistance,
      sanBe: ENTITY_MAP.sensors.sanBeDistance,
      hienNha: ENTITY_MAP.sensors.hienNhaDistance,
      phongNgu: ENTITY_MAP.sensors.phongNguDistance,
    }
    setDistances(previous => {
      const updated = { ...previous }
      ;(Object.keys(distanceMap) as SensorKey[]).forEach(key => {
        const value = readNumber(distanceMap[key])
        if (value !== null) updated[key] = value
      })
      return updated
    })

    const luxValue = readNumber(ENTITY_MAP.sensors.lux)
    if (luxValue !== null) setLux(Math.round(luxValue))

    const outdoorTempValue = readNumber(ENTITY_MAP.sensors.outdoorTemp)
    if (outdoorTempValue !== null) setOutdoorTemp(Number(outdoorTempValue.toFixed(1)))
    const outdoorHumValue = readNumber(ENTITY_MAP.sensors.outdoorHum)
    if (outdoorHumValue !== null) setOutdoorHum(Math.round(outdoorHumValue))

    const grandparentsTempValue = readNumber(ENTITY_MAP.sensors.grandparentsTemp)
    if (grandparentsTempValue !== null) setGrandparentsTemp(Number(grandparentsTempValue.toFixed(1)))
    const grandparentsHumValue = readNumber(ENTITY_MAP.sensors.grandparentsHum)
    if (grandparentsHumValue !== null) setGrandparentsHum(Math.round(grandparentsHumValue))

    const diningTempValue = readNumber(ENTITY_MAP.sensors.diningTemp)
    if (diningTempValue !== null) setDiningTemp(Number(diningTempValue.toFixed(1)))
    const diningHumValue = readNumber(ENTITY_MAP.sensors.diningHum)
    if (diningHumValue !== null) setDiningHum(Math.round(diningHumValue))

    const mq2Value = readNumber(ENTITY_MAP.sensors.mq2Bedroom)
    if (mq2Value !== null) setMq2Bedroom(Math.round(mq2Value))

    const co2Value = readNumber(ENTITY_MAP.sensors.co2Dining)
    if (co2Value !== null) setCo2Dining(Math.round(co2Value))

    const acValue = readBool(ENTITY_MAP.climate.ac)
    if (acValue !== null) setAcOn(acValue)
    const fanValue = readBool(ENTITY_MAP.climate.fan)
    if (fanValue !== null) setFanOn(fanValue)
  }, [])

  const syncFromHA = useCallback(async (silent = false) => {
    if (!adminPassword) return
    try {
      const response = await callHA({ method: 'GET', password: adminPassword })
      if (response.status === 401) {
        setLiveConnected(false)
        setAdminPassword('')
        setMode('demo')
        addEvent('Mật khẩu quản trị không còn hiệu lực, đã chuyển về chế độ Giả lập', 'system')
        return
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const detail = formatErrorDetail(body)
        if (!silent) addEvent(`Đồng bộ HA thất bại (${response.status})${detail ? `: ${detail}` : ''}`, 'system')
        return
      }
      const data = await response.json()
      if (Array.isArray(data?.states)) {
        applyStates(data.states as HAState[])
        if (!silent) addEvent('Đã đồng bộ trạng thái từ Home Assistant', 'sensor')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!silent) addEvent(`Không thể kết nối Home Assistant: ${message}`, 'system')
    }
  }, [adminPassword, callHA, applyStates])

  useEffect(() => {
    if (mode !== 'live' || !liveConnected) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }
    syncFromHA(true)
    pollingRef.current = setInterval(() => { syncFromHA(true) }, 3000)
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [mode, liveConnected, syncFromHA])

  const pushFanToHA = useCallback((key: FanKey, next: boolean) => {
    if (mode === 'live' && liveConnected) {
      const entityId = ENTITY_MAP.fans[key]
      callHA({ method: 'POST', body: JSON.stringify({ entity_id: entityId, action: next ? 'turn_on' : 'turn_off' }) })
        .then(async response => {
          if (!response.ok) {
            const body = await response.json().catch(() => null)
            const detail = formatErrorDetail(body)
            addEvent(`HA từ chối lệnh cho ${entityId} (${response.status})${detail ? `: ${detail}` : ''}`, 'system')
          }
        })
        .catch(error => {
          const message = error instanceof Error ? error.message : String(error)
          addEvent(`Không gửi được lệnh tới ${entityId}: ${message}`, 'system')
        })
    }
  }, [mode, liveConnected, callHA])

  const toggleLight = (room: RoomKey, title: string) => {
    const next = !lights[room]
    setLights(previous => ({ ...previous, [room]: next }))
    addEvent(`${title} · ${next ? 'Đã bật' : 'Đã tắt'} đèn`, 'manual')
    if (mode === 'live' && liveConnected) {
      const entityId = ENTITY_MAP.lights[room]
      callHA({ method: 'POST', body: JSON.stringify({ entity_id: entityId, action: next ? 'turn_on' : 'turn_off' }) })
        .then(async response => {
          if (!response.ok) {
            const body = await response.json().catch(() => null)
            const detail = formatErrorDetail(body)
            addEvent(`HA từ chối lệnh cho ${entityId} (${response.status})${detail ? `: ${detail}` : ''}`, 'system')
          }
        })
        .catch(error => {
          const message = error instanceof Error ? error.message : String(error)
          addEvent(`Không gửi được lệnh tới ${entityId}: ${message}`, 'system')
        })
    }
  }
  const toggleAllLights = () => {
    const anyOff = Object.values(lights).some(value => !value)
    const next = anyOff
    setLights(previous => {
      const updated = { ...previous }
      ;(Object.keys(updated) as RoomKey[]).forEach(room => { updated[room] = next })
      return updated
    })
    addEvent(next ? 'Đã bật tất cả đèn' : 'Đã tắt tất cả đèn', 'manual')
    if (mode === 'live' && liveConnected) {
      ;(Object.keys(ENTITY_MAP.lights) as RoomKey[]).forEach(room => {
        const entityId = ENTITY_MAP.lights[room]
        callHA({ method: 'POST', body: JSON.stringify({ entity_id: entityId, action: next ? 'turn_on' : 'turn_off' }) })
          .catch(error => {
            const message = error instanceof Error ? error.message : String(error)
            addEvent(`Không gửi được lệnh tới ${entityId}: ${message}`, 'system')
          })
      })
    }
  }

  const togglePresence = (sensor: SensorKey) => {
    const next = !presence[sensor]
    setPresence(previous => ({ ...previous, [sensor]: next }))
    const label = SENSOR_LABELS[sensor]
    addEvent(`LD2410 ${label} ${next ? `phát hiện người (${distances[sensor].toFixed(1)}m)` : 'không còn phát hiện người'}`, 'sensor')
  }

  const updateLux = (value: number) => {
    setLux(value)
    if (automation && value < 150) {
      if (presence.phongOngBa) {
        setLights(previous => ({ ...previous, khach: true }))
      }
      if (presence.nhaVeSinh) {
        setLights(previous => ({ ...previous, veSinh: true }))
      }
      if (presence.phongNgu) {
        setLights(previous => ({ ...previous, warmDownlight: true }))
      }
      if (presence.phongOngBa || presence.nhaVeSinh || presence.phongNgu) {
        addEvent(`Ánh sáng thấp (${value} Lux) + có người → Tự động bật đèn`, 'auto')
      }
    }
  }

  const toggleAutomation = () => {
    const next = !automation
    setAutomation(next)
    addEvent(`Tự động hóa thông minh ${next ? 'đã bật' : 'đã tắt'}`)
  }

  const toggleFan = (key: FanKey) => {
    const next = !fans[key]
    const label = FAN_LABELS[key]
    setFans(previous => ({ ...previous, [key]: next }))
    addEvent(`${label} · ${next ? 'Đã bật' : 'Đã tắt'}`, 'manual')
    if (mode === 'live' && liveConnected) {
      const entityId = ENTITY_MAP.fans[key]
      callHA({ method: 'POST', body: JSON.stringify({ entity_id: entityId, action: next ? 'turn_on' : 'turn_off' }) })
        .then(async response => {
          if (!response.ok) {
            const body = await response.json().catch(() => null)
            const detail = formatErrorDetail(body)
            addEvent(`HA từ chối lệnh cho ${entityId} (${response.status})${detail ? `: ${detail}` : ''}`, 'system')
          }
        })
        .catch(error => {
          const message = error instanceof Error ? error.message : String(error)
          addEvent(`Không gửi được lệnh tới ${entityId}: ${message}`, 'system')
        })
    }
  }

  const summary = useMemo(() => `${Object.values(lights).filter(Boolean).length + Object.values(fans).filter(Boolean).length} thiết bị đang hoạt động`, [lights, fans])
  const allLightsOn = useMemo(() => Object.values(lights).every(Boolean), [lights])

  const updatePinPosition = useCallback((id: string, clientX: number, clientY: number) => {
    const canvas = floorCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100))
    setPins(current => current.map(pin => pin.id === id ? { ...pin, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 } : pin))
  }, [])

  useEffect(() => {
    if (!editMode) return
    const handleMove = (event: PointerEvent) => {
      const id = dragStateRef.current.id
      if (!id) return
      updatePinPosition(id, event.clientX, event.clientY)
    }
    const handleUp = () => { dragStateRef.current.id = null }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [editMode, updatePinPosition])

  const handlePinDragStart = (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
    if (!editMode) return
    event.preventDefault()
    event.stopPropagation()
    dragStateRef.current.id = id
    updatePinPosition(id, event.clientX, event.clientY)
  }

  const copyPinsCode = async () => {
    const code = pinsToCode(pins)
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = code
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      addEvent('Đã copy tọa độ pins mới vào clipboard', 'manual')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      addEvent('Không thể copy tọa độ, vui lòng copy thủ công', 'manual')
    }
  }

  const authenticate = async () => {
    if (!passwordInput.trim()) {
      setAuthError('Vui lòng nhập mật khẩu quản trị')
      return
    }
    setAuthLoading(true)
    setAuthError('')
    try {
      const response = await fetch(HA_API_PATH, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': passwordInput,
        },
        cache: 'no-store',
      })

      if (response.status === 404) {
        setAuthError(`Không tìm thấy API ${HA_API_PATH} (404). Kiểm tra lại cấu hình next.config.mjs (không được dùng output: 'export') và đảm bảo file app/api/ha/route.ts tồn tại, sau đó redeploy Vercel.`)
        setAuthLoading(false)
        return
      }

      if (response.status === 401) {
        setAuthError('Mật khẩu không chính xác')
        setAuthLoading(false)
        return
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const detail = formatErrorDetail(body)
        setAuthError(`Không kết nối được máy chủ (${response.status})${detail ? `: ${detail}` : ''}`)
        setAuthLoading(false)
        return
      }

      const data = await response.json()
      if (!Array.isArray(data?.states)) {
        setAuthError('Máy chủ trả về dữ liệu không hợp lệ')
        setAuthLoading(false)
        return
      }

      setAdminPassword(passwordInput)
      setPasswordInput('')
      setLiveConnected(true)
      setMode('live')
      applyStates(data.states as HAState[])
      try {
        if (typeof window !== 'undefined') window.sessionStorage.setItem('ha_admin_password', passwordInput)
      } catch (error) {}
      addEvent('Đã xác thực và kết nối Home Assistant', 'system')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setAuthError(`Không thể kết nối tới máy chủ: ${message}`)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSelectLive = () => {
    setAuthError('')
    if (liveConnected && adminPassword) {
      setMode('live')
      addEvent('Đã chuyển sang chế độ Kết nối thực tế', 'system')
      return
    }
    setMode('live')
  }

  const handleSelectDemo = () => {
    setMode('demo')
    setLiveConnected(false)
    setAdminPassword('')
    setPasswordInput('')
    setAuthError('')
    try {
      if (typeof window !== 'undefined') window.sessionStorage.removeItem('ha_admin_password')
    } catch (error) {}
    addEvent('Đã chuyển sang chế độ Giả lập')
  }

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const stored = window.sessionStorage.getItem('ha_admin_password')
      if (!stored) return
      setAdminPassword(stored)
      setLiveConnected(true)
    } catch (error) {}
  }, [])

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      if (co2EscalationTimerRef.current) clearTimeout(co2EscalationTimerRef.current)
      if (co2OffTimerRef.current) clearTimeout(co2OffTimerRef.current)
      if (co2OffTickRef.current) clearInterval(co2OffTickRef.current)
      if (naturalCoolingTimerRef.current) clearTimeout(naturalCoolingTimerRef.current)
      if (naturalCoolingTickRef.current) clearInterval(naturalCoolingTickRef.current)
    }
  }, [])

  useEffect(() => {
    if (automation) return
    if (co2EscalationTimerRef.current) { clearTimeout(co2EscalationTimerRef.current); co2EscalationTimerRef.current = null }
    if (co2OffTimerRef.current) { clearTimeout(co2OffTimerRef.current); co2OffTimerRef.current = null }
    if (co2OffTickRef.current) { clearInterval(co2OffTickRef.current); co2OffTickRef.current = null }
    setCo2EscalationRemaining(null)
    setCo2OffRemaining(null)
    co2EscalationStartedRef.current = false
    co2OffPendingRef.current = false
    if (naturalCoolingTimerRef.current) { clearTimeout(naturalCoolingTimerRef.current); naturalCoolingTimerRef.current = null }
    if (naturalCoolingTickRef.current) { clearInterval(naturalCoolingTickRef.current); naturalCoolingTickRef.current = null }
    setNaturalCoolingRemaining(null)
    naturalCoolingActiveRef.current = false
  }, [automation])

  // Rule 1
  useEffect(() => {
    if (!automation) return
    if (mq2Bedroom > mq2Threshold) {
      if (!fans.exhaustBedroom) {
        setFans(previous => ({ ...previous, exhaustBedroom: true }))
        addEvent('Cảnh báo khói MQ2 phòng ngủ vượt ngưỡng → Bật quạt hút mùi phòng ngủ', 'auto')
        pushFanToHA('exhaustBedroom', true)
      }
    } else {
      if (fans.exhaustBedroom) {
        setFans(previous => ({ ...previous, exhaustBedroom: false }))
        addEvent('Khói MQ2 phòng ngủ đã giảm dưới ngưỡng → Tắt quạt hút mùi phòng ngủ', 'auto')
        pushFanToHA('exhaustBedroom', false)
      }
    }
  }, [mq2Bedroom, mq2Threshold, automation, fans.exhaustBedroom, pushFanToHA])

  // Rule 2
  useEffect(() => {
    if (!automation) return
    if (co2Dining > co2Threshold) {
      if (co2OffTimerRef.current) { clearTimeout(co2OffTimerRef.current); co2OffTimerRef.current = null }
      if (co2OffTickRef.current) { clearInterval(co2OffTickRef.current); co2OffTickRef.current = null }
      setCo2OffRemaining(null)
      co2OffPendingRef.current = false
      if (!fans.freshAirFan) {
        setFans(previous => ({ ...previous, freshAirFan: true }))
        addEvent('CO2 phòng ăn vượt ngưỡng → Bật quạt gió tươi', 'auto')
        pushFanToHA('freshAirFan', true)
      }
      if (!co2EscalationStartedRef.current) {
        co2EscalationStartedRef.current = true
        if (co2EscalationTimerRef.current) clearTimeout(co2EscalationTimerRef.current)
        const tick = setInterval(() => {
          setCo2EscalationRemaining(prev => (prev !== null && prev > 1 ? prev - 1 : 0))
        }, 1000)
        setCo2EscalationRemaining(60)
        co2EscalationTimerRef.current = setTimeout(() => {
          clearInterval(tick)
          setCo2EscalationRemaining(null)
          if (!fans.exhaustDining) {
            setFans(previous => ({ ...previous, exhaustDining: true }))
            addEvent('CO2 phòng ăn không giảm sau 1 phút → Bật thêm quạt hút mùi phòng ăn', 'auto')
            pushFanToHA('exhaustDining', true)
          }
        }, 60000)
        if (co2OffTickRef.current) clearInterval(co2OffTickRef.current)
        co2OffTickRef.current = tick
      }
    } else {
      if (co2EscalationTimerRef.current) { clearTimeout(co2EscalationTimerRef.current); co2EscalationTimerRef.current = null }
      if (co2OffTickRef.current) { clearInterval(co2OffTickRef.current); co2OffTickRef.current = null }
      setCo2EscalationRemaining(null)
      co2EscalationStartedRef.current = false
      if ((fans.freshAirFan || fans.exhaustDining) && !co2OffPendingRef.current) {
        co2OffPendingRef.current = true
        setCo2OffRemaining(180)
        const tick = setInterval(() => {
          setCo2OffRemaining(prev => (prev !== null && prev > 1 ? prev - 1 : 0))
        }, 1000)
        co2OffTimerRef.current = setTimeout(() => {
          clearInterval(tick)
          setCo2OffRemaining(null)
          co2OffPendingRef.current = false
          setFans(previous => ({ ...previous, freshAirFan: false, exhaustDining: false }))
          addEvent('CO2 phòng ăn đạt chuẩn 3 phút → Tắt quạt gió tươi và quạt hút mùi phòng ăn', 'auto')
          pushFanToHA('freshAirFan', false)
          pushFanToHA('exhaustDining', false)
        }, 180000)
        if (co2OffTickRef.current) clearInterval(co2OffTickRef.current)
        co2OffTickRef.current = tick
      }
    }
  }, [co2Dining, co2Threshold, automation, fans.freshAirFan, fans.exhaustDining, pushFanToHA])

  // Rule 3
  useEffect(() => {
    if (!automation) return
    const outdoorOk = outdoorTemp < 28
    const roomTooHot = grandparentsTemp > 30 || diningTemp > 30
    const hasPresence = (grandparentsTemp > 30 && presence.phongOngBa) || (diningTemp > 30 && presence.phongAn) || (grandparentsTemp > 30 && presence.phongNgu) || (diningTemp > 30 && presence.bep)
    const shouldActivate = outdoorOk && roomTooHot && hasPresence
    if (shouldActivate && !naturalCoolingActiveRef.current) {
      naturalCoolingActiveRef.current = true
      if (!fans.freshAirFan) {
        setFans(previous => ({ ...previous, freshAirFan: true }))
        pushFanToHA('freshAirFan', true)
      }
      addEvent('Nhiệt độ ngoài trời < 28°C, trong phòng > 30°C và có người → Bật quạt gió tươi 15 phút', 'auto')
      setNaturalCoolingRemaining(900)
      const tick = setInterval(() => {
        setNaturalCoolingRemaining(prev => {
          if (prev === null || prev <= 1) { clearInterval(tick); return 0 }
          return prev - 1
        })
      }, 1000)
      if (naturalCoolingTickRef.current) clearInterval(naturalCoolingTickRef.current)
      naturalCoolingTickRef.current = tick
      naturalCoolingTimerRef.current = setTimeout(() => {
        clearInterval(tick)
        setNaturalCoolingRemaining(null)
        naturalCoolingActiveRef.current = false
        if (co2Dining <= co2Threshold) {
          setFans(previous => ({ ...previous, freshAirFan: false }))
          addEvent('Hết 15 phút làm mát tự nhiên → Tắt quạt gió tươi', 'auto')
          pushFanToHA('freshAirFan', false)
        }
      }, 900000)
    } else if (!shouldActivate && naturalCoolingActiveRef.current) {
      if (naturalCoolingTimerRef.current) { clearTimeout(naturalCoolingTimerRef.current); naturalCoolingTimerRef.current = null }
      if (naturalCoolingTickRef.current) { clearInterval(naturalCoolingTickRef.current); naturalCoolingTickRef.current = null }
      setNaturalCoolingRemaining(null)
      naturalCoolingActiveRef.current = false
      if (co2Dining <= co2Threshold) {
        setFans(previous => ({ ...previous, freshAirFan: false }))
        pushFanToHA('freshAirFan', false)
      }
      addEvent('Điều kiện làm mát tự nhiên không còn → Dừng quạt gió tươi', 'auto')
    }
  }, [outdoorTemp, grandparentsTemp, diningTemp, presence, automation, co2Dining, co2Threshold, fans.freshAirFan, pushFanToHA])

  // Helper to build detail strings for pins
  const buildPinDetail = (pin: Pin): string | undefined => {
    if (pin.sensor) {
      return `${presence[pin.sensor] ? 'Có người · ' : 'Trống · '}${distances[pin.sensor].toFixed(1)} m`
    }
    if (pin.fan) return fans[pin.fan] ? 'Đang bật' : 'Đang tắt'
    if (pin.id === 'ambient') return `${lux} Lux`
    if (pin.id === 'weather') return `${outdoorTemp.toFixed(1)}° · ${outdoorHum}%`
    if (pin.id === 'bedroom-climate') return acOn ? '24° · Đang bật' : '27.1° · 64%'
    if (pin.id === 'an-climate') return `${diningTemp.toFixed(1)}° · ${diningHum}%`
    if (pin.id === 'living-climate') return `${grandparentsTemp.toFixed(1)}° · ${grandparentsHum}%`
    if (pin.id === 'garden-climate') return `${outdoorTemp.toFixed(1)}° · ${outdoorHum}%`
    if (pin.id === 'bedroom-mq2') return `MQ2 · ${mq2Bedroom} ppm${mq2Bedroom > mq2Threshold ? ' ⚠️' : ''}`
    if (pin.id === 'dining-co2') return `CO2 · ${co2Dining} ppm${co2Dining > co2Threshold ? ' ⚠️' : ''}`
    return pin.detail
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Trang chủ Smart Living"><span className="brand-mark"><Home size={17} strokeWidth={1.8} /></span><span className="brand-name">nếp<span>.</span><small>SMART LIVING</small></span></a>
        <div className="breadcrumb"><span>Không gian</span><ChevronRight size={13} /><strong>Nhà của Minh</strong><span className="status-dot" /> <span className="online-label">Trực tuyến</span></div>
        <div className="top-actions"><button className="icon-button" aria-label="Trợ giúp"><CircleHelp size={17} /></button><button className="icon-button" aria-label="Cài đặt"><Settings2 size={17} /></button><div className="avatar">M</div></div>
      </header>

      <section className="workspace">
        <div className="main-column">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> TỔNG QUAN NGÔI NHÀ</div><h1>Chào buổi chiều, Minh <span className="heading-sun"><Sun size={23} /></span></h1><p>Ngôi nhà của bạn đang vận hành bình thường.</p></div><div className="heading-actions"><button className="outline-button" onClick={() => addEvent('Đã làm mới trạng thái thiết bị', 'sensor')}><Activity size={15} /> Cập nhật <span className="live-indicator" /></button><button className="outline-button" onClick={toggleAllLights}><Lightbulb size={15} /> {allLightsOn ? 'Tắt tất cả đèn' : 'Bật tất cả đèn'}</button></div></div>
          <div className="metrics-row">
            <article className="metric-card"><div className="metric-icon warm"><Thermometer size={17} /></div><span className="metric-label">NHIỆT ĐỘ TRONG NHÀ</span><div className="metric-reading">{grandparentsTemp.toFixed(1)}<span>°C</span><span className="metric-trend up"><ArrowUpRight size={13} /> 1.2°</span></div><div className="metric-foot">Phòng ông bà <span>Thoải mái</span></div></article>
            <article className="metric-card"><div className="metric-icon blue"><Waves size={17} /></div><span className="metric-label">ĐỘ ẨM</span><div className="metric-reading">{grandparentsHum}<span>%</span><span className="metric-trend down"><ArrowDownRight size={13} /> 2%</span></div><div className="metric-foot">Trong nhà <span>Bình thường</span></div></article>
            <article className="metric-card"><div className="metric-icon amber"><Sun size={17} /></div><span className="metric-label">ÁNH SÁNG NGOÀI TRỜI</span><div className="metric-reading">{lux}<span>Lux</span></div><div className="metric-foot">Sân vườn <span>{isDay ? 'Ban ngày' : 'Ánh sáng thấp'}</span></div></article>
            <article className="metric-card"><div className="metric-icon green"><Zap size={17} /></div><span className="metric-label">THIẾT BỊ ĐANG BẬT</span><div className="metric-reading">{Object.values(lights).filter(Boolean).length + Object.values(fans).filter(Boolean).length + Number(acOn) + Number(fanOn)}<span>/ 20</span></div><div className="metric-foot">{summary}<span className="healthy"><span /> Ổn định</span></div></article>
          </div>

          <section className="floor-card" aria-label="Sơ đồ mặt bằng tương tác">
            <div className="floor-header"><div><div className="floor-title"><h2>Sơ đồ mặt bằng</h2><span className="live-pill"><span /> TRỰC TIẾP</span></div><p>Chọn thiết bị trên bản đồ để điều khiển</p></div><div className="floor-tools"><span className="floor-location"><Home size={13} /> Tầng trệt</span>{editMode && <button className="outline-button" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={copyPinsCode}>{copied ? 'Đã copy!' : 'Copy tọa độ'}</button>}<button className={`outline-button ${editMode ? 'is-active' : ''}`} style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => { const next = !editMode; setEditMode(next); addEvent(next ? 'Đã bật chế độ chỉnh tọa độ pins' : 'Đã tắt chế độ chỉnh tọa độ pins', 'manual') }}>{editMode ? 'Xong' : 'Chỉnh tọa độ'}</button><button className="dots-button" aria-label="Thêm tùy chọn"><MoreHorizontal size={19} /></button></div></div>
            <div className={`floor-canvas ${editMode ? 'is-editing' : ''}`} ref={floorCanvasRef}>
              <img className="floor-image" src={floorImage} alt="Sơ đồ 3D nhìn từ trên xuống của ngôi nhà, gồm phòng khách, nhà bếp, phòng ngủ và sân vườn" />
              <div className="floor-vignette" />
              {isDay && (
                <img
                  src="/floor-plan/day-on.png"
                  alt=""
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none',
                    mixBlendMode: 'lighten',
                    transition: 'opacity 0.3s ease',
                    opacity: 1,
                  }}
                />
              )}
              {(Object.keys(roomLightImages) as RoomKey[]).map(room => {
                const src = roomLightImages[room]
                if (!src) {
                  return (
                    <div
                      key={room}
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        background: lights[room]
                          ? 'radial-gradient(circle at 42.7% 13.4%, rgba(255, 236, 140, 0.55) 0%, rgba(255, 236, 140, 0.25) 12%, rgba(255, 236, 140, 0.08) 22%, transparent 34%)'
                          : 'transparent',
                        transition: 'opacity 0.3s ease',
                        opacity: lights[room] ? 1 : 0,
                        mixBlendMode: 'lighten',
                      }}
                    />
                  )
                }
                return (
                  <img
                    key={room}
                    src={src}
                    alt=""
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      pointerEvents: 'none',
                      mixBlendMode: 'lighten',
                      transition: 'opacity 0.3s ease',
                      opacity: lights[room] ? 1 : 0,
                    }}
                  />
                )
              })}
              <div className="floor-grid" aria-hidden="true" />
              {pins.map(pin => (
                <PinButton
                  key={pin.id}
                  pin={pin}
                  lights={lights}
                  presence={presence}
                  fans={fans}
                  lux={lux}
                  editMode={editMode}
                  onLight={toggleLight}
                  onPresence={togglePresence}
                  onFan={toggleFan}
                  onDragStart={handlePinDragStart}
                  acOn={acOn}
                  onAc={() => { const next = !acOn; setAcOn(next); addEvent(`Điều hòa Daikin ${next ? 'đã bật · 24°C' : 'đã tắt'}`); if (mode === 'live' && liveConnected) { callHA({ method: 'POST', body: JSON.stringify({ entity_id: ENTITY_MAP.climate.ac, action: next ? 'turn_on' : 'turn_off' }) }).catch(error => { const message = error instanceof Error ? error.message : String(error); addEvent(`Không gửi được lệnh điều hòa: ${message}`, 'system') }) } }}
                  outdoorTemp={outdoorTemp}
                  outdoorHum={outdoorHum}
                  grandparentsTemp={grandparentsTemp}
                  grandparentsHum={grandparentsHum}
                  diningTemp={diningTemp}
                  diningHum={diningHum}
                  mq2Bedroom={mq2Bedroom}
                  mq2Threshold={mq2Threshold}
                  co2Dining={co2Dining}
                  co2Threshold={co2Threshold}
                  co2OffRemaining={co2OffRemaining}
                  naturalCoolingRemaining={naturalCoolingRemaining}
                  co2EscalationRemaining={co2EscalationRemaining}
                  distances={distances}
                  buildPinDetail={buildPinDetail}
                />
              ))}
              <div className="map-compass"><span>N</span><ArrowUpRight size={14} /></div>
              <div className="map-legend"><span><i className="legend-light" /> Đèn đang bật</span><span><i className="legend-presence" /> Có người</span><span><i className="legend-fan" /> Quạt đang bật</span></div>
            </div>
            <div className="floor-footer"><span><Radio size={13} /> 20 thiết bị <b>·</b> 8 cảm biến</span><span>{editMode ? 'Chế độ chỉnh tọa độ: kéo thả pin để di chuyển' : 'Cập nhật lần cuối: vừa xong'} <span className="sync-mark"><Activity size={13} /></span></span></div>
          </section>
          <div className="bottom-note"><ShieldCheck size={14} /> Hệ thống được bảo vệ <span>·</span> Đồng bộ lần cuối 14:02:10</div>
        </div>

        <aside className={`control-panel ${panelOpen ? '' : 'is-collapsed'}`}>
          <div className="panel-heading"><div><div className="panel-kicker">BẢNG ĐIỀU KHIỂN</div><h2>Điều khiển nhà</h2></div><button className="panel-collapse" onClick={() => setPanelOpen(!panelOpen)} aria-label={panelOpen ? 'Thu gọn bảng điều khiển' : 'Mở bảng điều khiển'}>{panelOpen ? <PanelRightClose size={17} /> : <ChevronDown size={17} />}</button></div>
          {panelOpen && <>
            <div className="mode-switch"><button className={mode === 'demo' ? 'selected' : ''} onClick={handleSelectDemo}><span className="mode-dot demo-dot" /> Giả lập</button><button className={mode === 'live' ? 'selected' : ''} onClick={handleSelectLive}><span className="mode-dot live-dot" /> Kết nối thực tế</button></div>
            {mode === 'live' && !liveConnected && (
              <div className="live-notice" style={{ display: 'block' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}><Lock size={14} /> Nhập mật khẩu quản trị để kết nối Home Assistant</div>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={event => setPasswordInput(event.target.value)}
                  placeholder="Mật khẩu quản trị"
                  aria-label="Mật khẩu quản trị"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.15)', marginBottom: '8px', fontSize: '13px' }}
                  onKeyDown={event => { if (event.key === 'Enter') authenticate() }}
                />
                <button className="outline-button" style={{ width: '100%', justifyContent: 'center' }} onClick={authenticate} disabled={authLoading}><Lock size={14} /> {authLoading ? 'Đang xác thực...' : 'Xác thực kết nối'}</button>
                {authError && <div style={{ color: '#d33', marginTop: '8px', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{authError}</div>}
              </div>
            )}
            {mode === 'live' && liveConnected && (
              <div className="live-notice"><Radio size={14} /> Đã kết nối Home Assistant · Đồng bộ mỗi 3 giây.</div>
            )}
            <section className="panel-section sensors-section"><div className="section-heading"><div><span className="section-icon"><Users size={15} /></span><h3>Cảm biến hiện diện</h3></div><span className="device-count">LD2410 <span>· 8</span></span></div>
              {(['sanVuon', 'phongOngBa', 'nhaVeSinh', 'bep', 'phongAn', 'sanBe', 'hienNha', 'phongNgu'] as SensorKey[]).map(sensor => { const label = SENSOR_LABELS[sensor]; return <div className="presence-card" key={sensor}><div className="presence-top"><div className={`presence-symbol ${presence[sensor] ? 'detected' : ''}`}><Users size={15} /></div><div className="presence-name"><strong>{label}</strong><span>{presence[sensor] ? 'Đang phát hiện người' : 'Không có người'}</span></div><button className={`mini-switch ${presence[sensor] ? 'on' : ''}`} aria-label={`${presence[sensor] ? 'Tắt' : 'Bật'} cảm biến ${label}`} aria-pressed={presence[sensor]} onClick={() => togglePresence(sensor)}><span /></button></div><div className="distance-row"><span>Khoảng cách</span><strong>{distances[sensor].toFixed(1)} <small>m</small></strong></div><input aria-label={`Khoảng cách ${label}`} type="range" min="0" max="6" step="0.1" value={distances[sensor]} onChange={e => setDistances(previous => ({ ...previous, [sensor]: Number(e.target.value) }))} /></div> })}
            </section>
            <section className="panel-section environment-section"><div className="section-heading"><div><span className="section-icon sun-section"><Sun size={15} /></span><h3>Môi trường & An toàn</h3></div><button className="text-action" onClick={() => addEvent('Đã đồng bộ dữ liệu môi trường', 'sensor')}>Đồng bộ</button></div>
              <div className="environment-item"><div className="environment-label"><span><Sun size={14} /> Ánh sáng xung quanh</span><strong>{lux} <small>Lux</small> <span className={`day-tag ${isDay ? 'day' : ''}`}>{isDay ? 'NGÀY' : 'ĐÊM'}</span></strong></div><input aria-label="Ánh sáng xung quanh, Lux" type="range" min="0" max="1000" step="10" value={lux} onChange={e => updateLux(Number(e.target.value))} /><div className="range-ends"><span>0 Lux</span><span>1000 Lux</span></div></div>
              <div className="environment-item"><div className="environment-label"><span><Thermometer size={14} /> Nhiệt độ sân vườn</span><strong>{outdoorTemp.toFixed(1)}<small>°C</small></strong></div><input aria-label="Nhiệt độ sân vườn" type="range" min="15" max="42" step="0.5" value={outdoorTemp} onChange={e => setOutdoorTemp(Number(e.target.value))} /><div className="range-ends"><span>15°C</span><span>42°C</span></div></div>
              <div className="environment-item"><div className="environment-label"><span><Thermometer size={14} /> Nhiệt độ phòng ông bà</span><strong>{grandparentsTemp.toFixed(1)}<small>°C</small></strong></div><input aria-label="Nhiệt độ phòng ông bà" type="range" min="18" max="40" step="0.5" value={grandparentsTemp} onChange={e => setGrandparentsTemp(Number(e.target.value))} /><div className="range-ends"><span>18°C</span><span>40°C</span></div></div>
              <div className="environment-item"><div className="environment-label"><span><Thermometer size={14} /> Nhiệt độ phòng ăn</span><strong>{diningTemp.toFixed(1)}<small>°C</small></strong></div><input aria-label="Nhiệt độ phòng ăn" type="range" min="18" max="40" step="0.5" value={diningTemp} onChange={e => setDiningTemp(Number(e.target.value))} /><div className="range-ends"><span>18°C</span><span>40°C</span></div></div>
              <div className="environment-item"><div className="environment-label"><span><Wind size={14} /> Khói MQ2 phòng ngủ</span><strong>{mq2Bedroom} <small>ppm</small></strong></div><input aria-label="Khói MQ2 phòng ngủ" type="range" min="0" max="1000" step="10" value={mq2Bedroom} onChange={e => setMq2Bedroom(Number(e.target.value))} /><div className="range-ends"><span>0 ppm</span><span>1000 ppm</span></div><div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}><label style={{ fontSize: '11px' }}>Ngưỡng MQ2:</label><input aria-label="Ngưỡng cài đặt MQ2" type="number" min="0" max="1000" step="10" value={mq2Threshold} onChange={e => setMq2Threshold(Number(e.target.value))} style={{ width: '70px', padding: '2px 6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.15)', fontSize: '12px' }} /><span style={{ fontSize: '11px' }}>ppm</span></div></div>
              <div className="environment-item"><div className="environment-label"><span><Wind size={14} /> CO2 phòng ăn</span><strong>{co2Dining} <small>ppm</small></strong></div><input aria-label="CO2 phòng ăn" type="range" min="400" max="2500" step="10" value={co2Dining} onChange={e => setCo2Dining(Number(e.target.value))} /><div className="range-ends"><span>400 ppm</span><span>2500 ppm</span></div><div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}><label style={{ fontSize: '11px' }}>Ngưỡng CO2:</label><input aria-label="Ngưỡng cài đặt CO2" type="number" min="400" max="2500" step="50" value={co2Threshold} onChange={e => setCo2Threshold(Number(e.target.value))} style={{ width: '70px', padding: '2px 6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.15)', fontSize: '12px' }} /><span style={{ fontSize: '11px' }}>ppm</span></div></div>
              {co2EscalationRemaining !== null && <div style={{ fontSize: '12px', color: '#e67e22', marginTop: '4px' }}>⏳ CO2 chưa giảm: bật thêm quạt hút mùi phòng ăn sau {Math.floor(co2EscalationRemaining / 60)}:{String(co2EscalationRemaining % 60).padStart(2, '0')}</div>}
              {co2OffRemaining !== null && <div style={{ fontSize: '12px', color: '#27ae60', marginTop: '4px' }}>⏳ CO2 đạt chuẩn: tắt quạt sau {Math.floor(co2OffRemaining / 60)}:{String(co2OffRemaining % 60).padStart(2, '0')}</div>}
              {naturalCoolingRemaining !== null && <div style={{ fontSize: '12px', color: '#2980b9', marginTop: '4px' }}>🌬️ Làm mát tự nhiên: còn {Math.floor(naturalCoolingRemaining / 60)}:{String(naturalCoolingRemaining % 60).padStart(2, '0')}</div>}
            </section>
            <section className="automation-card"><div className="automation-heading"><div className="automation-icon"><Zap size={16} /></div><div><strong>Tự động hóa thông minh</strong><span>{automation ? 'Đang hoạt động' : 'Đã tạm dừng'}</span></div><button className={`mini-switch ${automation ? 'on' : ''}`} aria-label={`${automation ? 'Tắt' : 'Bật'} tự động hóa`} aria-pressed={automation} onClick={toggleAutomation}><span /></button></div><p>MQ2 &gt; ngưỡng: bật quạt hút mùi phòng ngủ. CO2 &gt; ngưỡng: bật quạt gió tươi, sau 1 phút bật thêm quạt hút mùi phòng ăn; CO2 đạt chuẩn 3 phút tắt cả hai. Trời mát &lt;28°C, phòng &gt;30°C, có người: bật quạt gió tươi 15 phút.</p></section>
            <section className="panel-section devices-section"><div className="section-heading"><div><span className="section-icon device-section"><Zap size={15} /></span><h3>Thiết bị nhanh</h3></div><button className="text-action" onClick={() => addEvent('Đã mở danh sách thiết bị')}>Tất cả <ChevronRight size={12} /></button></div><div className="quick-devices">
              <button className={`device-tile ${fans.exhaustBedroom ? 'active' : ''}`} onClick={() => toggleFan('exhaustBedroom')}><span className="tile-icon"><Fan size={17} /></span><span><strong>Hút mùi PN</strong><small>{fans.exhaustBedroom ? 'Đang bật' : 'Tắt'}</small></span><ChevronDown size={13} /></button>
              <button className={`device-tile ${fans.freshAirFan ? 'active' : ''}`} onClick={() => toggleFan('freshAirFan')}><span className="tile-icon"><Fan size={17} /></span><span><strong>Gió tươi</strong><small>{fans.freshAirFan ? 'Đang bật' : 'Tắt'}</small></span><ChevronDown size={13} /></button>
              <button className={`device-tile ${fans.exhaustDining ? 'active' : ''}`} onClick={() => toggleFan('exhaustDining')}><span className="tile-icon"><Fan size={17} /></span><span><strong>Hút mùi PA</strong><small>{fans.exhaustDining ? 'Đang bật' : 'Tắt'}</small></span><ChevronDown size={13} /></button>
              <button className={`device-tile ${acOn ? 'active' : ''}`} onClick={() => { const next = !acOn; setAcOn(next); addEvent(`Điều hòa Daikin ${next ? 'đã bật · 24°C' : 'đã tắt'}`); if (mode === 'live' && liveConnected) { callHA({ method: 'POST', body: JSON.stringify({ entity_id: ENTITY_MAP.climate.ac, action: next ? 'turn_on' : 'turn_off' }) }).catch(error => { const message = error instanceof Error ? error.message : String(error); addEvent(`Không gửi được lệnh điều hòa: ${message}`, 'system') }) } }}><span className="tile-icon"><AirVent size={17} /></span><span><strong>Điều hòa</strong><small>{acOn ? '24°C · Đang bật' : 'Daikin · Tắt'}</small></span><ChevronDown size={13} /></button>
              <button className={`device-tile ${fanOn ? 'active' : ''}`} onClick={() => { const next = !fanOn; setFanOn(next); addEvent(`Quạt trần ${next ? 'đã bật' : 'đã tắt'}`); if (mode === 'live' && liveConnected) { callHA({ method: 'POST', body: JSON.stringify({ entity_id: ENTITY_MAP.climate.fan, action: next ? 'turn_on' : 'turn_off' }) }).catch(error => { const message = error instanceof Error ? error.message : String(error); addEvent(`Không gửi được lệnh quạt: ${message}`, 'system') }) } }}><span className="tile-icon"><Fan size={17} /></span><span><strong>Quạt trần</strong><small>{fanOn ? 'Đang bật · Mức 2' : 'Phòng khách · Tắt'}</small></span><ChevronDown size={13} /></button>
            </div></section>
            <section className="event-section"><div className="section-heading"><div><span className="section-icon event-section-icon"><Activity size={15} /></span><h3>Nhật ký hoạt động</h3></div><button className="text-action" onClick={() => setEvents([])}>Xóa nhật ký</button></div><div className="event-list">{events.length ? events.map((event, index) => <div className="event-row" key={`${event.time}-${index}`}><span className={`event-dot ${event.type}`} /><span className="event-time">{event.time}</span><p>{event.message}</p></div>) : <p className="empty-events">Chưa có hoạt động mới.</p>}</div></section>
            <div className="panel-footer"><Battery size={13} /> Tất cả cảm biến đang kết nối <span className="footer-healthy"><span /> Tốt</span></div>
          </>}
        </aside>
      </section>
    </main>
  )
}

function PinButton({
  pin, lights, presence, fans, lux, editMode, onLight, onPresence, onFan, onDragStart, acOn, onAc,
  outdoorTemp, outdoorHum, grandparentsTemp, grandparentsHum, diningTemp, diningHum,
  mq2Bedroom, mq2Threshold, co2Dining, co2Threshold, co2OffRemaining, naturalCoolingRemaining, co2EscalationRemaining,
  distances, buildPinDetail,
}: {
  pin: Pin
  lights: Record<RoomKey, boolean>
  presence: Record<SensorKey, boolean>
  fans: Record<FanKey, boolean>
  lux: number
  editMode: boolean
  onLight: (room: RoomKey, title: string) => void
  onPresence: (sensor: SensorKey) => void
  onFan: (fan: FanKey) => void
  onDragStart: (event: React.PointerEvent<HTMLButtonElement>, id: string) => void
  acOn: boolean
  onAc: () => void
  outdoorTemp: number
  outdoorHum: number
  grandparentsTemp: number
  grandparentsHum: number
  diningTemp: number
  diningHum: number
  mq2Bedroom: number
  mq2Threshold: number
  co2Dining: number
  co2Threshold: number
  co2OffRemaining: number | null
  naturalCoolingRemaining: number | null
  co2EscalationRemaining: number | null
  distances: Record<SensorKey, number>
  buildPinDetail: (pin: Pin) => string | undefined
}) {
  const baseStyle: React.CSSProperties = {
    left: `${pin.x}%`,
    top: `${pin.y}%`,
    cursor: editMode ? 'grab' : undefined,
    touchAction: editMode ? 'none' : undefined,
  }

  // Group lights card
  if (pin.kind === 'group-lights' && pin.rooms) {
    const total = pin.rooms.length
    const onCount = pin.rooms.filter(r => lights[r]).length
    const anyOn = onCount > 0
    const click = () => { if (editMode) return }
    return (
      <div
        className={`map-pin map-pin-card group-lights-card ${anyOn ? 'pin-active' : ''} ${editMode ? 'pin-editable' : ''} pin-${pin.id}`}
        style={baseStyle}
        onPointerDown={event => onDragStart(event as unknown as React.PointerEvent<HTMLButtonElement>, pin.id)}
        title={editMode ? `${pin.title} · x: ${pin.x}, y: ${pin.y}` : pin.title}
      >
        <div className="group-header">
          <span className="group-title">{pin.title}</span>
          <span className="group-status">{onCount}/{total} bật</span>
        </div>
        <div className="group-buttons">
          {pin.rooms.map(room => (
            <button
              key={room}
              type="button"
              className={`group-btn ${lights[room] ? 'on' : ''}`}
              onClick={(e) => { e.stopPropagation(); if (!editMode) onLight(room, ROOM_TITLE[room]) }}
              title={ROOM_TITLE[room]}
            >
              {ROOM_SHORT[room]}
            </button>
          ))}
        </div>
        {editMode && <span className="pin-coords">{pin.x}% · {pin.y}%</span>}
      </div>
    )
  }

  // Group sensors card
  if (pin.kind === 'group-sensors' && pin.sensors && pin.sensors.length) {
    const primary = pin.sensors[0]
    const occupied = presence[primary]
    const click = () => { if (editMode) return; onPresence(primary) }
    const tempVal = pin.id.includes('pn') ? grandparentsTemp : pin.id.includes('pa') ? diningTemp : pin.id.includes('pk') ? grandparentsTemp : outdoorTemp
    const humVal = pin.id.includes('pn') ? grandparentsHum : pin.id.includes('pa') ? diningHum : pin.id.includes('pk') ? grandparentsHum : outdoorHum
    // For PN group use grandparent? Actually PN uses bedroom but we don't have bedroom temp; use grandparents as fallback
    const displayTemp = pin.id === 'group-sensors-pn' ? grandparentsTemp : pin.id === 'group-sensors-pa' ? diningTemp : pin.id === 'group-sensors-pk' ? grandparentsTemp : outdoorTemp
    const displayHum = pin.id === 'group-sensors-pn' ? grandparentsHum : pin.id === 'group-sensors-pa' ? diningHum : pin.id === 'group-sensors-pk' ? grandparentsHum : outdoorHum
    const airWarn = pin.showAir && ((pin.id === 'group-sensors-pn' && mq2Bedroom > mq2Threshold) || (pin.id === 'group-sensors-pa' && co2Dining > co2Threshold))
    return (
      <div
        className={`map-pin map-pin-card group-sensors-card ${occupied ? 'pin-detected' : ''} ${airWarn ? 'pin-warning' : ''} ${editMode ? 'pin-editable' : ''} pin-${pin.id}`}
        style={baseStyle}
        onPointerDown={event => onDragStart(event as unknown as React.PointerEvent<HTMLButtonElement>, pin.id)}
        title={editMode ? `${pin.title} · x: ${pin.x}, y: ${pin.y}` : pin.title}
      >
        <button type="button" className="group-sensor-presence" onClick={click} title={`Hiện diện ${SENSOR_SHORT[primary]}`}>
          <Users size={12} />
          <span>{SENSOR_SHORT[primary]}</span>
          <span className={`presence-dot ${occupied ? 'on' : ''}`} />
        </button>
        {pin.showClimate && (
          <div className="group-sensor-line">
            <Thermometer size={10} /> {displayTemp.toFixed(1)}° · {displayHum}%
          </div>
        )}
        {pin.showAir && pin.id === 'group-sensors-pn' && (
          <div className={`group-sensor-line ${mq2Bedroom > mq2Threshold ? 'warn' : ''}`}>
            <Wind size={10} /> MQ2: {mq2Bedroom} ppm
          </div>
        )}
        {pin.showAir && pin.id === 'group-sensors-pa' && (
          <div className={`group-sensor-line ${co2Dining > co2Threshold ? 'warn' : ''}`}>
            <Wind size={10} /> CO2: {co2Dining} ppm
          </div>
        )}
        {pin.showLux && (
          <div className="group-sensor-line">
            <Sun size={10} /> {lux} Lux
          </div>
        )}
        {editMode && <span className="pin-coords">{pin.x}% · {pin.y}%</span>}
      </div>
    )
  }

  // Standard pin
  const fanActive = pin.fan ? fans[pin.fan] : false
  const active = pin.room ? lights[pin.room] : pin.sensor ? presence[pin.sensor] : pin.fan ? fanActive : pin.id === 'bedroom-climate' ? acOn : false
  const icon = pin.kind === 'light' ? <Lightbulb size={13} /> : pin.kind === 'sensor' ? <Users size={13} /> : pin.kind === 'climate' ? <Thermometer size={13} /> : pin.kind === 'door' ? <DoorOpen size={13} /> : pin.kind === 'weather' ? <CloudSun size={13} /> : pin.kind === 'fan' ? <Fan size={13} /> : pin.kind === 'air' ? <Wind size={13} /> : lux > 300 ? <Sun size={13} /> : <Moon size={13} />
  const detail = buildPinDetail(pin)
  const isAirWarning = (pin.id === 'bedroom-mq2' && mq2Bedroom > mq2Threshold) || (pin.id === 'dining-co2' && co2Dining > co2Threshold)
  const click = () => { if (editMode) return; if (pin.room) onLight(pin.room, pin.title); else if (pin.sensor) onPresence(pin.sensor); else if (pin.fan) onFan(pin.fan); else if (pin.id === 'bedroom-climate') onAc() }

  let countdownText: string | null = null
  if (pin.fan === 'freshAirFan' && naturalCoolingRemaining !== null) {
    countdownText = `${Math.floor(naturalCoolingRemaining / 60)}:${String(naturalCoolingRemaining % 60).padStart(2, '0')}`
  }
  if (pin.fan === 'exhaustDining' && co2EscalationRemaining !== null) {
    countdownText = `Bật sau ${Math.floor(co2EscalationRemaining / 60)}:${String(co2EscalationRemaining % 60).padStart(2, '0')}`
  }
  if (pin.fan === 'freshAirFan' && co2OffRemaining !== null) {
    countdownText = `Tắt sau ${Math.floor(co2OffRemaining / 60)}:${String(co2OffRemaining % 60).padStart(2, '0')}`
  }

  return (
    <button
      type="button"
      className={`map-pin pin-${pin.kind} ${active ? 'pin-active' : ''} ${pin.sensor && active ? 'pin-detected' : ''} ${isAirWarning ? 'pin-warning' : ''} ${editMode ? 'pin-editable' : ''} pin-${pin.id}`}
      style={baseStyle}
      onClick={click}
      onPointerDown={event => onDragStart(event, pin.id)}
      aria-label={`${pin.title}${detail ? `, ${detail}` : ''}${editMode ? ', kéo để di chuyển' : pin.room || pin.sensor || pin.fan || pin.id === 'bedroom-climate' ? ', nhấn để điều khiển' : ''}`}
      aria-pressed={pin.room || pin.sensor || pin.fan || pin.id === 'bedroom-climate' ? active : undefined}
      title={editMode ? `${pin.title} · x: ${pin.x}, y: ${pin.y}` : pin.title}
    >
      <span className="pin-icon">{icon}</span>
      <span className="pin-copy">
        <strong>{pin.title}</strong>
        {detail && <small>{detail}</small>}
        {countdownText && <small style={{ color: '#e67e22', fontWeight: 600 }}>⏳ {countdownText}</small>}
        {editMode && <small className="pin-coords">{pin.x}% · {pin.y}%</small>}
      </span>
      {active && (pin.kind === 'light' || pin.kind === 'fan') && <span className="pin-status" />}
    </button>
  )
}
