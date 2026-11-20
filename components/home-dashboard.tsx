'use client'

import { useMemo, useState } from 'react'
import { Activity, AirVent, ArrowDownRight, ArrowUpRight, Battery, ChevronDown, ChevronRight, CircleHelp, CloudSun, DoorOpen, Fan, Home, Lightbulb, Moon, MoreHorizontal, PanelRightClose, Radio, Settings2, ShieldCheck, Sun, Thermometer, Users, Waves, Zap } from 'lucide-react'

type RoomKey = 'kho' | 'bep' | 'phongAn' | 'veSinh' | 'khach' | 'hienTrai' | 'hienPhai' | 'sanBe' | 'cuaBuong' | 'denTranh' | 'sanVuon' | 'denCong'
type SensorKey = 'bathroom' | 'living'
type Pin = { id: string; x: number; y: number; title: string; kind: 'light' | 'sensor' | 'climate' | 'door' | 'weather' | 'ambient'; room?: RoomKey; sensor?: SensorKey; detail?: string }

const floorImage = '/floor-plan/bg.jpg'

const lightLayers: { room: RoomKey; src: string }[] = [
  { room: 'kho', src: '/floor-plan/kho.png' },
  { room: 'bep', src: '/floor-plan/bep.png' },
  { room: 'phongAn', src: '/floor-plan/phong-an.png' },
  { room: 'khach', src: '/floor-plan/phong-ong-ba.png' },
  { room: 'hienTrai', src: '/floor-plan/he-trai.png' },
  { room: 'hienPhai', src: '/floor-plan/he-phai.png' },
  { room: 'sanBe', src: '/floor-plan/san-be.png' },
  { room: 'cuaBuong', src: '/floor-plan/cua-buong.png' },
  { room: 'denTranh', src: '/floor-plan/den-tranh.png' },
  { room: 'sanVuon', src: '/floor-plan/san-vuon.png' },
  { room: 'denCong', src: '/floor-plan/den-cong.png' },
]

const pins: Pin[] = [
  { id: 'kho', x: 25, y: 25, title: 'Đèn phòng kho', kind: 'light', room: 'kho' },
  { id: 'bep', x: 25, y: 50, title: 'Đèn bếp', kind: 'light', room: 'bep' },
  { id: 'phong-an-light', x: 25, y: 66, title: 'Đèn phòng ăn', kind: 'light', room: 'phongAn' },
  { id: 'an', x: 25, y: 76, title: 'Nhiệt độ & độ ẩm phòng ăn', kind: 'climate', detail: '26.4° · 68%' },
  { id: 'wc', x: 37, y: 14, title: 'Đèn nhà vệ sinh', kind: 'light', room: 'veSinh' },
  { id: 'wc-presence', x: 41, y: 20, title: 'Hiện diện · nhà vệ sinh', kind: 'sensor', sensor: 'bathroom', detail: '1.2 m' },
  { id: 'living', x: 55, y: 30, title: 'Đèn phòng khách', kind: 'light', room: 'khach' },
  { id: 'living-climate', x: 70, y: 25, title: 'Nhiệt độ & độ ẩm phòng khách', kind: 'climate', detail: '28.2° · 72%' },
  { id: 'living-presence', x: 62, y: 38, title: 'Hiện diện · phòng khách', kind: 'sensor', sensor: 'living', detail: '1.8 m' },
  { id: 'den-tranh', x: 76, y: 15, title: 'Đèn tranh phòng ngủ', kind: 'light', room: 'denTranh' },
  { id: 'door', x: 77, y: 43, title: 'Đèn cửa buồng', kind: 'door', room: 'cuaBuong' },
  { id: 'bedroom-climate', x: 83, y: 39, title: 'Điều hòa Daikin', kind: 'climate', detail: '27.1° · 64%' },
  { id: 'garden', x: 80, y: 56, title: 'Đèn sân vườn', kind: 'light', room: 'sanVuon' },
  { id: 'gate', x: 88, y: 65, title: 'Đèn cổng', kind: 'light', room: 'denCong' },
  { id: 'ambient', x: 92, y: 25, title: 'Cảm biến ánh sáng', kind: 'ambient' },
  { id: 'weather', x: 94, y: 9, title: 'Thời tiết ngoài trời', kind: 'weather', detail: '31° · 76%' },
  { id: 'porch-left', x: 54, y: 17, title: 'Đèn hiên trái', kind: 'light', room: 'hienTrai' },
  { id: 'porch-right', x: 72, y: 17, title: 'Đèn hiên phải', kind: 'light', room: 'hienPhai' },
  { id: 'yard', x: 46, y: 53, title: 'Đèn sân bé', kind: 'light', room: 'sanBe' },
]

const initialLights: Record<RoomKey, boolean> = {
  kho: false,
  bep: true,
  phongAn: false,
  veSinh: false,
  khach: true,
  hienTrai: false,
  hienPhai: false,
  sanBe: false,
  cuaBuong: false,
  denTranh: false,
  sanVuon: false,
  denCong: false,
}

const initialDistances: Record<SensorKey, number> = { bathroom: 1.2, living: 1.8 }
const initialPresence: Record<SensorKey, boolean> = { bathroom: false, living: true }

function timeLabel() {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date())
}

export function HomeDashboard() {
  const [mode, setMode] = useState<'demo' | 'live'>('demo')
  const [lights, setLights] = useState(initialLights)
  const [presence, setPresence] = useState(initialPresence)
  const [distances, setDistances] = useState(initialDistances)
  const [lux, setLux] = useState(126)
  const [temperature, setTemperature] = useState(28)
  const [humidity, setHumidity] = useState(68)
  const [automation, setAutomation] = useState(true)
  const [acOn, setAcOn] = useState(false)
  const [fanOn, setFanOn] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [events, setEvents] = useState([
    { time: '14:02:10', message: 'LD2410 Phòng khách phát hiện người (1.8m) + Trời tối → Bật đèn phòng khách', type: 'auto' },
    { time: '14:01:42', message: 'Hệ thống nhà thông minh đã sẵn sàng', type: 'system' },
    { time: '13:58:06', message: 'Cảm biến sân vườn cập nhật 126 Lux', type: 'sensor' },
  ])

  const isDay = lux > 300

  const addEvent = (message: string, type: 'auto' | 'manual' | 'sensor' = 'manual') =>
    setEvents((current) => [{ time: timeLabel(), message, type }, ...current].slice(0, 8))

  const toggleLight = (room: RoomKey, title: string) => {
    const next = !lights[room]
    setLights((previous) => ({ ...previous, [room]: next }))
    addEvent(`${title} · ${next ? 'Đã bật' : 'Đã tắt'} đèn`, 'manual')
  }

  const toggleAllLights = (turnOn: boolean) => {
    const updated = Object.keys(lights).reduce((acc, key) => {
      acc[key as RoomKey] = turnOn
      return acc
    }, {} as Record<RoomKey, boolean>)
    setLights(updated)
    addEvent(turnOn ? 'Đã bật toàn bộ đèn trong nhà' : 'Đã tắt toàn bộ đèn trong nhà', 'manual')
  }

  const togglePresence = (sensor: SensorKey) => {
    const next = !presence[sensor]
    setPresence((previous) => ({ ...previous, [sensor]: next }))
    const room = sensor === 'living' ? 'phòng khách' : 'nhà vệ sinh'
    addEvent(`LD2410 ${room} ${next ? `phát hiện người (${distances[sensor].toFixed(1)}m)` : 'không còn phát hiện người'}`, 'sensor')
    if (automation && next && lux < 150) {
      const light = sensor === 'living' ? 'khach' : 'veSinh'
      setLights((previous) => ({ ...previous, [light]: true }))
      addEvent(`Trời tối (${lux} Lux) → Tự động bật đèn ${room}`, 'auto')
    }
    if (automation && next && temperature > 29) {
      setAcOn(true)
      setFanOn(true)
      addEvent(`Nhiệt độ ${temperature}°C → Bật điều hòa 24°C và quạt trần`, 'auto')
    }
  }

  const updateLux = (value: number) => {
    setLux(value)
    if (automation && value < 150) {
      ;(['living', 'bathroom'] as SensorKey[]).forEach((sensor) => {
        if (presence[sensor]) {
          const room: RoomKey = sensor === 'living' ? 'khach' : 'veSinh'
          setLights((previous) => ({ ...previous, [room]: true }))
        }
      })
      if (presence.living || presence.bathroom) addEvent(`Ánh sáng thấp (${value} Lux) + có người → Tự động bật đèn`, 'auto')
    }
  }

  const updateTemperature = (value: number) => {
    setTemperature(value)
    if (automation && value > 29 && (presence.living || presence.bathroom)) {
      setAcOn(true)
      setFanOn(true)
      addEvent(`Nhiệt độ ${value.toFixed(1)}°C → Bật điều hòa 24°C và quạt trần`, 'auto')
    }
  }

  const toggleAutomation = () => {
    const next = !automation
    setAutomation(next)
    addEvent(`Tự động hóa thông minh ${next ? 'đã bật' : 'đã tắt'}`)
  }

  const activeCount = Object.values(lights).filter(Boolean).length
  const summary = useMemo(() => `${activeCount} đèn đang bật`, [activeCount])

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Trang chủ Smart Living">
          <span className="brand-mark">
            <Home size={17} strokeWidth={1.8} />
          </span>
          <span className="brand-name">
            nếp<span>.</span>
            <small>SMART LIVING</small>
          </span>
        </a>
        <div className="breadcrumb">
          <span>Không gian</span>
          <ChevronRight size={13} />
          <strong>Nhà của Minh</strong>
          <span className="status-dot" /> <span className="online-label">Trực tuyến</span>
        </div>
        <div className="top-actions">
          <button className="icon-button" aria-label="Trợ giúp">
            <CircleHelp size={17} />
          </button>
          <button className="icon-button" aria-label="Cài đặt">
            <Settings2 size={17} />
          </button>
          <div className="avatar">M</div>
        </div>
      </header>

      <section className="workspace">
        <div className="main-column">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" /> TỔNG QUAN NGÔI NHÀ
              </div>
              <h1>
                Chào buổi chiều, Minh{' '}
                <span className="heading-sun">
                  <Sun size={23} />
                </span>
              </h1>
              <p>Ngôi nhà của bạn đang vận hành bình thường.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="outline-button" onClick={() => toggleAllLights(activeCount === 0)}>
                <Lightbulb size={15} /> {activeCount === 0 ? 'Bật tất cả đèn' : 'Tắt tất cả đèn'}
              </button>
              <button className="outline-button" onClick={() => addEvent('Đã làm mới trạng thái thiết bị', 'sensor')}>
                <Activity size={15} /> Cập nhật <span className="live-indicator" />
              </button>
            </div>
          </div>

          <div className="metrics-row">
            <article className="metric-card">
              <div className="metric-icon warm">
                <Thermometer size={17} />
              </div>
              <span className="metric-label">NHIỆT ĐỘ TRONG NHÀ</span>
              <div className="metric-reading">
                {temperature.toFixed(1)}
                <span>°C</span>
                <span className="metric-trend up">
