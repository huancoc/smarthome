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
type SensorKey = 'bathroom' | 'living' | 'bedroom'
type Pin = { id: string; x: number; y: number; title: string; kind: 'light' | 'sensor' | 'climate' | 'door' | 'weather' | 'ambient'; room?: RoomKey; sensor?: SensorKey; detail?: string }
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
    livingPresence: 'binary_sensor.ld2410_khach',
    livingDistance: 'sensor.ld2410_khach_distance',
    bathroomPresence: 'binary_sensor.ld2410_wc',
    bathroomDistance: 'sensor.ld2410_wc_distance',
    bedroomPresence: 'binary_sensor.ld2410_ngu',
    bedroomDistance: 'sensor.ld2410_ngu_distance',
    lux: 'sensor.cam_bien_anh_sang',
    temperature: 'sensor.nhiet_do_khach',
    humidity: 'sensor.do_am_khach',
  },
  climate: {
    ac: 'climate.daikin',
    fan: 'fan.quat_tran',
  },
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

const initialPins: Pin[] = [
  { id: 'kho', x: 25, y: 25, title: 'Đèn phòng kho', kind: 'light', room: 'kho' },
  { id: 'bep', x: 25, y: 50, title: 'Đèn bếp', kind: 'light', room: 'bep' },
  { id: 'an', x: 24.4, y: 67.9, title: 'Đèn phòng ăn', kind: 'light', room: 'phongAn' },
  { id: 'an-climate', x: 28.6, y: 88.7, title: 'Nhiệt độ & độ ẩm phòng ăn', kind: 'climate', detail: '26.4° · 68%' },
  { id: 'wc', x: 42.7, y: 13.4, title: 'Đèn nhà vệ sinh', kind: 'light', room: 'veSinh' },
  { id: 'wc-presence', x: 42.2, y: 4.8, title: 'Hiện diện · nhà vệ sinh', kind: 'sensor', sensor: 'bathroom', detail: '1.2 m' },
  { id: 'living', x: 55, y: 30, title: 'Đèn phòng khách', kind: 'light', room: 'khach' },
  { id: 'living-climate', x: 70, y: 25, title: 'Nhiệt độ & độ ẩm phòng khách', kind: 'climate', detail: '28.2° · 72%' },
  { id: 'living-presence', x: 63.6, y: 27.8, title: 'Hiện diện · phòng khách', kind: 'sensor', sensor: 'living', detail: '1.8 m' },
  { id: 'door', x: 75.3, y: 38.1, title: 'Cửa buồng · RFID', kind: 'door', room: 'cuaBuong' },
  { id: 'bedroom-climate', x: 83, y: 39, title: 'Điều hòa Daikin', kind: 'climate', detail: '27.1° · 64%' },
  { id: 'bedroom-light', x: 81.8, y: 8.5, title: 'Đèn tranh phòng ngủ', kind: 'light', room: 'denTranh' },
  { id: 'warm-downlight', x: 79.5, y: 16.5, title: 'Downlight vàng (4 góc)', kind: 'light', room: 'warmDownlight' },
  { id: 'white-downlight', x: 83.5, y: 23.5, title: 'Downlight trắng (Giữa phòng)', kind: 'light', room: 'whiteDownlight' },
  { id: 'yeelight-pn', x: 87.5, y: 16.5, title: 'Đèn Yeelight phòng ngủ', kind: 'light', room: 'yeelightPN' },
  { id: 'bedroom-presence', x: 86.5, y: 30.5, title: 'Hiện diện · phòng ngủ', kind: 'sensor', sensor: 'bedroom', detail: '1.5 m' },
  { id: 'garden', x: 85.2, y: 62.4, title: 'Đèn sân vườn', kind: 'light', room: 'sanVuon' },
  { id: 'gate', x: 84.9, y: 86.1, title: 'Đèn cổng', kind: 'light', room: 'denCong' },
  { id: 'ambient', x: 92, y: 25, title: 'Cảm biến ánh sáng', kind: 'ambient' },
  { id: 'weather', x: 94, y: 9, title: 'Thời tiết ngoài trời', kind: 'weather', detail: '31° · 76%' },
  { id: 'porch-left', x: 58.4, y: 53.5, title: 'Đèn hiên trái', kind: 'light', room: 'hienTrai' },
  { id: 'porch-right', x: 68.2, y: 52.8, title: 'Đèn hiên phải', kind: 'light', room: 'hienPhai' },
  { id: 'yard', x: 46.8, y: 34.5, title: 'Đèn sân bé', kind: 'light', room: 'sanBe' },
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
const initialDistances: Record<SensorKey, number> = { bathroom: 1.2, living: 1.8, bedroom: 1.5 }
const initialPresence: Record<SensorKey, boolean> = { bathroom: false, living: true, bedroom: false }

function timeLabel() { return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date()) }

function pinsToCode(pins: Pin[]) {
  const lines = pins.map(pin => {
    const parts: string[] = [`id: '${pin.id}'`, `x: ${pin.x}`, `y: ${pin.y}`, `title: '${pin.title.replace(/'/g, "\\'")}'`, `kind: '${pin.kind}'`]
    if (pin.room) parts.push(`room: '${pin.room}'`)
    if (pin.sensor) parts.push(`sensor: '${pin.sensor}'`)
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
  const [presence, setPresence] = useState(initialPresence)
  const [distances, setDistances] = useState(initialDistances)
  const [lux, setLux] = useState(126)
  const [temperature, setTemperature] = useState(28)
  const [humidity, setHumidity] = useState(68)
  const [automation, setAutomation] = useState(true)
  const [acOn, setAcOn] = useState(false)
  const [fanOn, setFanOn] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [copied, setCopied] = useState(false)
  const [events, setEvents] = useState([{ time: '14:02:10', message: 'LD2410 Phòng khách phát hiện người (1.8m) + Trời tối → Bật đèn phòng khách', type: 'auto' }, { time: '14:01:42', message: 'Hệ thống nhà thông minh đã sẵn sàng', type: 'system' }, { time: '13:58:06', message: 'Cảm biến sân vườn cập nhật 126 Lux', type: 'sensor' }])
  const isDay = lux > 300
  const floorCanvasRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{ id: string | null }>({ id: null })
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const addEvent = (message: string, type: 'auto' | 'manual' | 'sensor' | 'system' = 'manual') => setEvents(current => [{ time: timeLabel(), message, type }, ...current].slice(0, 8))

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
      const state = byId.get(entityId)
      if (!state) return null
      return state.state === 'on'
    }
    const readNumber = (entityId: string): number | null => {
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

    const livingPresence = readBool(ENTITY_MAP.sensors.livingPresence)
    const bathroomPresence = readBool(ENTITY_MAP.sensors.bathroomPresence)
    const bedroomPresence = readBool(ENTITY_MAP.sensors.bedroomPresence)
    setPresence(previous => ({
      living: livingPresence ?? previous.living,
      bathroom: bathroomPresence ?? previous.bathroom,
      bedroom: bedroomPresence ?? previous.bedroom,
    }))

    const livingDistance = readNumber(ENTITY_MAP.sensors.livingDistance)
    const bathroomDistance = readNumber(ENTITY_MAP.sensors.bathroomDistance)
    const bedroomDistance = readNumber(ENTITY_MAP.sensors.bedroomDistance)
    setDistances(previous => ({
      living: livingDistance ?? previous.living,
      bathroom: bathroomDistance ?? previous.bathroom,
      bedroom: bedroomDistance ?? previous.bedroom,
    }))

    const luxValue = readNumber(ENTITY_MAP.sensors.lux)
    if (luxValue !== null) setLux(Math.round(luxValue))

    const temperatureValue = readNumber(ENTITY_MAP.sensors.temperature)
    if (temperatureValue !== null) setTemperature(Number(temperatureValue.toFixed(1)))

    const humidityValue = readNumber(ENTITY_MAP.sensors.humidity)
    if (humidityValue !== null) setHumidity(Math.round(humidityValue))

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
    const room = sensor === 'living' ? 'phòng khách' : sensor === 'bathroom' ? 'nhà vệ sinh' : 'phòng ngủ'
    addEvent(`LD2410 ${room} ${next ? `phát hiện người (${distances[sensor].toFixed(1)}m)` : 'không còn phát hiện người'}`, 'sensor')
    if (automation && next && lux < 150) {
      const light: RoomKey = sensor === 'living' ? 'khach' : sensor === 'bathroom' ? 'veSinh' : 'warmDownlight'
      setLights(previous => ({ ...previous, [light]: true }))
      addEvent(`Trời tối (${lux} Lux) → Tự động bật đèn ${room}`, 'auto')
      if (mode === 'live' && liveConnected) {
        callHA({ method: 'POST', body: JSON.stringify({ entity_id: ENTITY_MAP.lights[light], action: 'turn_on' }) }).catch(() => {})
      }
    }
    if (automation && next && sensor === 'bedroom' && lux < 150) {
      addEvent(`LD2410 Phòng ngủ phát hiện chuyển động → Tự động bật Downlight vàng`, 'auto')
    }
    if (automation && next && temperature > 29) {
      setAcOn(true); setFanOn(true)
      addEvent(`Nhiệt độ ${temperature}°C → Bật điều hòa 24°C và quạt trần`, 'auto')
      if (mode === 'live' && liveConnected) {
        callHA({ method: 'POST', body: JSON.stringify({ entity_id: ENTITY_MAP.climate.ac, action: 'turn_on' }) }).catch(() => {})
        callHA({ method: 'POST', body: JSON.stringify({ entity_id: ENTITY_MAP.climate.fan, action: 'turn_on' }) }).catch(() => {})
      }
    }
  }
  const updateLux = (value: number) => {
    setLux(value)
    if (automation && value < 150) {
      ;(['living', 'bathroom'] as SensorKey[]).forEach(sensor => {
        if (presence[sensor]) {
          const room: RoomKey = sensor === 'living' ? 'khach' : 'veSinh'
          setLights(previous => ({ ...previous, [room]: true }))
        }
      })
      if (presence.bedroom) {
        setLights(previous => ({ ...previous, warmDownlight: true }))
        addEvent(`LD2410 Phòng ngủ phát hiện chuyển động → Tự động bật Downlight vàng`, 'auto')
      }
      if (presence.living || presence.bathroom || presence.bedroom) addEvent(`Ánh sáng thấp (${value} Lux) + có người → Tự động bật đèn`, 'auto')
    }
  }
  const updateTemperature = (value: number) => {
    setTemperature(value)
    if (automation && value > 29 && (presence.living || presence.bathroom || presence.bedroom)) {
      setAcOn(true); setFanOn(true)
      addEvent(`Nhiệt độ ${value.toFixed(1)}°C → Bật điều hòa 24°C và quạt trần`, 'auto')
    }
  }
  const toggleAutomation = () => {
    const next = !automation
    setAutomation(next)
    addEvent(`Tự động hóa thông minh ${next ? 'đã bật' : 'đã tắt'}`)
  }
  const summary = useMemo(() => `${Object.values(lights).filter(Boolean).length} thiết bị đang hoạt động`, [lights])
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
            <article className="metric-card"><div className="metric-icon warm"><Thermometer size={17} /></div><span className="metric-label">NHIỆT ĐỘ TRONG NHÀ</span><div className="metric-reading">{temperature.toFixed(1)}<span>°C</span><span className="metric-trend up"><ArrowUpRight size={13} /> 1.2°</span></div><div className="metric-foot">Phòng khách <span>Thoải mái</span></div></article>
            <article className="metric-card"><div className="metric-icon blue"><Waves size={17} /></div><span className="metric-label">ĐỘ ẨM</span><div className="metric-reading">{humidity}<span>%</span><span className="metric-trend down"><ArrowDownRight size={13} /> 2%</span></div><div className="metric-foot">Trong nhà <span>Bình thường</span></div></article>
            <article className="metric-card"><div className="metric-icon amber"><Sun size={17} /></div><span className="metric-label">ÁNH SÁNG NGOÀI TRỜI</span><div className="metric-reading">{lux}<span>Lux</span></div><div className="metric-foot">Sân vườn <span>{isDay ? 'Ban ngày' : 'Ánh sáng thấp'}</span></div></article>
            <article className="metric-card"><div className="metric-icon green"><Zap size={17} /></div><span className="metric-label">THIẾT BỊ ĐANG BẬT</span><div className="metric-reading">{Object.values(lights).filter(Boolean).length + Number(acOn) + Number(fanOn)}<span>/ 12</span></div><div className="metric-foot">{summary}<span className="healthy"><span /> Ổn định</span></div></article>
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
              {pins.map(pin => <PinButton key={pin.id} pin={pin} lights={lights} presence={presence} lux={lux} editMode={editMode} onLight={toggleLight} onPresence={togglePresence} onDragStart={handlePinDragStart} acOn={acOn} onAc={() => { const next = !acOn; setAcOn(next); addEvent(`Điều hòa Daikin ${next ? 'đã bật · 24°C' : 'đã tắt'}`); if (mode === 'live' && liveConnected) { callHA({ method: 'POST', body: JSON.stringify({ entity_id: ENTITY_MAP.climate.ac, action: next ? 'turn_on' : 'turn_off' }) }).catch(error => { const message = error instanceof Error ? error.message : String(error); addEvent(`Không gửi được lệnh điều hòa: ${message}`, 'system') }) } }} />)}
              <div className="map-compass"><span>N</span><ArrowUpRight size={14} /></div>
              <div className="map-legend"><span><i className="legend-light" /> Đèn đang bật</span><span><i className="legend-presence" /> Có người</span></div>
            </div>
            <div className="floor-footer"><span><Radio size={13} /> 12 thiết bị <b>·</b> 4 cảm biến</span><span>{editMode ? 'Chế độ chỉnh tọa độ: kéo thả pin để di chuyển' : 'Cập nhật lần cuối: vừa xong'} <span className="sync-mark"><Activity size={13} /></span></span></div>
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
            <section className="panel-section sensors-section"><div className="section-heading"><div><span className="section-icon"><Users size={15} /></span><h3>Cảm biến hiện diện</h3></div><span className="device-count">LD2410 <span>· 3</span></span></div>
              {(['living', 'bathroom', 'bedroom'] as SensorKey[]).map(sensor => { const living = sensor === 'living'; const bedroom = sensor === 'bedroom'; const name = living ? 'Phòng khách' : bedroom ? 'Phòng ngủ' : 'Nhà vệ sinh'; const energyCaption = living ? 'Tĩnh 38 · Động 72' : bedroom ? 'Tĩnh 22 · Động 58' : 'Tĩnh 12 · Động 04'; return <div className="presence-card" key={sensor}><div className="presence-top"><div className={`presence-symbol ${presence[sensor] ? 'detected' : ''}`}><Users size={15} /></div><div className="presence-name"><strong>{name}</strong><span>{presence[sensor] ? 'Đang phát hiện người' : 'Không có người'}</span></div><button className={`mini-switch ${presence[sensor] ? 'on' : ''}`} aria-label={`${presence[sensor] ? 'Tắt' : 'Bật'} cảm biến ${name}`} aria-pressed={presence[sensor]} onClick={() => togglePresence(sensor)}><span /></button></div><div className="distance-row"><span>Khoảng cách</span><strong>{distances[sensor].toFixed(1)} <small>m</small></strong></div><input aria-label={`Khoảng cách ${name}`} type="range" min="0" max="6" step="0.1" value={distances[sensor]} onChange={e => setDistances(previous => ({ ...previous, [sensor]: Number(e.target.value) }))} /><div className="energy-bars"><span>Năng lượng</span><div className="bar-group" aria-label="Năng lượng đứng yên 38 phần trăm, chuyển động 72 phần trăm"><i className="bar-still" /><i className="bar-still" /><i className="bar-still" /><i className="bar-moving" /><i className="bar-moving" /><i className="bar-moving" /><i /><i /><i /><i /></div><span className="energy-caption">{energyCaption}</span></div></div> })}
            </section>
            <section className="panel-section environment-section"><div className="section-heading"><div><span className="section-icon sun-section"><Sun size={15} /></span><h3>Môi trường</h3></div><button className="text-action" onClick={() => addEvent('Đã đồng bộ dữ liệu môi trường', 'sensor')}>Đồng bộ</button></div>
              <div className="environment-item"><div className="environment-label"><span><Sun size={14} /> Ánh sáng xung quanh</span><strong>{lux} <small>Lux</small> <span className={`day-tag ${isDay ? 'day' : ''}`}>{isDay ? 'NGÀY' : 'ĐÊM'}</span></strong></div><input aria-label="Ánh sáng xung quanh, Lux" type="range" min="0" max="1000" step="10" value={lux} onChange={e => updateLux(Number(e.target.value))} /><div className="range-ends"><span>0 Lux</span><span>1000 Lux</span></div></div>
              <div className="environment-item"><div className="environment-label"><span><Thermometer size={14} /> Nhiệt độ trong nhà</span><strong>{temperature.toFixed(1)}<small>°C</small></strong></div><input aria-label="Nhiệt độ trong nhà" type="range" min="18" max="40" step="0.5" value={temperature} onChange={e => updateTemperature(Number(e.target.value))} /><div className="range-ends"><span>18°C</span><span>40°C</span></div></div>
              <div className="environment-item humidity-control"><div className="environment-label"><span><Waves size={14} /> Độ ẩm</span><strong>{humidity}<small>%</small></strong></div><input aria-label="Độ ẩm trong nhà" type="range" min="30" max="95" step="1" value={humidity} onChange={e => setHumidity(Number(e.target.value))} /><div className="range-ends"><span>30%</span><span>95%</span></div></div>
            </section>
            <section className="automation-card"><div className="automation-heading"><div className="automation-icon"><Zap size={16} /></div><div><strong>Tự động hóa thông minh</strong><span>{automation ? 'Đang hoạt động' : 'Đã tạm dừng'}</span></div><button className={`mini-switch ${automation ? 'on' : ''}`} aria-label={`${automation ? 'Tắt' : 'Bật'} tự động hóa`} aria-pressed={automation} onClick={toggleAutomation}><span /></button></div><p>Khi có người &amp; ánh sáng thấp, tự động bật đèn. Trên 29°C sẽ bật điều hòa và quạt.</p></section>
            <section className="panel-section devices-section"><div className="section-heading"><div><span className="section-icon device-section"><Zap size={15} /></span><h3>Thiết bị nhanh</h3></div><button className="text-action" onClick={() => addEvent('Đã mở danh sách thiết bị')}>Tất cả <ChevronRight size={12} /></button></div><div className="quick-devices"><button className={`device-tile ${acOn ? 'active' : ''}`} onClick={() => { const next = !acOn; setAcOn(next); addEvent(`Điều hòa Daikin ${next ? 'đã bật · 24°C' : 'đã tắt'}`); if (mode === 'live' && liveConnected) { callHA({ method: 'POST', body: JSON.stringify({ entity_id: ENTITY_MAP.climate.ac, action: next ? 'turn_on' : 'turn_off' }) }).catch(error => { const message = error instanceof Error ? error.message : String(error); addEvent(`Không gửi được lệnh điều hòa: ${message}`, 'system') }) } }}><span className="tile-icon"><AirVent size={17} /></span><span><strong>Điều hòa</strong><small>{acOn ? '24°C · Đang bật' : 'Daikin · Tắt'}</small></span><ChevronDown size={13} /></button><button className={`device-tile ${fanOn ? 'active' : ''}`} onClick={() => { const next = !fanOn; setFanOn(next); addEvent(`Quạt trần ${next ? 'đã bật' : 'đã tắt'}`); if (mode === 'live' && liveConnected) { callHA({ method: 'POST', body: JSON.stringify({ entity_id: ENTITY_MAP.climate.fan, action: next ? 'turn_on' : 'turn_off' }) }).catch(error => { const message = error instanceof Error ? error.message : String(error); addEvent(`Không gửi được lệnh quạt: ${message}`, 'system') }) } }}><span className="tile-icon"><Fan size={17} /></span><span><strong>Quạt trần</strong><small>{fanOn ? 'Đang bật · Mức 2' : 'Phòng khách · Tắt'}</small></span><ChevronDown size={13} /></button></div></section>
            <section className="event-section"><div className="section-heading"><div><span className="section-icon event-section-icon"><Activity size={15} /></span><h3>Nhật ký hoạt động</h3></div><button className="text-action" onClick={() => setEvents([])}>Xóa nhật ký</button></div><div className="event-list">{events.length ? events.map((event, index) => <div className="event-row" key={`${event.time}-${index}`}><span className={`event-dot ${event.type}`} /><span className="event-time">{event.time}</span><p>{event.message}</p></div>) : <p className="empty-events">Chưa có hoạt động mới.</p>}</div></section>
            <div className="panel-footer"><Battery size={13} /> Tất cả cảm biến đang kết nối <span className="footer-healthy"><span /> Tốt</span></div>
          </>}
        </aside>
      </section>
    </main>
  )
}

function PinButton({ pin, lights, presence, lux, editMode, onLight, onPresence, onDragStart, acOn, onAc }: { pin: Pin; lights: Record<RoomKey, boolean>; presence: Record<SensorKey, boolean>; lux: number; editMode: boolean; onLight: (room: RoomKey, title: string) => void; onPresence: (sensor: SensorKey) => void; onDragStart: (event: React.PointerEvent<HTMLButtonElement>, id: string) => void; acOn: boolean; onAc: () => void }) {
  const active = pin.room ? lights[pin.room] : pin.sensor ? presence[pin.sensor] : pin.id === 'bedroom-climate' ? acOn : false
  const icon = pin.kind === 'light' ? <Lightbulb size={13} /> : pin.kind === 'sensor' ? <Users size={13} /> : pin.kind === 'climate' ? <Thermometer size={13} /> : pin.kind === 'door' ? <DoorOpen size={13} /> : pin.kind === 'weather' ? <CloudSun size={13} /> : lux > 300 ? <Sun size={13} /> : <Moon size={13} />
  const detail = pin.sensor ? `${presence[pin.sensor] ? 'Có người · ' : 'Trống · '}${pin.sensor === 'living' ? '1.8' : pin.sensor === 'bedroom' ? '1.5' : '1.2'} m` : pin.id === 'ambient' ? `${lux} Lux` : pin.id === 'bedroom-climate' ? `${acOn ? '24° · Đang bật' : '27.1° · 64%'}` : pin.detail
  const click = () => { if (editMode) return; if (pin.room) onLight(pin.room, pin.title); else if (pin.sensor) onPresence(pin.sensor); else if (pin.id === 'bedroom-climate') onAc() }
  return <button type="button" className={`map-pin pin-${pin.kind} ${active ? 'pin-active' : ''} ${pin.sensor && active ? 'pin-detected' : ''} ${editMode ? 'pin-editable' : ''} pin-${pin.id}`} style={{ left: `${pin.x}%`, top: `${pin.y}%`, cursor: editMode ? 'grab' : undefined, touchAction: editMode ? 'none' : undefined }} onClick={click} onPointerDown={event => onDragStart(event, pin.id)} aria-label={`${pin.title}${detail ? `, ${detail}` : ''}${editMode ? ', kéo để di chuyển' : pin.room || pin.sensor || pin.id === 'bedroom-climate' ? ', nhấn để điều khiển' : ''}`} aria-pressed={pin.room || pin.sensor || pin.id === 'bedroom-climate' ? active : undefined} title={editMode ? `${pin.title} · x: ${pin.x}, y: ${pin.y}` : pin.title}><span className="pin-icon">{icon}</span><span className="pin-copy"><strong>{pin.title}</strong>{detail && <small>{detail}</small>}{editMode && <small className="pin-coords">{pin.x}% · {pin.y}%</small>}</span>{active && pin.kind === 'light' && <span className="pin-status" />}</button>
}
