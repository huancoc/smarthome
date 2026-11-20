import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const HA_URL = process.env.HA_URL
const HA_TOKEN = process.env.HA_TOKEN
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

function unauthorized() {
  return NextResponse.json({ error: 'Sai mật khẩu quản trị' }, { status: 401 })
}

function misconfigured() {
  return NextResponse.json(
    { error: 'Server chưa cấu hình HA_URL / HA_TOKEN / ADMIN_PASSWORD' },
    { status: 500 }
  )
}

function checkPassword(request: NextRequest): boolean {
  if (!ADMIN_PASSWORD) return false
  const provided = request.headers.get('x-admin-password')
  if (!provided) return false
  return provided === ADMIN_PASSWORD
}

export async function GET(request: NextRequest) {
  if (!HA_URL || !HA_TOKEN || !ADMIN_PASSWORD) {
    return misconfigured()
  }
  if (!checkPassword(request)) {
    return unauthorized()
  }

  try {
    const response = await fetch(`${HA_URL}/api/states`, {
      headers: {
        Authorization: `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Home Assistant trả về lỗi ${response.status}` },
        { status: response.status }
      )
    }

    const states = await response.json()
    return NextResponse.json({ states }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Không thể kết nối tới Home Assistant' },
      { status: 502 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!HA_URL || !HA_TOKEN || !ADMIN_PASSWORD) {
    return misconfigured()
  }
  if (!checkPassword(request)) {
    return unauthorized()
  }

  let body: { entity_id?: string; action?: string }
  try {
    body = await request.json()
  } catch (error) {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 })
  }

  const { entity_id, action } = body

  if (!entity_id || typeof entity_id !== 'string') {
    return NextResponse.json({ error: 'Thiếu entity_id' }, { status: 400 })
  }
  if (!action || typeof action !== 'string') {
    return NextResponse.json({ error: 'Thiếu action' }, { status: 400 })
  }

  const domain = entity_id.split('.')[0]
  if (!domain) {
    return NextResponse.json({ error: 'entity_id không hợp lệ' }, { status: 400 })
  }

  try {
    const response = await fetch(`${HA_URL}/api/services/${domain}/${action}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ entity_id }),
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Home Assistant trả về lỗi ${response.status}` },
        { status: response.status }
      )
    }

    const result = await response.json().catch(() => ({}))
    return NextResponse.json({ ok: true, result }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Không thể gửi lệnh tới Home Assistant' },
      { status: 502 }
    )
  }
}
