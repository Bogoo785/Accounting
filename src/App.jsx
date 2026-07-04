import { useEffect, useMemo, useState } from 'react'
import './App.css'

const presetItems = [
  { name: '早餐', icon: '🍳' },
  { name: '午餐', icon: '🍱' },
  { name: '晚餐', icon: '🍲' },
]
const customIconOptions = [
  { label: '娛樂', icon: '🎮' },
  { label: '藥品', icon: '💊' },
  { label: '交通', icon: '🚌' },
  { label: '購物', icon: '🛒' },
  { label: '飲料', icon: '🥤' },
  { label: '其他', icon: '🧾' },
]
const storageKey = 'daily-expenses'
const startDayKey = 'billing-start-day'
const endDayKey = 'billing-end-day'
const dayOptions = Array.from({ length: 31 }, (_, index) => index + 1)

function getSavedDay(key, fallback) {
  const saved = Number(localStorage.getItem(key))
  return dayOptions.includes(saved) ? saved : fallback
}

function getPreviousDay(day) {
  return day === 1 ? 31 : day - 1
}

function getDefaultIcon(name) {
  return (
    presetItems.find((item) => item.name === name)?.icon ??
    customIconOptions.find((item) => item.label === name)?.icon ??
    '🧾'
  )
}

function formatMoney(value) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat('zh-TW', {
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function formatMonthTitle(date) {
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'long',
  }).format(date)
}

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getMonthDate(year, month, day) {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, lastDay))
}

function isDateInRange(date, start, end) {
  return date >= start && date <= end
}

function getBillingPeriod(date, startDay = 14, endDay = 13) {
  const candidates = [-1, 0, 1].map((offset) => {
    const startMonth = date.getMonth() + offset
    const start = getMonthDate(date.getFullYear(), startMonth, startDay)
    const endMonth = endDay >= startDay ? startMonth : startMonth + 1
    const displayEnd = getMonthDate(date.getFullYear(), endMonth, endDay)
    const end = new Date(displayEnd)
    end.setDate(end.getDate() + 1)

    return { start, end, displayEnd }
  })

  return (
    candidates.find((period) =>
      isDateInRange(date, period.start, period.displayEnd),
    ) ?? candidates[1]
  )
}

function getDateRange(start, end) {
  const days = []
  const cursor = new Date(start)

  while (cursor <= end) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

function getBillingDays(start, end) {
  const days = []
  const cursor = new Date(start)

  while (cursor < end) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

function getMonthDays(monthDate) {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)

  return getDateRange(start, end)
}

function moveMonth(date, direction) {
  const target = new Date(date.getFullYear(), date.getMonth() + direction, 1)
  const targetLastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0,
  ).getDate()
  const day = Math.min(date.getDate(), targetLastDay)

  return new Date(target.getFullYear(), target.getMonth(), day)
}

function normalizeRecords(records) {
  return records.map((record) => ({
    id: record.id ?? crypto.randomUUID(),
    name: record.name,
    icon: record.icon ?? getDefaultIcon(record.name),
    amount: Number(record.amount) || 0,
    dateKey: record.dateKey ?? toDateKey(new Date(record.createdAt ?? Date.now())),
    createdAt: record.createdAt ?? new Date().toISOString(),
  }))
}

function App() {
  const today = useMemo(() => new Date(), [])
  const [startDay, setStartDay] = useState(() => {
    return getSavedDay(startDayKey, 14)
  })
  const [endDay, setEndDay] = useState(() => {
    const savedStartDay = getSavedDay(startDayKey, 14)
    return getSavedDay(endDayKey, getPreviousDay(savedStartDay))
  })
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(today))
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  )
  const [amounts, setAmounts] = useState(
    Object.fromEntries(presetItems.map((item) => [item.name, ''])),
  )
  const [customName, setCustomName] = useState('')
  const [customAmount, setCustomAmount] = useState('')
  const [customIcon, setCustomIcon] = useState(customIconOptions[0].icon)
  const [records, setRecords] = useState(() => {
    const saved = localStorage.getItem(storageKey)
    return saved ? normalizeRecords(JSON.parse(saved)) : []
  })

  const selectedDate = useMemo(
    () => fromDateKey(selectedDateKey),
    [selectedDateKey],
  )
  const period = useMemo(
    () => getBillingPeriod(selectedDate, startDay, endDay),
    [endDay, selectedDate, startDay],
  )
  const periodDays = useMemo(
    () => getBillingDays(period.start, period.end),
    [period.end, period.start],
  )
  const visibleMonthDays = useMemo(
    () => getMonthDays(visibleMonth),
    [visibleMonth],
  )

  const dailyTotals = useMemo(() => {
    return records.reduce((totals, record) => {
      totals[record.dateKey] = (totals[record.dateKey] ?? 0) + record.amount
      return totals
    }, {})
  }, [records])

  const selectedItems = useMemo(() => {
    const totals = records
      .filter((record) => record.dateKey === selectedDateKey)
      .reduce((items, record) => {
        const key = `${record.icon}|${record.name}`
        const current = items[key] ?? {
          name: record.name,
          icon: record.icon,
          amount: 0,
        }
        items[key] = { ...current, amount: current.amount + record.amount }
        return items
      }, {})

    return Object.values(totals)
  }, [records, selectedDateKey])

  const selectedTotal = dailyTotals[selectedDateKey] ?? 0
  const periodTotal = periodDays.reduce(
    (sum, day) => sum + (dailyTotals[toDateKey(day)] ?? 0),
    0,
  )

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(records))
  }, [records])

  useEffect(() => {
    localStorage.setItem(startDayKey, String(startDay))
  }, [startDay])

  useEffect(() => {
    localStorage.setItem(endDayKey, String(endDay))
  }, [endDay])

  function changeVisibleMonth(direction) {
    const nextDate = moveMonth(selectedDate, direction)
    setSelectedDateKey(toDateKey(nextDate))
    setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1))
  }

  function selectDate(date) {
    setSelectedDateKey(toDateKey(date))
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1))
  }

  function addRecord(name, amount, icon = getDefaultIcon(name)) {
    const expense = Number(amount)

    if (!name.trim() || Number.isNaN(expense) || expense <= 0) {
      return
    }

    setRecords((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        icon,
        amount: expense,
        dateKey: selectedDateKey,
        createdAt: new Date().toISOString(),
      },
    ])
  }

  function submitPreset(item) {
    addRecord(item.name, amounts[item.name], item.icon)
    setAmounts((current) => ({ ...current, [item.name]: '' }))
  }

  function submitCustom(event) {
    event.preventDefault()
    addRecord(customName, customAmount, customIcon)
    setCustomName('')
    setCustomAmount('')
  }

  function updateItemAmount(item, amount) {
    const expense = Number(amount)

    if (Number.isNaN(expense) || expense < 0) {
      return
    }

    setRecords((current) => {
      const others = current.filter(
        (record) =>
          record.dateKey !== selectedDateKey ||
          record.name !== item.name ||
          record.icon !== item.icon,
      )

      if (expense === 0) {
        return others
      }

      return [
        ...others,
        {
          id: crypto.randomUUID(),
          name: item.name,
          icon: item.icon,
          amount: expense,
          dateKey: selectedDateKey,
          createdAt: new Date().toISOString(),
        },
      ]
    })
  }

  function removeItem(item) {
    setRecords((current) =>
      current.filter(
        (record) =>
          record.dateKey !== selectedDateKey ||
          record.name !== item.name ||
          record.icon !== item.icon,
      ),
    )
  }

  return (
    <main className="app-shell">
      <section className="header-panel">
        <div>
          <p className="eyebrow">可自訂結算區間</p>
          <h1>我的記帳本</h1>
          <div className="period-settings">
            <label className="period-setting">
              <span>起始日期</span>
              <select
                value={startDay}
                onChange={(event) => setStartDay(Number(event.target.value))}
              >
                {dayOptions.map((day) => (
                  <option key={day} value={day}>
                    {day} 號
                  </option>
                ))}
              </select>
            </label>
            <label className="period-setting">
              <span>截止日期</span>
              <select
                value={endDay}
                onChange={(event) => setEndDay(Number(event.target.value))}
              >
                {dayOptions.map((day) => (
                  <option key={day} value={day}>
                    {day} 號
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="period">
            {formatShortDate(period.start)} - {formatShortDate(period.displayEnd)}
          </p>
        </div>
        <div className="total-box">
          <span>本期總結</span>
          <strong>{formatMoney(periodTotal)}</strong>
        </div>
      </section>

      <section className="calendar-panel" aria-label="月曆">
        <div className="calendar-heading">
          <button
            aria-label="上一個月"
            className="month-button"
            type="button"
            onClick={() => changeVisibleMonth(-1)}
          >
            ‹
          </button>
          <div>
            <h2>{formatMonthTitle(visibleMonth)}</h2>
            <p>
              {formatShortDate(selectedDate)} 花費 {formatMoney(selectedTotal)}
            </p>
          </div>
          <button
            aria-label="下一個月"
            className="month-button"
            type="button"
            onClick={() => changeVisibleMonth(1)}
          >
            ›
          </button>
        </div>

        <div className="calendar-weekdays" aria-hidden="true">
          {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {Array.from({ length: visibleMonthDays[0].getDay() }).map(
            (_, index) => (
              <span className="calendar-spacer" key={`spacer-${index}`} />
            ),
          )}
          {visibleMonthDays.map((day) => {
            const dateKey = toDateKey(day)
            const total = dailyTotals[dateKey] ?? 0
            const isSelected = dateKey === selectedDateKey

            return (
              <button
                className={`calendar-day${isSelected ? ' is-selected' : ''}`}
                key={dateKey}
                type="button"
                onClick={() => selectDate(day)}
              >
                <span>{day.getDate()}</span>
                <strong>{total > 0 ? formatMoney(total) : '-'}</strong>
              </button>
            )
          })}
        </div>
      </section>

      <section className="quick-entry" aria-label="快速輸入">
        {presetItems.map((item) => (
          <form
            className="entry-row"
            key={item.name}
            onSubmit={(event) => {
              event.preventDefault()
              submitPreset(item)
            }}
          >
            <label className="icon-label" htmlFor={`amount-${item.name}`}>
              <span className="item-icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.name}
            </label>
            <input
              id={`amount-${item.name}`}
              inputMode="numeric"
              min="0"
              placeholder="金額"
              type="number"
              value={amounts[item.name]}
              onChange={(event) =>
                setAmounts((current) => ({
                  ...current,
                  [item.name]: event.target.value,
                }))
              }
            />
            <button type="submit">加入</button>
          </form>
        ))}
      </section>

      <form className="custom-entry" onSubmit={submitCustom}>
        <select
          aria-label="花費圖示"
          className="icon-select"
          value={customIcon}
          onChange={(event) => setCustomIcon(event.target.value)}
        >
          {customIconOptions.map((item) => (
            <option key={item.icon} value={item.icon}>
              {item.icon} {item.label}
            </option>
          ))}
        </select>
        <input
          aria-label="新增花費項目"
          placeholder="新增花費項目"
          type="text"
          value={customName}
          onChange={(event) => setCustomName(event.target.value)}
        />
        <input
          aria-label="自訂項目金額"
          inputMode="numeric"
          min="0"
          placeholder="金額"
          type="number"
          value={customAmount}
          onChange={(event) => setCustomAmount(event.target.value)}
        />
        <button type="submit">新增</button>
      </form>

      <section className="records-panel" aria-label="花費明細">
        <div className="records-heading">
          <h2>{formatShortDate(selectedDate)} 明細</h2>
          <span>{selectedItems.length} 個項目</span>
        </div>

        {selectedItems.length === 0 ? (
          <p className="empty-state">這一天還沒有花費</p>
        ) : (
          <ul className="records-list">
            {selectedItems.map((item) => (
              <li key={`${item.icon}-${item.name}`}>
                <div className="record-title">
                  <span className="item-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.name}</span>
                </div>
                <div className="record-controls">
                  <input
                    aria-label={`${item.name} 金額`}
                    inputMode="numeric"
                    min="0"
                    type="number"
                    value={item.amount}
                    onChange={(event) =>
                      updateItemAmount(item, event.target.value)
                    }
                  />
                  <button type="button" onClick={() => removeItem(item)}>
                    刪除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="summary-row">
          <span>當日總結</span>
          <strong>{formatMoney(selectedTotal)}</strong>
        </div>
      </section>
    </main>
  )
}

export default App
