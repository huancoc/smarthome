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

// Presence sensor keys - 9 zones (thêm kho)
type SensorKey =
  | 'kho'
  | 'sanVuon'
  | 'phongOngBa'
  | 'nhaVeSinh'
  | 'bep'
  | 'phongAn'
  | 'sanBe'
  | 'hienNha'
  | 'phongNgu'

// Exhaust / fresh-air fan keys - 4 độc lập (PA & PN đều có đủ 2 loại)
type FanKey = 'freshAirPA' | 'exhaustPA' | 'freshAirPN' | 'exhaustPN'

type PinKind = 'light' | 'sensor' | 'climate' | 'door' | 'weather' | 'ambient' | 'fan' | 'air'

type Pin = {
  id: string
  x: number
  y: number
  title: string
  kind: PinKind
  room?: RoomKey
  sensor?: SensorKey
  fan?: FanKey
  detail?: string
}
type Mode = 'demo' | 'live'
type HAState = { entity_id: string; state: string; attributes?: Record<string, unknown> }

const HA_API_PATH = '/api/ha'

// ============================================================
// CẤU HÌNH THỜI GIAN — CHẾ ĐỘ DEMO (rút ngắn còn 1–3 giây)
// Đổi lại giá trị trong ngoặc comment để hoàn nguyên vận hành thực tế.
// ============================================================
const TIMING = {
  // Rule 2: CO2 > ngưỡng, chờ escalate bật thêm hút mùi PA
  // Gốc: 60 giây
  co2Escalation: 2, // giây

  // Rule 2: CO2 đạt chuẩn, chờ tắt quạt
  // Gốc: 180 giây (3 phút)
  co2OffDelay: 2, // giây

  // Rule 3: Làm mát tự nhiên, chạy quạt gió tươi PA
  // Gốc: 900 giây (15 phút)
  naturalCoolingDuration: 2, // giây

  // Rule 4: Phòng trống, chờ tắt đèn
  // Gốc: 30 giây
  autoOffDelay: 2, // giây

  // Rule 5 - Giai đoạn 1: Hút mùi PN khởi động khi bật AC
  // Gốc: 300 giây (5 phút)
  acVentPhase1: 2, // giây

  // Rule 5 - Giai đoạn 2: Gió tươi PN trong chu kỳ
  // Gốc: 300 giây (5 phút)
  acVentCycleFresh: 2, // giây

  // Rule 5 - Giai đoạn 2: Hút mùi PN trong chu kỳ
  // Gốc: 900 giây (15 phút)
  acVentCycleExhaust: 3, // giây

  // Rule 5: Chu kỳ định kỳ khi AC hoạt động liên tục
  // Gốc: 7200 giây (2 giờ)
  acHourlyCycle: 3, // giây
}

// ============================================================
// CẤU HÌNH ENTITY THẬT TỪ HOME ASSISTANT
// ============================================================
const ENTITY_OVERRIDES = {
  // Ngưỡng quy đổi đơn vị khoảng cách LD2410 (cm → m nếu > 20)
  distanceCmThreshold: 20,
}

const ENTITY_MAP = {
  lights: {
    kho: 'light.phong_kho_den_phong_kho',
    bep: 'light.phong_bep_den_phong_bep',
    phongAn: 'light.phong_an_den_phong_an',
    veSinh: 'light.nha_ve_sinh_den_nha_ve_sinh',
    khach: 'light.phong_khach_den_phong_khach',
    hienTrai: 'light.loi_vao_den_loi_vao',
    hienPhai: 'light.den_hien_be_den_hien_be',
    sanBe: 'light.den_hien_be_den_hien_be',
    cuaBuong: 'light.phong_ngu_den_cua_buong_phong_ngu',
    denTranh: 'light.tu_led_den_led_tu',
    warmDownlight: 'light.phong_ngu_den_tran_phong_ngu',
    whiteDownlight: 'light.bang_dieu_khien_dau_giuong_o_cam_1_dau_giuong',
    yeelightPN: 'light.yeelight_color4_0x179dcb99',
    sanVuon: 'light.san_vuon_den_san_vuon',
    denCong: 'light.san_vuon_den_cong_san_vuon',
  } as Record<RoomKey, string>,
  sensors: {
    // 9-zone LD2410 presence
    khoPresence: 'binary_sensor.phong_kho_co_nguoi_phong_kho',
    khoDistance: 'sensor.phong_kho_khoang_cach_phat_hien_phong_kho',
    sanVuonPresence: 'binary_sensor.hanh_lang_co_nguoi_hanh_lang',
    sanVuonDistance: 'sensor.hanh_lang_khoang_cach_phat_hien_hanh_lang',
    phongOngBaPresence: 'binary_sensor.phong_khach_co_nguoi_phong_khach',
    phongOngBaDistance: 'sensor.phong_khach_khoang_cach_phat_hien_phong_khach',
    nhaVeSinhPresence: 'binary_sensor.nha_ve_sinh_co_nguoi_nha_ve_sinh',
    nhaVeSinhDistance: 'sensor.nha_ve_sinh_khoang_cach_phat_hien_nha_ve_sinh',
    bepPresence: 'binary_sensor.phong_bep_co_nguoi_phong_bep',
    bepDistance: 'sensor.phong_bep_khoang_cach_phat_hien_phong_bep',
    phongAnPresence: 'binary_sensor.phong_an_bh1750_light_sensor_co_nguoi',
    phongAnDistance: 'sensor.phong_an_bh1750_light_sensor_khoang_cach_phat_hien',
    sanBePresence: 'binary_sensor.radar_hlk_ld2450_co_nguoi_radar',
    sanBeDistance: 'sensor.hanh_lang_khoang_cach_phat_hien_hanh_lang',
    hienNhaPresence: 'binary_sensor.loi_vao_co_nguoi_loi_vao',
    hienNhaDistance: 'sensor.loi_vao_khoang_cach_phat_hien_loi_vao',
    phongNguPresence: 'binary_sensor.phong_ngu_cam_bien_co_nguoi_phong_ngu',
    phongNguDistance: 'sensor.phong_ngu_cam_bien_khoang_cach_phat_hien_phong_ngu',
    // Environment
    lux: 'sensor.phong_an_phong_an_cam_bien_do_sang',
    // Outdoor (Sân vườn / lối vào)
    outdoorTemp: 'sensor.loi_vao_nhiet_do_ngoai_troi',
    outdoorHum: 'sensor.loi_vao_do_am_ngoai_troi',
    // Phòng khách / ông bà
    grandparentsTemp: 'sensor.phong_khach_nhiet_do_phong_khach',
    grandparentsHum: 'sensor.phong_khach_do_am_phong_khach',
    // Phòng ăn
    diningTemp: 'sensor.phong_an_bh1750_light_sensor_nhiet_do',
    diningHum: 'sensor.phong_an_bh1750_light_sensor_do_am',
    // Phòng ngủ (từ Daikin AC)
    bedroomTemp: 'sensor.daikin_ac_bedroom_temprate',
    bedroomHum: 'sensor.daikin_ac_bedroom_humidity',
    // Safety & air
    mq2Bedroom: 'sensor.phong_ngu_cam_bien_cam_bien_khoi_mp2_phong_ngu',
    co2Dining: 'sensor.phong_an_bh1750_light_sensor_nong_do_co2',
  },
  climate: {
    ac: 'climate.daikin_ac_daikin_air_condition',
    fan: 'script.fan_power',
  },
  fans: {
    freshAirPA: 'switch.quat_phong_an_quat_gio_tuoi_phong_an',
    exhaustPA: 'switch.quat_phong_an_quat_hut_mui_phong_an',
    freshAirPN: 'switch.phong_ngu_quat_gio_tuoi_phong_ngu',
    exhaustPN: 'switch.phong_ngu_quat_hut_mui_phong_ngu',
  } as Record<FanKey, string>,
}

// Lấy domain từ entity_id
function domainOf(entityId: string): string {
  const idx = entityId.indexOf('.')
  return idx > 0 ? entityId.slice(0, idx) : 'homeassistant'
}

// Map action chuẩn HA cho từng domain
function haActionFor(domain: string, next: boolean): { service: string; data?: Record<string, unknown> } {
  if (domain === 'script') {
    // Script: không có turn_off — luôn gọi turn_on (script tự xử lý toggle)
    return { service: 'turn_on' }
  }
  if (domain === 'climate') {
    return next ? { service: 'turn_on' } : { service: 'turn_off' }
  }
  return { service: next ? 'turn_on' : 'turn_off' }
}

const floorImage = '/floor-plan/bg.jpg'
const floorImageDay = '/floor-plan/bg-day.jpg'

const lightLayers: Array<{ room: RoomKey; src: string }> = [
  { room: 'kho', src: '/floor-plan/kho.png' },
  { room: 'bep', src: '/floor-plan/bep.png' },
  { room: 'veSinh', src: '/floor-plan/wc.png' },
  { room: 'phongAn', src: '/floor-plan/phong-an.png' },
  { room: 'khach', src: '/floor-plan/phong-ong-ba.png' },
  { room: 'hienTrai', src: '/floor-plan/he-trai.png' },
  { room: 'hienPhai', src: '/floor-plan/he-phai.png' },
  { room: 'sanBe', src: '/floor-plan/san-be.png' },
  { room: 'cuaBuong', src: '/floor-plan/cua-buong.png' },
  { room: 'denTranh', src: '/floor-plan/den-tranh.png' },
  { room: 'warmDownlight', src: '/floor-plan/warm-downlight.png' },
  { room: 'whiteDownlight', src: '/floor-plan/white-downlight.png' },
  { room: 'yeelightPN', src: '/floor-plan/yeelight-PN.png' },
  { room: 'sanVuon', src: '/floor-plan/san-vuon.png' },
  { room: 'denCong', src: '/floor-plan/den-cong.png' },
]

const ROOM_TITLE: Record<RoomKey, string> = {
  kho: 'Đèn Kho',
  bep: 'Đèn Bếp',
  veSinh: 'Đèn WC',
  phongAn: 'Đèn PA',
  khach: 'Đèn PK',
  hienTrai: 'Hiên trái',
  hienPhai: 'Hiên phải',
  sanBe: 'Đèn SB',
  cuaBuong: 'Đèn cửa buồng',
  denTranh: 'Đèn tranh',
  warmDownlight: 'Downlight vàng',
  whiteDownlight: 'Downlight trắng',
  yeelightPN: 'Yeelight PN',
  sanVuon: 'Đèn SV',
  denCong: 'Đèn cổng',
}

const SENSOR_SHORT: Record<SensorKey, string> = {
  kho: 'Kho',
  sanVuon: 'SV',
  phongOngBa: 'PK',
  nhaVeSinh: 'WC',
  bep: 'Bếp',
  phongAn: 'PA',
  sanBe: 'SB',
  hienNha: 'Hiên',
  phongNgu: 'PN',
}

const SENSOR_LABELS: Record<SensorKey, string> = {
  kho: 'Kho',
  sanVuon: 'Sân vườn',
  phongOngBa: 'Phòng ông bà',
  nhaVeSinh: 'Nhà vệ sinh',
  bep: 'Bếp',
  phongAn: 'Phòng ăn',
  sanBe: 'Sân bể',
  hienNha: 'Hiên nhà',
  phongNgu: 'Phòng ngủ',
}

const FAN_LABELS: Record<FanKey, string> = {
  freshAirPA: 'Gió tươi PA',
  exhaustPA: 'Hút mùi PA',
  freshAirPN: 'Gió tươi PN',
  exhaustPN: 'Hút mùi PN',
}

const FAN_SHORT: Record<FanKey, string> = {
  freshAirPA: 'Gió tươi PA',
  exhaustPA: 'Hút mùi PA',
  freshAirPN: 'Gió tươi PN',
  exhaustPN: 'Hút mùi PN',
}

const initialPins: Pin[] = [
  { id: 'kho', x: 25, y: 25, title: 'Đèn Kho', kind: 'light', room: 'kho' },
  { id: 'bep', x: 25, y: 50, title: 'Đèn Bếp', kind: 'light', room: 'bep' },
  { id: 'an', x: 24.4, y: 67.9, title: 'Đèn PA', kind: 'light', room: 'phongAn' },
  { id: 'wc', x: 42.7, y: 13.4, title: 'Đèn WC', kind: 'light', room: 'veSinh' },
  { id: 'living', x: 55, y: 30, title: 'Đèn PK', kind: 'light', room: 'khach' },
  { id: 'yard', x: 46.8, y: 34.5, title: 'Đèn SB', kind: 'light', room: 'sanBe' },
  { id: 'door', x: 75.3, y: 38.1, title: 'Đèn cửa buồng', kind: 'light', room: 'cuaBuong' },
  { id: 'bedroom-light', x: 81.8, y: 8.5, title: 'Đèn tranh', kind: 'light', room: 'denTranh' },
  { id: 'warm-downlight', x: 79.5, y: 16.5, title: 'Downlight vàng', kind: 'light', room: 'warmDownlight' },
  { id: 'white-downlight', x: 83.5, y: 23.5, title: 'Downlight trắng', kind: 'light', room: 'whiteDownlight' },
  { id: 'yeelight-pn', x: 87.5, y: 16.5, title: 'Yeelight PN', kind: 'light', room: 'yeelightPN' },
  { id: 'porch-left', x: 58.4, y: 53.5, title: 'Hiên trái', kind: 'light', room: 'hienTrai' },
  { id: 'porch-right', x: 68.2, y: 52.8, title: 'Hiên phải', kind: 'light', room: 'hienPhai' },
  { id: 'garden', x: 85.2, y: 62.4, title: 'Đèn SV', kind: 'light', room: 'sanVuon' },
  { id: 'gate', x: 84.9, y: 86.1, title: 'Đèn cổng', kind: 'light', room: 'denCong' },

  { id: 'kho-presence', x: 25, y: 15, title: 'Kho', kind: 'sensor', sensor: 'kho' },
  { id: 'pn-presence', x: 86.5, y: 30.5, title: 'PN', kind: 'sensor', sensor: 'phongNgu' },
  { id: 'pk-presence', x: 63.6, y: 27.8, title: 'PK', kind: 'sensor', sensor: 'phongOngBa' },
  { id: 'pa-presence', x: 31.5, y: 64.5, title: 'PA', kind: 'sensor', sensor: 'phongAn' },
  { id: 'bep-presence', x: 28.5, y: 43.5, title: 'Bếp', kind: 'sensor', sensor: 'bep' },
  { id: 'wc-presence', x: 42.2, y: 4.8, title: 'WC', kind: 'sensor', sensor: 'nhaVeSinh' },
  { id: 'sb-presence', x: 52.5, y: 37.5, title: 'SB', kind: 'sensor', sensor: 'sanBe' },
  { id: 'sv-presence', x: 90.5, y: 68.5, title: 'SV', kind: 'sensor', sensor: 'sanVuon' },
  { id: 'hien-presence', x: 62.5, y: 57.5, title: 'Hiên', kind: 'sensor', sensor: 'hienNha' },

  { id: 'pn-climate', x: 83, y: 39, title: 'PN', kind: 'climate', detail: '27.1° · 64%' },
  { id: 'pk-climate', x: 70, y: 25, title: 'PK', kind: 'climate', detail: '28.2° · 72%' },
  { id: 'pa-climate', x: 28.6, y: 88.7, title: 'PA', kind: 'climate', detail: '26.4° · 68%' },
  { id: 'sv-climate', x: 77.5, y: 66.5, title: 'SV', kind: 'climate', detail: '31.0° · 76%' },

  { id: 'bedroom-mq2', x: 90.5, y: 33.5, title: 'MQ2 PN', kind: 'air', detail: '120 ppm' },
  { id: 'dining-co2', x: 33.5, y: 78.5, title: 'CO2 PA', kind: 'air', detail: '650 ppm' },
  { id: 'ambient', x: 92, y: 25, title: 'Ánh sáng', kind: 'ambient' },
  { id: 'weather', x: 94, y: 9, title: 'Thời tiết', kind: 'weather', detail: '31° · 76%' },

  { id: 'fresh-air-pa', x: 20.5, y: 73.5, title: 'Gió tươi PA', kind: 'fan', fan: 'freshAirPA' },
  { id: 'exhaust-pa', x: 20.5, y: 80.5, title: 'Hút mùi PA', kind: 'fan', fan: 'exhaustPA' },
  { id: 'fresh-air-pn', x: 90.2, y: 43.5, title: 'Gió tươi PN', kind: 'fan', fan: 'freshAirPN' },
  { id: 'exhaust-pn', x: 90.2, y: 48.5, title: 'Hút mùi PN', kind: 'fan', fan: 'exhaustPN' },

  { id: 'bedroom-ac', x: 76.5, y: 34.5, title: 'Điều hòa', kind: 'climate' },
]

const initialLights: Record<RoomKey, boolean> = {
  kho: false,
  bep: false,
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

const initialFans: Record<FanKey, boolean> = {
  freshAirPA: false,
  exhaustPA: false,
  freshAirPN: false,
  exhaustPN: false,
}

const initialPresence: Record<SensorKey, boolean> = {
  kho: false,
  sanVuon: false,
  phongOngBa: false,
  nhaVeSinh: false,
  bep: false,
  phongAn: false,
  sanBe: false,
  hienNha: false,
  phongNgu: false,
}

const initialDistances: Record<SensorKey, number> = {
  kho: 0,
  sanVuon: 0,
  phongOngBa: 1.8,
  nhaVeSinh: 1.2,
  bep: 0,
  phongAn: 0,
  sanBe: 0,
  hienNha: 0,
  phongNgu: 1.5,
}

const AUTO_GROUP_1: Array<{ sensor: SensorKey; room: RoomKey; label: string }> = [
  { sensor: 'kho', room: 'kho', label: 'Kho' },
  { sensor: 'bep', room: 'bep', label: 'Bếp' },
  { sensor: 'phongAn', room: 'phongAn', label: 'PA' },
  { sensor: 'nhaVeSinh', room: 'veSinh', label: 'WC' },
  { sensor: 'phongOngBa', room: 'khach', label: 'PK' },
  { sensor: 'phongNgu', room: 'warmDownlight', label: 'PN' },
  { sensor: 'sanBe', room: 'sanBe', label: 'SB' },
]

const AUTO_GROUP_3_SENSORS: SensorKey[] = ['sanVuon', 'hienNha']

const AUTO_OFF_MAP: Array<{ sensor: SensorKey; rooms: RoomKey[]; label: string }> = [
  { sensor: 'kho', rooms: ['kho'], label: 'Kho' },
  { sensor: 'bep', rooms: ['bep'], label: 'Bếp' },
  { sensor: 'phongAn', rooms: ['phongAn'], label: 'PA' },
  { sensor: 'nhaVeSinh', rooms: ['veSinh'], label: 'WC' },
  { sensor: 'phongOngBa', rooms: ['khach'], label: 'PK' },
  { sensor: 'phongNgu', rooms: ['warmDownlight', 'cuaBuong'], label: 'PN' },
  { sensor: 'sanBe', rooms: ['sanBe'], label: 'SB' },
]

function timeLabel() { return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date()) }

function pinsToCode(pins: Pin[]) {
  const lines = pins.map(pin => {
    const parts: string[] = [`id: '${pin.id}'`, `x: ${pin.x}`, `y: ${pin.y}`, `title: '${pin.title.replace(/'/g, "\\'")}'`, `kind: '${pin.kind}'`]
    if (pin.room) parts.push(`room: '${pin.room}'`)
    if (pin.sensor) parts.push(`sensor: '${pin.sensor}'`)
    if (pin.fan) parts.push(`fan: '${pin.fan}'`)
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

function formatCountdown(seconds: number | null): string {
  if (seconds === null) return ''
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
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
  const [bedroomTemp, setBedroomTemp] = useState(27.1)
  const [bedroomHum, setBedroomHum] = useState(64)

  const [mq2Bedroom, setMq2Bedroom] = useState(120)
  const [co2Dining, setCo2Dining] = useState(650)
  const [mq2Threshold, setMq2Threshold] = useState(300)
  const [co2Threshold, setCo2Threshold] = useState(1000)

  const [automation, setAutomation] = useState(true)
  const [acOn, setAcOn] = useState(false)
  const [acTargetTemp, setAcTargetTemp] = useState<number | null>(null)
  const [fanOn, setFanOn] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [copied, setCopied] = useState(false)
  const [events, setEvents] = useState([{ time: '14:02:10', message: 'LD2410 Phòng ông bà phát hiện người (1.8m) + Trời tối → Bật đèn phòng khách', type: 'auto' }, { time: '14:01:42', message: 'Hệ thống nhà thông minh đã sẵn sàng', type: 'system' }, { time: '13:58:06', message: 'Cảm biến sân vườn cập nhật 126 Lux', type: 'sensor' }])
  const isDay = lux > 300
  const floorCanvasRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{ id: string | null }>({ id: null })
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const entityLocksRef = useRef<Record<string, number>>({})

  const lockEntity = useCallback((entityId: string, durationMs = 2500) => {
    entityLocksRef.current[entityId] = Date.now() + durationMs
  }, [])

  const isEntityLocked = useCallback((entityId: string) => {
    const until = entityLocksRef.current[entityId]
    if (!until) return false
    if (Date.now() > until) {
      delete entityLocksRef.current[entityId]
      return false
    }
    return true
  }, [])

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

  const autoOffTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({})
  const autoOffTicksRef = useRef<Record<string, ReturnType<typeof setInterval> | null>>({})
  const [autoOffRemaining, setAutoOffRemaining] = useState<Record<string, number | null>>({})

  const acVentPhase1TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const acVentPhase1TickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [acVentPhase1Remaining, setAcVentPhase1Remaining] = useState<number | null>(null)

  const acVentCycleFreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const acVentCycleFreshTickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [acVentFreshRemaining, setAcVentFreshRemaining] = useState<number | null>(null)

  const acVentCycleExhaustTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const acVentCycleExhaustTickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [acVentExhaustRemaining, setAcVentExhaustRemaining] = useState<number | null>(null)

  const acHourlyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const acHourlyTickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [acHoursRemaining, setAcHoursRemaining] = useState<number | null>(null)

  const prevGroup1PresenceRef = useRef<Record<SensorKey, boolean>>({ ...initialPresence })
  const prevGroup2PresenceRef = useRef<Record<SensorKey, boolean>>({ ...initialPresence })
  const prevAutoOffPresenceRef = useRef<Record<SensorKey, boolean>>({ ...initialPresence })
  const prevLuxRef = useRef<number>(126)

  const presenceRef = useRef(presence)
  const lightsRef = useRef(lights)
  useEffect(() => { presenceRef.current = presence }, [presence])
  useEffect(() => { lightsRef.current = lights }, [lights])

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

    const readBoolSafe = (entityId: string): boolean | null => {
      if (!entityId) return null
      if (isEntityLocked(entityId)) return null
      return readBool(entityId)
    }
    const readNumberSafe = (entityId: string): number | null => {
      if (!entityId) return null
      if (isEntityLocked(entityId)) return null
      return readNumber(entityId)
    }

    setLights(previous => {
      const updated = { ...previous }
      ;(Object.keys(ENTITY_MAP.lights) as RoomKey[]).forEach(room => {
        const value = readBoolSafe(ENTITY_MAP.lights[room])
        if (value !== null) updated[room] = value
      })
      return updated
    })

    setFans(previous => {
      const updated = { ...previous }
      ;(Object.keys(ENTITY_MAP.fans) as FanKey[]).forEach(key => {
        const value = readBoolSafe(ENTITY_MAP.fans[key])
        if (value !== null) updated[key] = value
      })
      return updated
    })

    const presenceMap: Record<SensorKey, string> = {
      kho: ENTITY_MAP.sensors.khoPresence,
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
        const value = readBoolSafe(presenceMap[key])
        if (value !== null) updated[key] = value
      })
      return updated
    })

    const distanceMap: Record<SensorKey, string> = {
      kho: ENTITY_MAP.sensors.khoDistance,
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
        const raw = readNumberSafe(distanceMap[key])
        if (raw !== null) {
          const meters = raw > ENTITY_OVERRIDES.distanceCmThreshold ? raw / 100 : raw
          updated[key] = Number(meters.toFixed(2))
        }
      })
      return updated
    })

    const luxValue = readNumberSafe(ENTITY_MAP.sensors.lux)
    if (luxValue !== null) setLux(Math.round(luxValue))

    const outdoorTempValue = readNumberSafe(ENTITY_MAP.sensors.outdoorTemp)
    if (outdoorTempValue !== null) setOutdoorTemp(Number(outdoorTempValue.toFixed(1)))
    const outdoorHumValue = readNumberSafe(ENTITY_MAP.sensors.outdoorHum)
    if (outdoorHumValue !== null) setOutdoorHum(Math.round(outdoorHumValue))

    const grandparentsTempValue = readNumberSafe(ENTITY_MAP.sensors.grandparentsTemp)
    if (grandparentsTempValue !== null) setGrandparentsTemp(Number(grandparentsTempValue.toFixed(1)))
    const grandparentsHumValue = readNumberSafe(ENTITY_MAP.sensors.grandparentsHum)
    if (grandparentsHumValue !== null) setGrandparentsHum(Math.round(grandparentsHumValue))

    const diningTempValue = readNumberSafe(ENTITY_MAP.sensors.diningTemp)
    if (diningTempValue !== null) setDiningTemp(Number(diningTempValue.toFixed(1)))
    const diningHumValue = readNumberSafe(ENTITY_MAP.sensors.diningHum)
    if (diningHumValue !== null) setDiningHum(Math.round(diningHumValue))

    const bedroomTempValue = readNumberSafe(ENTITY_MAP.sensors.bedroomTemp)
    if (bedroomTempValue !== null) setBedroomTemp(Number(bedroomTempValue.toFixed(1)))
    const bedroomHumValue = readNumberSafe(ENTITY_MAP.sensors.bedroomHum)
    if (bedroomHumValue !== null) setBedroomHum(Math.round(bedroomHumValue))

    const mq2Value = readNumberSafe(ENTITY_MAP.sensors.mq2Bedroom)
    if (mq2Value !== null) setMq2Bedroom(Math.round(mq2Value))

    const co2Value = readNumberSafe(ENTITY_MAP.sensors.co2Dining)
    if (co2Value !== null) setCo2Dining(Math.round(co2Value))

    const acEntityId = ENTITY_MAP.climate.ac
    if (!isEntityLocked(acEntityId)) {
      const acState = byId.get(acEntityId)
      if (acState) {
        const rawState = (acState.state || '').toLowerCase()
        const acOnValue = !['off', 'unavailable', 'unknown'].includes(rawState)
        setAcOn(acOnValue)
        const attrTemp = acState.attributes?.temperature
        if (typeof attrTemp === 'number' && Number.isFinite(attrTemp)) {
          setAcTargetTemp(attrTemp)
        }
      }
    }

    const fanEntityId = ENTITY_MAP.climate.fan
    if (!isEntityLocked(fanEntityId)) {
      const fanState = byId.get(fanEntityId)
      if (fanState) {
        const raw = (fanState.state || '').toLowerCase()
        if (raw === 'on') setFanOn(true)
        else if (raw === 'off') setFanOn(false)
      }
    }
  }, [isEntityLocked])

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

  const pushEntityToHA = useCallback((entityId: string, next: boolean, label: string) => {
    if (mode !== 'live' || !liveConnected) return
    lockEntity(entityId, 2500)
    const domain = domainOf(entityId)
    const { service, data } = haActionFor(domain, next)
    callHA({
      method: 'POST',
      body: JSON.stringify({
        entity_id: entityId,
        domain,
        action: service,
        ...(data ? { data } : {}),
      }),
    })
      .then(async response => {
        if (!response.ok) {
          const body = await response.json().catch(() => null)
          const detail = formatErrorDetail(body)
          addEvent(`HA từ chối lệnh cho ${label} (${response.status})${detail ? `: ${detail}` : ''}`, 'system')
        }
      })
      .catch(error => {
        const message = error instanceof Error ? error.message : String(error)
        addEvent(`Không gửi được lệnh tới ${label}: ${message}`, 'system')
      })
  }, [mode, liveConnected, callHA, lockEntity])

  const pushFanToHA = useCallback((key: FanKey, next: boolean) => {
    pushEntityToHA(ENTITY_MAP.fans[key], next, FAN_LABELS[key])
  }, [pushEntityToHA])

  const pushLightToHA = useCallback((room: RoomKey, next: boolean) => {
    pushEntityToHA(ENTITY_MAP.lights[room], next, ROOM_TITLE[room])
  }, [pushEntityToHA])

  const toggleLight = (room: RoomKey, title: string) => {
    const next = !lights[room]
    setLights(previous => ({ ...previous, [room]: next }))
    addEvent(`${title} · ${next ? 'Đã bật' : 'Đã tắt'} đèn`, 'manual')
    pushLightToHA(room, next)
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
        pushLightToHA(room, next)
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
    pushFanToHA(key, next)
  }

  const summary = useMemo(() => `${Object.values(lights).filter(Boolean).length + Object.values(fans).filter(Boolean).length} thiết bị đang hoạt động`, [lights, fans])
  const allLightsOn = useMemo(() => Object.values(lights).every(Boolean), [lights])

  // Live = đã kết nối HA thực tế
  const isLive = mode === 'live' && liveConnected
  // Khoá thanh trượt demo khi Live
  const slidersLocked = isLive
  // Cờ quyết định automation trình duyệt có chạy hay không.
  // - Demo: chạy nếu người dùng bật công tắc automation
  // - Live: LUÔN TẮT — HA server đảm nhận toàn bộ automation
  const isBrowserAutomationActive = automation && mode === 'demo'

  // Hàm dọn dẹp TOÀN BỘ timer automation trình duyệt
  const clearAllBrowserTimers = useCallback(() => {
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

    Object.values(autoOffTimersRef.current).forEach(t => { if (t) clearTimeout(t) })
    Object.values(autoOffTicksRef.current).forEach(t => { if (t) clearInterval(t) })
    autoOffTimersRef.current = {}
    autoOffTicksRef.current = {}
    setAutoOffRemaining({})

    if (acVentPhase1TimerRef.current) { clearTimeout(acVentPhase1TimerRef.current); acVentPhase1TimerRef.current = null }
    if (acVentPhase1TickRef.current) { clearInterval(acVentPhase1TickRef.current); acVentPhase1TickRef.current = null }
    setAcVentPhase1Remaining(null)
    if (acVentCycleFreshTimerRef.current) { clearTimeout(acVentCycleFreshTimerRef.current); acVentCycleFreshTimerRef.current = null }
    if (acVentCycleFreshTickRef.current) { clearInterval(acVentCycleFreshTickRef.current); acVentCycleFreshTickRef.current = null }
    setAcVentFreshRemaining(null)
    if (acVentCycleExhaustTimerRef.current) { clearTimeout(acVentCycleExhaustTimerRef.current); acVentCycleExhaustTimerRef.current = null }
    if (acVentCycleExhaustTickRef.current) { clearInterval(acVentCycleExhaustTickRef.current); acVentCycleExhaustTickRef.current = null }
    setAcVentExhaustRemaining(null)
    if (acHourlyIntervalRef.current) { clearInterval(acHourlyIntervalRef.current); acHourlyIntervalRef.current = null }
    if (acHourlyTickRef.current) { clearInterval(acHourlyTickRef.current); acHourlyTickRef.current = null }
    setAcHoursRemaining(null)
  }, [])

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
      addEvent('Đã xác thực và kết nối Home Assistant · Automation trình duyệt tạm dừng', 'system')
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
      addEvent('Đã chuyển sang chế độ Kết nối thực tế · Automation trình duyệt tạm dừng, HA server đảm nhận', 'system')
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
    addEvent('Đã chuyển sang chế độ Giả lập · Automation trình duyệt hoạt động trở lại')
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
      clearAllBrowserTimers()
    }
  }, [clearAllBrowserTimers])

  // Khi cờ isBrowserAutomationActive chuyển sang false → dọn dẹp toàn bộ bộ đếm ngược
  useEffect(() => {
    if (isBrowserAutomationActive) return
    clearAllBrowserTimers()
  }, [isBrowserAutomationActive, clearAllBrowserTimers])

  // ===== NHÓM 1: Đèn trong nhà - bật ngay khi có người (không phụ thuộc lux) =====
  useEffect(() => {
    if (!isBrowserAutomationActive) {
      prevGroup1PresenceRef.current = { ...presence }
      return
    }
    const prev = prevGroup1PresenceRef.current
    AUTO_GROUP_1.forEach(({ sensor, room, label }) => {
      const wasPresent = prev[sensor]
      const isPresent = presence[sensor]
      if (isPresent && !wasPresent) {
        if (!lights[room]) {
          setLights(state => ({ ...state, [room]: true }))
          addEvent(`LD2410 ${label} phát hiện người → Bật ${ROOM_TITLE[room]}`, 'auto')
          pushLightToHA(room, true)
        }
      }
    })
    prevGroup1PresenceRef.current = { ...presence }
  }, [presence, isBrowserAutomationActive, lights, pushLightToHA])

  // ===== NHÓM 2: Đèn cửa buồng - chỉ bật khi có người VÀ trời tối (lux <= 300) =====
  useEffect(() => {
    if (!isBrowserAutomationActive) {
      prevGroup2PresenceRef.current = { ...presence }
      prevLuxRef.current = lux
      return
    }
    const prev = prevGroup2PresenceRef.current
    const prevLux = prevLuxRef.current
    const hasPresenceTrigger = (presence.hienNha && !prev.hienNha) || (presence.phongNgu && !prev.phongNgu)
    const luxBecameDark = lux <= 300 && prevLux > 300
    const currentlyDark = lux <= 300
    const someonePresent = presence.hienNha || presence.phongNgu

    if ((hasPresenceTrigger && currentlyDark) || (luxBecameDark && someonePresent)) {
      if (!lights.cuaBuong) {
        setLights(state => ({ ...state, cuaBuong: true }))
        addEvent(`Có người + Trời tối → Bật Đèn cửa buồng`, 'auto')
        pushLightToHA('cuaBuong', true)
      }
    }
    prevGroup2PresenceRef.current = { ...presence }
    prevLuxRef.current = lux
  }, [presence, lux, isBrowserAutomationActive, lights.cuaBuong, pushLightToHA])

  // Rule 1: MQ2 → quạt hút mùi PN
  useEffect(() => {
    if (!isBrowserAutomationActive) return
    if (mq2Bedroom > mq2Threshold) {
      if (!fans.exhaustPN) {
        setFans(previous => ({ ...previous, exhaustPN: true }))
        addEvent('Cảnh báo khói MQ2 phòng ngủ vượt ngưỡng → Bật quạt hút mùi phòng ngủ', 'auto')
        pushFanToHA('exhaustPN', true)
      }
    } else {
      if (fans.exhaustPN) {
        setFans(previous => ({ ...previous, exhaustPN: false }))
        addEvent('Khói MQ2 phòng ngủ đã giảm dưới ngưỡng → Tắt quạt hút mùi phòng ngủ', 'auto')
        pushFanToHA('exhaustPN', false)
      }
    }
  }, [mq2Bedroom, mq2Threshold, isBrowserAutomationActive, fans.exhaustPN, pushFanToHA])

  // Rule 2: CO2 → quạt gió tươi PA + escalate
  useEffect(() => {
    if (!isBrowserAutomationActive) return
    if (co2Dining > co2Threshold) {
      if (co2OffTimerRef.current) { clearTimeout(co2OffTimerRef.current); co2OffTimerRef.current = null }
      if (co2OffTickRef.current) { clearInterval(co2OffTickRef.current); co2OffTickRef.current = null }
      setCo2OffRemaining(null)
      co2OffPendingRef.current = false
      if (!fans.freshAirPA) {
        setFans(previous => ({ ...previous, freshAirPA: true }))
        addEvent('CO2 phòng ăn vượt ngưỡng → Bật quạt gió tươi PA', 'auto')
        pushFanToHA('freshAirPA', true)
      }
      if (!co2EscalationStartedRef.current) {
        co2EscalationStartedRef.current = true
        if (co2EscalationTimerRef.current) clearTimeout(co2EscalationTimerRef.current)
        const tick = setInterval(() => {
          setCo2EscalationRemaining(prev => (prev !== null && prev > 1 ? prev - 1 : 0))
        }, 1000)
        setCo2EscalationRemaining(TIMING.co2Escalation)
        co2EscalationTimerRef.current = setTimeout(() => {
          clearInterval(tick)
          setCo2EscalationRemaining(null)
          if (!fans.exhaustPA) {
            setFans(previous => ({ ...previous, exhaustPA: true }))
            addEvent('CO2 phòng ăn không giảm sau thời gian chờ → Bật thêm quạt hút mùi phòng ăn', 'auto')
            pushFanToHA('exhaustPA', true)
          }
        }, TIMING.co2Escalation * 1000)
        if (co2OffTickRef.current) clearInterval(co2OffTickRef.current)
        co2OffTickRef.current = tick
      }
    } else {
      if (co2EscalationTimerRef.current) { clearTimeout(co2EscalationTimerRef.current); co2EscalationTimerRef.current = null }
      if (co2OffTickRef.current) { clearInterval(co2OffTickRef.current); co2OffTickRef.current = null }
      setCo2EscalationRemaining(null)
      co2EscalationStartedRef.current = false
      if ((fans.freshAirPA || fans.exhaustPA) && !co2OffPendingRef.current) {
        co2OffPendingRef.current = true
        setCo2OffRemaining(TIMING.co2OffDelay)
        const tick = setInterval(() => {
          setCo2OffRemaining(prev => (prev !== null && prev > 1 ? prev - 1 : 0))
        }, 1000)
        co2OffTimerRef.current = setTimeout(() => {
          clearInterval(tick)
          setCo2OffRemaining(null)
          co2OffPendingRef.current = false
          setFans(previous => ({ ...previous, freshAirPA: false, exhaustPA: false }))
          addEvent('CO2 phòng ăn đạt chuẩn sau thời gian chờ → Tắt quạt gió tươi PA và quạt hút mùi PA', 'auto')
          pushFanToHA('freshAirPA', false)
          pushFanToHA('exhaustPA', false)
        }, TIMING.co2OffDelay * 1000)
        if (co2OffTickRef.current) clearInterval(co2OffTickRef.current)
        co2OffTickRef.current = tick
      }
    }
  }, [co2Dining, co2Threshold, isBrowserAutomationActive, fans.freshAirPA, fans.exhaustPA, pushFanToHA])

  // Rule 3: Làm mát tự nhiên
  useEffect(() => {
    if (!isBrowserAutomationActive) return
    const outdoorOk = outdoorTemp < 28
    const roomTooHot = grandparentsTemp > 30 || diningTemp > 30
    const hasPresence = (grandparentsTemp > 30 && presence.phongOngBa) || (diningTemp > 30 && presence.phongAn) || (grandparentsTemp > 30 && presence.phongNgu) || (diningTemp > 30 && presence.bep)
    const shouldActivate = outdoorOk && roomTooHot && hasPresence
    if (shouldActivate && !naturalCoolingActiveRef.current) {
      naturalCoolingActiveRef.current = true
      if (!fans.freshAirPA) {
        setFans(previous => ({ ...previous, freshAirPA: true }))
        pushFanToHA('freshAirPA', true)
      }
      addEvent('Nhiệt độ ngoài trời < 28°C, trong phòng > 30°C và có người → Bật quạt gió tươi PA (demo)', 'auto')
      setNaturalCoolingRemaining(TIMING.naturalCoolingDuration)
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
          setFans(previous => ({ ...previous, freshAirPA: false }))
          addEvent('Hết thời gian làm mát tự nhiên → Tắt quạt gió tươi PA', 'auto')
          pushFanToHA('freshAirPA', false)
        }
      }, TIMING.naturalCoolingDuration * 1000)
    } else if (!shouldActivate && naturalCoolingActiveRef.current) {
      if (naturalCoolingTimerRef.current) { clearTimeout(naturalCoolingTimerRef.current); naturalCoolingTimerRef.current = null }
      if (naturalCoolingTickRef.current) { clearInterval(naturalCoolingTickRef.current); naturalCoolingTickRef.current = null }
      setNaturalCoolingRemaining(null)
      naturalCoolingActiveRef.current = false
      if (co2Dining <= co2Threshold) {
        setFans(previous => ({ ...previous, freshAirPA: false }))
        pushFanToHA('freshAirPA', false)
      }
      addEvent('Điều kiện làm mát tự nhiên không còn → Dừng quạt gió tươi PA', 'auto')
    }
  }, [outdoorTemp, grandparentsTemp, diningTemp, presence, isBrowserAutomationActive, co2Dining, co2Threshold, fans.freshAirPA, pushFanToHA])

  // ===== LUẬT 4: Tự động tắt đèn sau khi phòng trống =====
  useEffect(() => {
    if (!isBrowserAutomationActive) {
      prevAutoOffPresenceRef.current = { ...presence }
      return
    }

    AUTO_OFF_MAP.forEach(({ sensor, rooms, label }) => {
      const wasPresent = prevAutoOffPresenceRef.current[sensor]
      const isPresent = presence[sensor]

      if (isPresent && !wasPresent) {
        const timer = autoOffTimersRef.current[sensor]
        const tick = autoOffTicksRef.current[sensor]
        if (timer) { clearTimeout(timer); autoOffTimersRef.current[sensor] = null }
        if (tick) { clearInterval(tick); autoOffTicksRef.current[sensor] = null }
        setAutoOffRemaining(prev => {
          if (!(sensor in prev)) return prev
          const next = { ...prev }
          delete next[sensor]
          return next
        })
        addEvent(`Có người trở lại ${label} → Hủy hẹn tắt đèn`, 'auto')
      }

      if (!isPresent && wasPresent) {
        const anyLightOn = rooms.some(r => lightsRef.current[r])
        if (anyLightOn) {
          if (autoOffTimersRef.current[sensor]) clearTimeout(autoOffTimersRef.current[sensor])
          if (autoOffTicksRef.current[sensor]) clearInterval(autoOffTicksRef.current[sensor])
          setAutoOffRemaining(prev => ({ ...prev, [sensor]: TIMING.autoOffDelay }))
          const tick = setInterval(() => {
            setAutoOffRemaining(prev => {
              const val = prev[sensor]
              if (val === undefined || val === null) return prev
              if (val <= 1) return { ...prev, [sensor]: 0 }
              return { ...prev, [sensor]: val - 1 }
            })
          }, 1000)
          autoOffTicksRef.current[sensor] = tick
          const timer = setTimeout(() => {
            clearInterval(tick)
            autoOffTicksRef.current[sensor] = null
            autoOffTimersRef.current[sensor] = null
            setAutoOffRemaining(prev => {
              const next = { ...prev }
              delete next[sensor]
              return next
            })
            const stillEmpty = !presenceRef.current[sensor]
            if (!stillEmpty) return
            const lightsToTurnOff = rooms.filter(r => lightsRef.current[r])
            if (lightsToTurnOff.length) {
              setLights(prev => {
                const next = { ...prev }
                lightsToTurnOff.forEach(r => { next[r] = false })
                return next
              })
              lightsToTurnOff.forEach(r => {
                addEvent(`Phòng ${label} trống sau ${TIMING.autoOffDelay}s → Tự động tắt ${ROOM_TITLE[r]}`, 'auto')
                pushLightToHA(r, false)
              })
            }
          }, TIMING.autoOffDelay * 1000)
          autoOffTimersRef.current[sensor] = timer
        }
      }
    })

    prevAutoOffPresenceRef.current = { ...presence }
  }, [presence, isBrowserAutomationActive, pushLightToHA])

  // ===== LUẬT 5: Chu kỳ thông gió & hút mùi tự động khi bật Điều hòa =====
  const clearAcVentPhase1 = useCallback(() => {
    if (acVentPhase1TimerRef.current) { clearTimeout(acVentPhase1TimerRef.current); acVentPhase1TimerRef.current = null }
    if (acVentPhase1TickRef.current) { clearInterval(acVentPhase1TickRef.current); acVentPhase1TickRef.current = null }
    setAcVentPhase1Remaining(null)
  }, [])

  const clearAcVentCycle = useCallback(() => {
    if (acVentCycleFreshTimerRef.current) { clearTimeout(acVentCycleFreshTimerRef.current); acVentCycleFreshTimerRef.current = null }
    if (acVentCycleFreshTickRef.current) { clearInterval(acVentCycleFreshTickRef.current); acVentCycleFreshTickRef.current = null }
    setAcVentFreshRemaining(null)
    if (acVentCycleExhaustTimerRef.current) { clearTimeout(acVentCycleExhaustTimerRef.current); acVentCycleExhaustTimerRef.current = null }
    if (acVentCycleExhaustTickRef.current) { clearInterval(acVentCycleExhaustTickRef.current); acVentCycleExhaustTickRef.current = null }
    setAcVentExhaustRemaining(null)
  }, [])

  const clearAcHourly = useCallback(() => {
    if (acHourlyIntervalRef.current) { clearInterval(acHourlyIntervalRef.current); acHourlyIntervalRef.current = null }
    if (acHourlyTickRef.current) { clearInterval(acHourlyTickRef.current); acHourlyTickRef.current = null }
    setAcHoursRemaining(null)
  }, [])

  const runAcVentCycle = useCallback((reason: string) => {
    addEvent(reason, 'auto')
    setFans(prev => ({ ...prev, freshAirPN: true }))
    pushFanToHA('freshAirPN', true)
    setAcVentFreshRemaining(TIMING.acVentCycleFresh)
    const freshTick = setInterval(() => {
      setAcVentFreshRemaining(prev => {
        if (prev === null || prev <= 1) { clearInterval(freshTick); return 0 }
        return prev - 1
      })
    }, 1000)
    if (acVentCycleFreshTickRef.current) clearInterval(acVentCycleFreshTickRef.current)
    acVentCycleFreshTickRef.current = freshTick
    if (acVentCycleFreshTimerRef.current) clearTimeout(acVentCycleFreshTimerRef.current)
    acVentCycleFreshTimerRef.current = setTimeout(() => {
      clearInterval(freshTick)
      acVentCycleFreshTickRef.current = null
      acVentCycleFreshTimerRef.current = null
      setAcVentFreshRemaining(null)
      setFans(prev => ({ ...prev, freshAirPN: false }))
      addEvent('Gió tươi PN: hết thời gian chu kỳ → Tắt', 'auto')
      pushFanToHA('freshAirPN', false)
    }, TIMING.acVentCycleFresh * 1000)

    setFans(prev => ({ ...prev, exhaustPN: true }))
    pushFanToHA('exhaustPN', true)
    setAcVentExhaustRemaining(TIMING.acVentCycleExhaust)
    const exhaustTick = setInterval(() => {
      setAcVentExhaustRemaining(prev => {
        if (prev === null || prev <= 1) { clearInterval(exhaustTick); return 0 }
        return prev - 1
      })
    }, 1000)
    if (acVentCycleExhaustTickRef.current) clearInterval(acVentCycleExhaustTickRef.current)
    acVentCycleExhaustTickRef.current = exhaustTick
    if (acVentCycleExhaustTimerRef.current) clearTimeout(acVentCycleExhaustTimerRef.current)
    acVentCycleExhaustTimerRef.current = setTimeout(() => {
      clearInterval(exhaustTick)
      acVentCycleExhaustTickRef.current = null
      acVentCycleExhaustTimerRef.current = null
      setAcVentExhaustRemaining(null)
      setFans(prev => ({ ...prev, exhaustPN: false }))
      addEvent('Hút mùi PN: hết thời gian chu kỳ → Tắt', 'auto')
      pushFanToHA('exhaustPN', false)
    }, TIMING.acVentCycleExhaust * 1000)
  }, [addEvent, pushFanToHA])

  // Khi AC bật/tắt — chỉ chạy khi automation trình duyệt đang hoạt động
  useEffect(() => {
    if (!isBrowserAutomationActive) {
      clearAcVentPhase1()
      clearAcVentCycle()
      clearAcHourly()
      return
    }
    if (acOn) {
      clearAcVentPhase1()
      setFans(prev => ({ ...prev, exhaustPN: true }))
      pushFanToHA('exhaustPN', true)
      addEvent('Điều hòa bật → Bật Hút mùi PN (demo)', 'auto')
      setAcVentPhase1Remaining(TIMING.acVentPhase1)
      const tick = setInterval(() => {
        setAcVentPhase1Remaining(prev => {
          if (prev === null || prev <= 1) { clearInterval(tick); return 0 }
          return prev - 1
        })
      }, 1000)
      acVentPhase1TickRef.current = tick
      acVentPhase1TimerRef.current = setTimeout(() => {
        clearInterval(tick)
        acVentPhase1TickRef.current = null
        acVentPhase1TimerRef.current = null
        setAcVentPhase1Remaining(null)
        if (acVentCycleExhaustTimerRef.current === null) {
          setFans(prev => ({ ...prev, exhaustPN: false }))
          addEvent('Hút mùi PN: hết giai đoạn khởi động → Tắt', 'auto')
          pushFanToHA('exhaustPN', false)
        }
      }, TIMING.acVentPhase1 * 1000)

      clearAcHourly()
      setAcHoursRemaining(TIMING.acHourlyCycle)
      const hourlyTick = setInterval(() => {
        setAcHoursRemaining(prev => {
          if (prev === null || prev <= 1) return 0
          return prev - 1
        })
      }, 1000)
      acHourlyTickRef.current = hourlyTick
      const hourly = setInterval(() => {
        runAcVentCycle('Điều hòa hoạt động đủ chu kỳ → Bật Gió tươi PN & Hút mùi PN (demo)')
        setAcHoursRemaining(TIMING.acHourlyCycle)
      }, TIMING.acHourlyCycle * 1000)
      acHourlyIntervalRef.current = hourly
    } else {
      clearAcVentPhase1()
      clearAcVentCycle()
      clearAcHourly()
      setFans(prev => {
        if (!prev.exhaustPN && !prev.freshAirPN) return prev
        return { ...prev, exhaustPN: false, freshAirPN: false }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acOn, isBrowserAutomationActive])

  const handleAcToggle = useCallback((next: boolean) => {
    setAcOn(next)
    addEvent(`Điều hòa Daikin ${next ? 'đã bật' : 'đã tắt'}`)
    if (mode === 'live' && liveConnected) {
      lockEntity(ENTITY_MAP.climate.ac, 2500)
      callHA({
        method: 'POST',
        body: JSON.stringify({
          entity_id: ENTITY_MAP.climate.ac,
          domain: 'climate',
          action: next ? 'turn_on' : 'turn_off',
        }),
      })
        .catch(error => {
          const message = error instanceof Error ? error.message : String(error)
          addEvent(`Không gửi được lệnh điều hòa: ${message}`, 'system')
        })
    }
  }, [mode, liveConnected, callHA, lockEntity])

  const handleCeilingFanToggle = useCallback((next: boolean) => {
    setFanOn(next)
    addEvent(`Quạt trần ${next ? 'đã bật' : 'đã tắt'}`)
    if (mode === 'live' && liveConnected) {
      const entityId = ENTITY_MAP.climate.fan
      lockEntity(entityId, 2500)
      callHA({
        method: 'POST',
        body: JSON.stringify({
          entity_id: entityId,
          domain: 'script',
          action: 'turn_on',
        }),
      })
        .catch(error => {
          const message = error instanceof Error ? error.message : String(error)
          addEvent(`Không gửi được lệnh quạt trần: ${message}`, 'system')
        })
    }
  }, [mode, liveConnected, callHA, lockEntity])

  return (
    <main className="dashboard-shell">
      <style>{`
        @keyframes fanSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .fan-spin { animation: fanSpin 1.5s linear infinite; transform-origin: center; }
        .pin-ac-on {
          background: rgba(14, 165, 233, 0.15) !important;
          border-color: rgba(14, 165, 233, 0.75) !important;
          box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.25), 0 6px 18px rgba(14, 165, 233, 0.25) !important;
        }
        .pin-ac-on .pin-icon { color: #0284c7 !important; }
        .pin-climate-ac-on {
          background: rgba(14, 165, 233, 0.12) !important;
          border-color: rgba(14, 165, 233, 0.55) !important;
        }
        .ac-glow {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          background: radial-gradient(circle at 80% 32%, rgba(56, 189, 248, 0.25) 0%, rgba(14, 165, 233, 0.08) 55%, transparent 75%);
          transition: opacity 0.5s ease;
        }
        .auto-off-badge { color: #e67e22; font-weight: 600; }
      `}</style>
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Trang chủ Smart Living"><span className="brand-mark"><Home size={17} strokeWidth={1.8} /></span><span className="brand-name">nếp<span>.</span><small>SMART LIVING</small></span></a>
        <div className="breadcrumb"><span>Không gian</span><ChevronRight size={13} /><strong>Nhà của Minh</strong><span className="status-dot" /> <span className="online-label">Trực tuyến</span></div>
        <div className="top-actions"><button className="icon-button" aria-label="Trợ giúp"><CircleHelp size={17} /></button><button className="icon-button" aria-label="Cài đặt"><Settings2 size={17} /></button><div className="avatar">M</div></div>
      </header>

      <section className="workspace">
        <div className="main-column">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> TỔNG QUAN NGÔI NHÀ</div><h1>Chào buổi chiều, Minh <span className="heading-sun"><Sun size={23} /></span></h1><p>Ngôi nhà của bạn đang vận hành bình thường.</p></div><div className="heading-actions"><button className="outline-button" onClick={() => { if (mode === 'live' && liveConnected) { syncFromHA(false) } else { addEvent('Đã làm mới trạng thái thiết bị (giả lập)', 'sensor') } }}><Activity size={15} /> Cập nhật <span className="live-indicator" /></button><button className="outline-button" onClick={toggleAllLights}><Lightbulb size={15} /> {allLightsOn ? 'Tắt tất cả đèn' : 'Bật tất cả đèn'}</button></div></div>
          <div className="metrics-row">
            <article className="metric-card"><div className="metric-icon warm"><Thermometer size={17} /></div><span className="metric-label">NHIỆT ĐỘ TRONG NHÀ</span><div className="metric-reading">{grandparentsTemp.toFixed(1)}<span>°C</span><span className="metric-trend up"><ArrowUpRight size={13} /> 1.2°</span></div><div className="metric-foot">Phòng ông bà <span>Thoải mái</span></div></article>
            <article className="metric-card"><div className="metric-icon blue"><Waves size={17} /></div><span className="metric-label">ĐỘ ẨM</span><div className="metric-reading">{grandparentsHum}<span>%</span><span className="metric-trend down"><ArrowDownRight size={13} /> 2%</span></div><div className="metric-foot">Trong nhà <span>Bình thường</span></div></article>
            <article className="metric-card"><div className="metric-icon amber"><Sun size={17} /></div><span className="metric-label">ÁNH SÁNG NGOÀI TRỜI</span><div className="metric-reading">{lux}<span>Lux</span></div><div className="metric-foot">Sân vườn <span>{isDay ? 'Ban ngày' : 'Ánh sáng thấp'}</span></div></article>
            <article className="metric-card"><div className="metric-icon green"><Zap size={17} /></div><span className="metric-label">THIẾT BỊ ĐANG BẬT</span><div className="metric-reading">{Object.values(lights).filter(Boolean).length + Object.values(fans).filter(Boolean).length + Number(acOn) + Number(fanOn)}<span>/ 21</span></div><div className="metric-foot">{summary}<span className="healthy"><span /> Ổn định</span></div></article>
          </div>

          <section className="floor-card" aria-label="Sơ đồ mặt bằng tương tác">
            <div className="floor-header"><div><div className="floor-title"><h2>Sơ đồ mặt bằng</h2><span className="live-pill"><span /> TRỰC TIẾP</span></div><p>Chọn thiết bị trên bản đồ để điều khiển</p></div><div className="floor-tools"><span className="floor-location"><Home size={13} /> Tầng trệt</span>{editMode && <button className="outline-button" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={copyPinsCode}>{copied ? 'Đã copy!' : 'Copy tọa độ'}</button>}<button className={`outline-button ${editMode ? 'is-active' : ''}`} style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => { const next = !editMode; setEditMode(next); addEvent(next ? 'Đã bật chế độ chỉnh tọa độ pins' : 'Đã tắt chế độ chỉnh tọa độ pins', 'manual') }}>{editMode ? 'Xong' : 'Chỉnh tọa độ'}</button><button className="dots-button" aria-label="Thêm tùy chọn"><MoreHorizontal size={19} /></button></div></div>
            <div className={`floor-canvas ${editMode ? 'is-editing' : ''}`} ref={floorCanvasRef}>
              <img className="floor-image" src={isDay ? floorImageDay : floorImage} alt="Sơ đồ 3D nhìn từ trên xuống của ngôi nhà, gồm phòng khách, nhà bếp, phòng ngủ và sân vườn" />
              <div className="floor-vignette" />
              {lightLayers.map(layer => (
                <img
                  key={layer.room}
                  src={layer.src}
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
                    opacity: lights[layer.room] ? 1 : 0,
                  }}
                />
              ))}
              <div className="floor-grid" aria-hidden="true" />
              <div className="ac-glow" style={{ opacity: acOn ? 1 : 0 }} aria-hidden="true" />
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
                  acTargetTemp={acTargetTemp}
                  onAc={() => handleAcToggle(!acOn)}
                  outdoorTemp={outdoorTemp}
                  outdoorHum={outdoorHum}
                  grandparentsTemp={grandparentsTemp}
                  grandparentsHum={grandparentsHum}
                  diningTemp={diningTemp}
                  diningHum={diningHum}
                  bedroomTemp={bedroomTemp}
                  bedroomHum={bedroomHum}
                  mq2Bedroom={mq2Bedroom}
                  mq2Threshold={mq2Threshold}
                  co2Dining={co2Dining}
                  co2Threshold={co2Threshold}
                  co2OffRemaining={co2OffRemaining}
                  naturalCoolingRemaining={naturalCoolingRemaining}
                  co2EscalationRemaining={co2EscalationRemaining}
                  distances={distances}
                  autoOffRemaining={autoOffRemaining}
                  acVentPhase1Remaining={acVentPhase1Remaining}
                  acVentFreshRemaining={acVentFreshRemaining}
                  acVentExhaustRemaining={acVentExhaustRemaining}
                />
              ))}
              <div className="map-compass"><span>N</span><ArrowUpRight size={14} /></div>
              <div className="map-legend"><span><i className="legend-light" /> Đèn đang bật</span><span><i className="legend-presence" /> Có người</span><span><i className="legend-fan" /> Quạt đang bật</span></div>
            </div>
            <div className="floor-footer"><span><Radio size={13} /> 21 thiết bị <b>·</b> 9 cảm biến</span><span>{editMode ? 'Chế độ chỉnh tọa độ: kéo thả pin để di chuyển' : 'Cập nhật lần cuối: vừa xong'} <span className="sync-mark"><Activity size={13} /></span></span></div>
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
              <div className="live-notice"><Radio size={14} /> Đã kết nối Home Assistant · Đồng bộ mỗi 3 giây · Automation trình duyệt đã tắt.</div>
            )}
            <section className="panel-section sensors-section"><div className="section-heading"><div><span className="section-icon"><Users size={15} /></span><h3>Cảm biến hiện diện</h3></div><span className="device-count">LD2410 <span>· 9</span></span></div>
              {(['kho', 'sanVuon', 'phongOngBa', 'nhaVeSinh', 'bep', 'phongAn', 'sanBe', 'hienNha', 'phongNgu'] as SensorKey[]).map(sensor => {
                const label = SENSOR_LABELS[sensor]
                const autoOff = autoOffRemaining[sensor]
                return <div className="presence-card" key={sensor}><div className="presence-top"><div className={`presence-symbol ${presence[sensor] ? 'detected' : ''}`}><Users size={15} /></div><div className="presence-name"><strong>{label}</strong><span>{presence[sensor] ? 'Đang phát hiện người' : 'Không có người'}{autoOff !== undefined && autoOff !== null ? <em style={{ color: '#e67e22', fontStyle: 'normal' }}> · Tắt đèn sau {autoOff}s</em> : ''}</span></div><button className={`mini-switch ${presence[sensor] ? 'on' : ''}`} aria-label={`${presence[sensor] ? 'Tắt' : 'Bật'} cảm biến ${label}`} aria-pressed={presence[sensor]} onClick={() => !slidersLocked && togglePresence(sensor)} disabled={slidersLocked}><span /></button></div><div className="distance-row"><span>Khoảng cách</span><strong>{distances[sensor].toFixed(1)} <small>m</small></strong></div><input aria-label={`Khoảng cách ${label}`} type="range" min="0" max="6" step="0.1" value={distances[sensor]} disabled={slidersLocked} onChange={e => !slidersLocked && setDistances(previous => ({ ...previous, [sensor]: Number(e.target.value) }))} /></div>
              })}
            </section>
            <section className="panel-section environment-section"><div className="section-heading"><div><span className="section-icon sun-section"><Sun size={15} /></span><h3>Môi trường & An toàn</h3></div><button className="text-action" onClick={() => addEvent('Đã đồng bộ dữ liệu môi trường', 'sensor')}>Đồng bộ</button></div>
              <div className="environment-item"><div className="environment-label"><span><Sun size={14} /> Ánh sáng xung quanh</span><strong>{lux} <small>Lux</small> <span className={`day-tag ${isDay ? 'day' : ''}`}>{isDay ? 'NGÀY' : 'ĐÊM'}</span></strong></div><input aria-label="Ánh sáng xung quanh, Lux" type="range" min="0" max="1000" step="10" value={lux} disabled={slidersLocked} onChange={e => !slidersLocked && updateLux(Number(e.target.value))} /><div className="range-ends"><span>0 Lux</span><span>1000 Lux</span></div></div>
              <div className="environment-item"><div className="environment-label"><span><Thermometer size={14} /> Nhiệt độ sân vườn</span><strong>{outdoorTemp.toFixed(1)}<small>°C</small></strong></div><input aria-label="Nhiệt độ sân vườn" type="range" min="15" max="42" step="0.5" value={outdoorTemp} disabled={slidersLocked} onChange={e => !slidersLocked && setOutdoorTemp(Number(e.target.value))} /><div className="range-ends"><span>15°C</span><span>42°C</span></div></div>
              <div className="environment-item"><div className="environment-label"><span><Thermometer size={14} /> Nhiệt độ phòng ông bà</span><strong>{grandparentsTemp.toFixed(1)}<small>°C</small></strong></div><input aria-label="Nhiệt độ phòng ông bà" type="range" min="18" max="40" step="0.5" value={grandparentsTemp} disabled={slidersLocked} onChange={e => !slidersLocked && setGrandparentsTemp(Number(e.target.value))} /><div className="range-ends"><span>18°C</span><span>40°C</span></div></div>
              <div className="environment-item"><div className="environment-label"><span><Thermometer size={14} /> Nhiệt độ phòng ăn</span><strong>{diningTemp.toFixed(1)}<small>°C</small></strong></div><input aria-label="Nhiệt độ phòng ăn" type="range" min="18" max="40" step="0.5" value={diningTemp} disabled={slidersLocked} onChange={e => !slidersLocked && setDiningTemp(Number(e.target.value))} /><div className="range-ends"><span>18°C</span><span>40°C</span></div></div>
              <div className="environment-item"><div className="environment-label"><span><Thermometer size={14} /> Nhiệt độ phòng ngủ (Daikin)</span><strong>{bedroomTemp.toFixed(1)}<small>°C</small></strong></div><div className="range-ends"><span>{bedroomHum}% · Đọc từ HA</span><span>Chỉ đọc</span></div></div>
              <div className="environment-item"><div className="environment-label"><span><Wind size={14} /> Khói MQ2 phòng ngủ</span><strong>{mq2Bedroom} <small>ppm</small></strong></div><input aria-label="Khói MQ2 phòng ngủ" type="range" min="0" max="1000" step="10" value={mq2Bedroom} disabled={slidersLocked} onChange={e => !slidersLocked && setMq2Bedroom(Number(e.target.value))} /><div className="range-ends"><span>0 ppm</span><span>1000 ppm</span></div><div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}><label style={{ fontSize: '11px' }}>Ngưỡng MQ2:</label><input aria-label="Ngưỡng cài đặt MQ2" type="number" min="0" max="1000" step="10" value={mq2Threshold} onChange={e => setMq2Threshold(Number(e.target.value))} style={{ width: '70px', padding: '2px 6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.15)', fontSize: '12px' }} /><span style={{ fontSize: '11px' }}>ppm</span></div></div>
              <div className="environment-item"><div className="environment-label"><span><Wind size={14} /> CO2 phòng ăn</span><strong>{co2Dining} <small>ppm</small></strong></div><input aria-label="CO2 phòng ăn" type="range" min="400" max="2500" step="10" value={co2Dining} disabled={slidersLocked} onChange={e => !slidersLocked && setCo2Dining(Number(e.target.value))} /><div className="range-ends"><span>400 ppm</span><span>2500 ppm</span></div><div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}><label style={{ fontSize: '11px' }}>Ngưỡng CO2:</label><input aria-label="Ngưỡng cài đặt CO2" type="number" min="400" max="2500" step="50" value={co2Threshold} onChange={e => setCo2Threshold(Number(e.target.value))} style={{ width: '70px', padding: '2px 6px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.15)', fontSize: '12px' }} /><span style={{ fontSize: '11px' }}>ppm</span></div></div>
              {co2EscalationRemaining !== null && <div style={{ fontSize: '12px', color: '#e67e22', marginTop: '4px' }}>⏳ CO2 chưa giảm: bật thêm quạt hút mùi PA sau {formatCountdown(co2EscalationRemaining)}</div>}
              {co2OffRemaining !== null && <div style={{ fontSize: '12px', color: '#27ae60', marginTop: '4px' }}>⏳ CO2 đạt chuẩn: tắt quạt sau {formatCountdown(co2OffRemaining)}</div>}
              {naturalCoolingRemaining !== null && <div style={{ fontSize: '12px', color: '#2980b9', marginTop: '4px' }}>🌬️ Làm mát tự nhiên: còn {formatCountdown(naturalCoolingRemaining)}</div>}
              {acOn && acHoursRemaining !== null && <div style={{ fontSize: '12px', color: '#0284c7', marginTop: '4px' }}>❄️ Chu kỳ định kỳ: còn {formatCountdown(acHoursRemaining)}</div>}
              {acVentPhase1Remaining !== null && <div style={{ fontSize: '12px', color: '#e67e22', marginTop: '4px' }}>🌪️ Hút mùi PN khởi động: còn {formatCountdown(acVentPhase1Remaining)}</div>}
              {acVentFreshRemaining !== null && <div style={{ fontSize: '12px', color: '#2980b9', marginTop: '4px' }}>🌬️ Gió tươi PN chu kỳ: còn {formatCountdown(acVentFreshRemaining)}</div>}
              {acVentExhaustRemaining !== null && <div style={{ fontSize: '12px', color: '#2980b9', marginTop: '4px' }}>🌬️ Hút mùi PN chu kỳ: còn {formatCountdown(acVentExhaustRemaining)}</div>}
              <button className="outline-button" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }} onClick={() => runAcVentCycle('Test chu kỳ: Bật Gió tươi PN & Hút mùi PN (demo)')} disabled={slidersLocked}>Test chu kỳ 2h (demo)</button>
            </section>
            <section className="automation-card">
              <div className="automation-heading">
                <div className="automation-icon"><Zap size={16} /></div>
                <div>
                  <strong>Tự động hóa thông minh</strong>
                  <span>
                    {isLive
                      ? 'Đang chạy trực tiếp trên máy chủ Home Assistant · Web chỉ giám sát'
                      : automation
                        ? 'Đang hoạt động (Trình duyệt)'
                        : 'Đã tạm dừng'}
                  </span>
                </div>
                <button
                  className={`mini-switch ${automation && !isLive ? 'on' : ''}`}
                  aria-label={isLive ? 'Tự động hóa do Home Assistant xử lý — không thể bật trên Web' : `${automation ? 'Tắt' : 'Bật'} tự động hóa`}
                  aria-pressed={automation && !isLive}
                  onClick={toggleAutomation}
                  disabled={isLive}
                >
                  <span />
                </button>
              </div>
              <p>
                {isLive
                  ? 'Automation trình duyệt đã được TẮT hoàn toàn để tránh xung đột lệnh với Home Assistant. Các kịch bản bật/tắt đèn, điều khiển quạt, chu kỳ thông gió điều hòa… hiện do HA server tự chạy. Trang web chỉ đồng bộ trạng thái mỗi 3 giây và gửi lệnh trực tiếp khi bạn bấm tay vào thiết bị.'
                  : 'Nhóm 1: Kho/Bếp/PA/WC/PK/PN/SB bật đèn ngay khi có người. Nhóm 2: Đèn cửa buồng bật khi Hiên/PN có người & trời tối (lux ≤ 300). Nhóm 3: Đèn SV/cổng/hiên chỉ bật thủ công. MQ2 > ngưỡng: bật hút mùi PN. CO2 > ngưỡng: bật gió tươi PA, sau thời gian chờ bật thêm hút mùi PA; đạt chuẩn sau thời gian chờ tắt cả hai. Trời mát < 28°C, phòng > 30°C, có người: bật gió tươi PA (demo). Luật 4: phòng trống → tắt đèn sau thời gian chờ. Luật 5: AC PN bật → hút mùi PN giai đoạn khởi động; chu kỳ định kỳ → gió tươi PN + hút mùi PN.'}
              </p>
            </section>
            <section className="panel-section devices-section"><div className="section-heading"><div><span className="section-icon device-section"><Zap size={15} /></span><h3>Thiết bị nhanh</h3></div><button className="text-action" onClick={() => addEvent('Đã mở danh sách thiết bị')}>Tất cả <ChevronRight size={12} /></button></div><div className="quick-devices">
              {(['freshAirPA', 'exhaustPA', 'freshAirPN', 'exhaustPN'] as FanKey[]).map(key => (
                <button key={key} className={`device-tile ${fans[key] ? 'active' : ''}`} onClick={() => toggleFan(key)}><span className="tile-icon"><Fan size={17} className={fans[key] ? 'fan-spin' : ''} /></span><span><strong>{FAN_SHORT[key]}</strong><small>{fans[key] ? 'Đang bật' : 'Tắt'}</small></span><ChevronDown size={13} /></button>
              ))}
              <button className={`device-tile ${acOn ? 'active' : ''}`} onClick={() => handleAcToggle(!acOn)}><span className="tile-icon"><AirVent size={17} /></span><span><strong>Điều hòa</strong><small>{acOn ? `${acTargetTemp !== null ? `${acTargetTemp}°` : 'Bật'} · Đang bật` : 'Daikin · Tắt'}</small></span><ChevronDown size={13} /></button>
              <button className={`device-tile ${fanOn ? 'active' : ''}`} onClick={() => handleCeilingFanToggle(!fanOn)}><span className="tile-icon"><Fan size={17} className={fanOn ? 'fan-spin' : ''} /></span><span><strong>Quạt trần</strong><small>{fanOn ? 'Đang bật' : 'Script · Tắt'}</small></span><ChevronDown size={13} /></button>
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
  pin, lights, presence, fans, lux, editMode, onLight, onPresence, onFan, onDragStart, acOn, acTargetTemp, onAc,
  outdoorTemp, outdoorHum, grandparentsTemp, grandparentsHum, diningTemp, diningHum, bedroomTemp, bedroomHum,
  mq2Bedroom, mq2Threshold, co2Dining, co2Threshold, co2OffRemaining, naturalCoolingRemaining, co2EscalationRemaining,
  distances, autoOffRemaining, acVentPhase1Remaining, acVentFreshRemaining, acVentExhaustRemaining,
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
  acTargetTemp: number | null
  onAc: () => void
  outdoorTemp: number
  outdoorHum: number
  grandparentsTemp: number
  grandparentsHum: number
  diningTemp: number
  diningHum: number
  bedroomTemp: number
  bedroomHum: number
  mq2Bedroom: number
  mq2Threshold: number
  co2Dining: number
  co2Threshold: number
  co2OffRemaining: number | null
  naturalCoolingRemaining: number | null
  co2EscalationRemaining: number | null
  distances: Record<SensorKey, number>
  autoOffRemaining: Record<string, number | null>
  acVentPhase1Remaining: number | null
  acVentFreshRemaining: number | null
  acVentExhaustRemaining: number | null
}) {
  const fanActive = pin.fan ? fans[pin.fan] : false
  const active = pin.room ? lights[pin.room] : pin.sensor ? presence[pin.sensor] : pin.fan ? fanActive : pin.id === 'bedroom-ac' ? acOn : false
  const icon = pin.kind === 'light' ? <Lightbulb size={13} /> : pin.kind === 'sensor' ? <Users size={13} /> : pin.kind === 'climate' ? <Thermometer size={13} /> : pin.kind === 'door' ? <DoorOpen size={13} /> : pin.kind === 'weather' ? <CloudSun size={13} /> : pin.kind === 'fan' ? <Fan size={13} className={fanActive ? 'fan-spin' : ''} /> : pin.kind === 'air' ? <Wind size={13} /> : lux > 300 ? <Sun size={13} /> : <Moon size={13} />

  let detail: string | undefined = pin.detail
  if (pin.sensor) {
    const autoOff = autoOffRemaining[pin.sensor]
    detail = `${presence[pin.sensor] ? 'Có người · ' : 'Trống · '}${distances[pin.sensor].toFixed(1)} m`
    if (autoOff !== undefined && autoOff !== null) {
      detail += ` · tắt đèn sau ${autoOff}s`
    }
  } else if (pin.fan) {
    detail = fanActive ? 'Đang bật' : 'Đang tắt'
  } else if (pin.id === 'ambient') {
    detail = `${lux} Lux`
  } else if (pin.id === 'bedroom-ac') {
    detail = acOn
      ? `${acTargetTemp !== null ? `${acTargetTemp}°` : 'Bật'} · Đang bật`
      : 'Đang tắt'
  } else if (pin.id === 'pn-climate') {
    detail = `${bedroomTemp.toFixed(1)}° · ${bedroomHum}%`
  } else if (pin.id === 'pk-climate') {
    detail = `${grandparentsTemp.toFixed(1)}° · ${grandparentsHum}%`
  } else if (pin.id === 'pa-climate') {
    detail = `${diningTemp.toFixed(1)}° · ${diningHum}%`
  } else if (pin.id === 'sv-climate') {
    detail = `${outdoorTemp.toFixed(1)}° · ${outdoorHum}%`
  } else if (pin.id === 'bedroom-mq2') {
    detail = `${mq2Bedroom} ppm${mq2Bedroom > mq2Threshold ? ' ⚠️' : ''}`
  } else if (pin.id === 'dining-co2') {
    detail = `${co2Dining} ppm${co2Dining > co2Threshold ? ' ⚠️' : ''}`
  } else if (pin.id === 'weather') {
    detail = `${outdoorTemp.toFixed(1)}° · ${outdoorHum}%`
  }

  const isAirWarning = (pin.id === 'bedroom-mq2' && mq2Bedroom > mq2Threshold) || (pin.id === 'dining-co2' && co2Dining > co2Threshold)

  const click = () => {
    if (editMode) return
    if (pin.room) onLight(pin.room, pin.title)
    else if (pin.sensor) onPresence(pin.sensor)
    else if (pin.fan) onFan(pin.fan)
    else if (pin.id === 'bedroom-ac') onAc()
  }

  let countdownText: string | null = null
  if (pin.fan === 'freshAirPA' && naturalCoolingRemaining !== null) {
    countdownText = formatCountdown(naturalCoolingRemaining)
  }
  if (pin.fan === 'exhaustPA' && co2EscalationRemaining !== null) {
    countdownText = `Bật sau ${formatCountdown(co2EscalationRemaining)}`
  }
  if (pin.fan === 'freshAirPA' && co2OffRemaining !== null) {
    countdownText = `Tắt sau ${formatCountdown(co2OffRemaining)}`
  }
  if (pin.fan === 'exhaustPN' && acVentPhase1Remaining !== null) {
    countdownText = `Khởi động ${formatCountdown(acVentPhase1Remaining)}`
  }
  if (pin.fan === 'freshAirPN' && acVentFreshRemaining !== null) {
    countdownText = `Chu kỳ ${formatCountdown(acVentFreshRemaining)}`
  }
  if (pin.fan === 'exhaustPN' && acVentExhaustRemaining !== null) {
    countdownText = `Chu kỳ ${formatCountdown(acVentExhaustRemaining)}`
  }

  const acHighlight = pin.id === 'bedroom-ac' && acOn
  const pnClimateHighlight = pin.id === 'pn-climate' && acOn

  return (
    <button
      type="button"
      className={`map-pin pin-${pin.kind} ${active ? 'pin-active' : ''} ${pin.sensor && active ? 'pin-detected' : ''} ${isAirWarning ? 'pin-warning' : ''} ${editMode ? 'pin-editable' : ''} ${acHighlight ? 'pin-ac-on' : ''} ${pnClimateHighlight ? 'pin-climate-ac-on' : ''} pin-${pin.id}`}
      style={{ left: `${pin.x}%`, top: `${pin.y}%`, cursor: editMode ? 'grab' : undefined, touchAction: editMode ? 'none' : undefined }}
      onClick={click}
      onPointerDown={event => onDragStart(event, pin.id)}
      aria-label={`${pin.title}${detail ? `, ${detail}` : ''}${editMode ? ', kéo để di chuyển' : pin.room || pin.sensor || pin.fan || pin.id === 'bedroom-ac' ? ', nhấn để điều khiển' : ''}`}
      aria-pressed={pin.room || pin.sensor || pin.fan || pin.id === 'bedroom-ac' ? active : undefined}
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
