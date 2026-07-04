import { useEffect, useMemo, useRef, useState } from 'react'
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
const calendarEntryOptions = [...presetItems, ...customIconOptions].map(
  (item) => ({
    name: item.name ?? item.label,
    icon: item.icon,
  }),
)
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
  const datePickerRef = useRef(null)
  const otherPeriodsRef = useRef(null)
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
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isOtherPeriodsOpen, setIsOtherPeriodsOpen] = useState(false)
  const [calendarEntryDateKey, setCalendarEntryDateKey] = useState(null)
  const [isCalendarEntryFormOpen, setIsCalendarEntryFormOpen] = useState(false)
  const [calendarEntryName, setCalendarEntryName] = useState(
    calendarEntryOptions[0].name,
  )
  const [calendarEntryAmount, setCalendarEntryAmount] = useState('')
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
  const todayDateKey = useMemo(() => toDateKey(today), [today])
  const period = useMemo(
    () => getBillingPeriod(today, startDay, endDay),
    [endDay, startDay, today],
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

  const todayItems = useMemo(() => {
    const totals = records
      .filter((record) => record.dateKey === todayDateKey)
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
  }, [records, todayDateKey])

  const selectedTotal = dailyTotals[selectedDateKey] ?? 0
  const todayTotal = dailyTotals[todayDateKey] ?? 0
  const periodTotal = periodDays.reduce(
    (sum, day) => sum + (dailyTotals[toDateKey(day)] ?? 0),
    0,
  )
  const periodKey = toDateKey(period.start)
  const periodDailySummaries = useMemo(
    () =>
      periodDays
        .map((day) => {
          const dateKey = toDateKey(day)
          const total = dailyTotals[dateKey] ?? 0

          return {
            date: day,
            dateKey,
            total,
            isSelected: dateKey === todayDateKey,
          }
        })
        .filter((day) => day.total > 0),
    [dailyTotals, periodDays, todayDateKey],
  )
  const calendarEntryRecords = useMemo(() => {
    if (!calendarEntryDateKey) {
      return []
    }

    return records
      .filter((record) => record.dateKey === calendarEntryDateKey)
      .sort((first, second) => {
        return new Date(second.createdAt) - new Date(first.createdAt)
      })
  }, [calendarEntryDateKey, records])
  const otherPeriodSummaries = useMemo(() => {
    const summaries = records.reduce((groups, record) => {
      const recordPeriod = getBillingPeriod(
        fromDateKey(record.dateKey),
        startDay,
        endDay,
      )
      const key = toDateKey(recordPeriod.start)

      if (key === periodKey) {
        return groups
      }

      const current = groups[key] ?? {
        key,
        start: recordPeriod.start,
        displayEnd: recordPeriod.displayEnd,
        total: 0,
      }

      groups[key] = {
        ...current,
        total: current.total + record.amount,
      }

      return groups
    }, {})

    return Object.values(summaries).sort((first, second) => {
      return second.start.getTime() - first.start.getTime()
    })
  }, [endDay, periodKey, records, startDay])

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(records))
  }, [records])

  useEffect(() => {
    localStorage.setItem(startDayKey, String(startDay))
  }, [startDay])

  useEffect(() => {
    localStorage.setItem(endDayKey, String(endDay))
  }, [endDay])

  useEffect(() => {
    function closePopoversOnOutsideClick(event) {
      if (!datePickerRef.current?.contains(event.target)) {
        setIsCalendarOpen(false)
        setCalendarEntryDateKey(null)
        setIsCalendarEntryFormOpen(false)
        setCalendarEntryAmount('')
      }

      if (!otherPeriodsRef.current?.contains(event.target)) {
        setIsOtherPeriodsOpen(false)
      }
    }

    document.addEventListener('pointerdown', closePopoversOnOutsideClick)

    return () => {
      document.removeEventListener('pointerdown', closePopoversOnOutsideClick)
    }
  }, [])

  function changeVisibleMonth(direction) {
    const nextDate = moveMonth(selectedDate, direction)
    setSelectedDateKey(toDateKey(nextDate))
    setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1))
  }

  function selectDate(date) {
    const dateKey = toDateKey(date)

    setSelectedDateKey(dateKey)
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setCalendarEntryDateKey(dateKey)
    setIsCalendarEntryFormOpen(false)
    setCalendarEntryAmount('')
  }

  function addRecord(
    name,
    amount,
    icon = getDefaultIcon(name),
    dateKey = todayDateKey,
  ) {
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
        dateKey,
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

  function submitCalendarEntry(event) {
    event.preventDefault()

    if (!calendarEntryDateKey) {
      return
    }

    const entry = calendarEntryOptions.find(
      (option) => option.name === calendarEntryName,
    )

    addRecord(
      calendarEntryName,
      calendarEntryAmount,
      entry?.icon ?? getDefaultIcon(calendarEntryName),
      calendarEntryDateKey,
    )
    setCalendarEntryAmount('')
    setIsCalendarEntryFormOpen(false)
  }

  function removeCalendarRecord(id) {
    setRecords((current) => current.filter((record) => record.id !== id))
  }

  function updateItemAmount(item, amount) {
    const expense = Number(amount)

    if (Number.isNaN(expense) || expense < 0) {
      return
    }

    setRecords((current) => {
      const others = current.filter(
        (record) =>
          record.dateKey !== todayDateKey ||
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
          dateKey: todayDateKey,
          createdAt: new Date().toISOString(),
        },
      ]
    })
  }

  function removeItem(item) {
    setRecords((current) =>
      current.filter(
        (record) =>
          record.dateKey !== todayDateKey ||
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
        <div className="header-actions">
          <div className="total-box">
            <span>本期總結</span>
            <strong>{formatMoney(periodTotal)}</strong>
          </div>

          <div className="header-icon-row">
            <div className="date-picker" ref={otherPeriodsRef}>
              <button
                aria-expanded={isOtherPeriodsOpen}
                aria-label="其他期別總結"
                className="calendar-toggle"
                type="button"
                onClick={() => setIsOtherPeriodsOpen((isOpen) => !isOpen)}
              >
                <span aria-hidden="true">📊</span>
              </button>

              {isOtherPeriodsOpen ? (
                <section
                  className="other-periods-popover"
                  aria-label="其他期別總結"
                >
                  <div className="popover-heading">
                    <h2>其他期別總結</h2>
                  </div>

                  {otherPeriodSummaries.length === 0 ? (
                    <p className="empty-state">還沒有其他期別記帳</p>
                  ) : (
                    <ul className="period-summary-list">
                      {otherPeriodSummaries.map((summary) => (
                        <li key={summary.key}>
                          <span>
                            {formatShortDate(summary.start)} -{' '}
                            {formatShortDate(summary.displayEnd)}
                          </span>
                          <strong>{formatMoney(summary.total)}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}
            </div>

            <div className="date-picker" ref={datePickerRef}>
              <button
                aria-expanded={isCalendarOpen}
                aria-label="選擇日期"
                className="calendar-toggle"
                type="button"
                onClick={() => setIsCalendarOpen((isOpen) => !isOpen)}
              >
                <span aria-hidden="true">📅</span>
              </button>

              {isCalendarOpen ? (
                <section className="calendar-popover" aria-label="月曆">
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
                        {formatShortDate(selectedDate)} 花費{' '}
                        {formatMoney(selectedTotal)}
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
                        <span
                          className="calendar-spacer"
                          key={`spacer-${index}`}
                        />
                      ),
                    )}
                    {visibleMonthDays.map((day) => {
                      const dateKey = toDateKey(day)
                      const total = dailyTotals[dateKey] ?? 0
                      const isSelected = dateKey === selectedDateKey
                      const isToday = dateKey === todayDateKey

                      return (
                        <div
                          className={`calendar-day${
                            isToday ? ' is-today' : ''
                          }${isSelected ? ' is-selected' : ''}`}
                          key={dateKey}
                        >
                          <button
                            aria-label={`新增 ${formatShortDate(day)} 金額`}
                            className="calendar-date-button"
                            type="button"
                            onClick={() => selectDate(day)}
                          >
                            <span>{day.getDate()}</span>
                            <strong>
                              {total > 0 ? formatMoney(total) : '-'}
                            </strong>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  {calendarEntryDateKey ? (
                    <div className="calendar-edit-panel">
                      <span>
                        {formatShortDate(fromDateKey(calendarEntryDateKey))}
                      </span>
                      {!isCalendarEntryFormOpen ? (
                        <button
                          className="calendar-add-button"
                          type="button"
                          onClick={() => setIsCalendarEntryFormOpen(true)}
                        >
                          新增
                        </button>
                      ) : (
                        <form
                          className="calendar-entry-form"
                          onSubmit={submitCalendarEntry}
                        >
                          <select
                            aria-label="新增項目"
                            value={calendarEntryName}
                            onChange={(event) =>
                              setCalendarEntryName(event.target.value)
                            }
                          >
                            {calendarEntryOptions.map((option) => (
                              <option key={option.name} value={option.name}>
                                {option.icon} {option.name}
                              </option>
                            ))}
                          </select>
                          <input
                            aria-label="新增金額"
                            inputMode="numeric"
                            min="0"
                            placeholder="金額"
                            type="number"
                            value={calendarEntryAmount}
                            onChange={(event) =>
                              setCalendarEntryAmount(event.target.value)
                            }
                          />
                          <button type="submit">確定</button>
                        </form>
                      )}
                      <div className="calendar-detail-panel">
                        <div className="calendar-detail-heading">
                          <strong>明細</strong>
                          <span>{calendarEntryRecords.length} 筆</span>
                        </div>

                        {calendarEntryRecords.length === 0 ? (
                          <p className="calendar-detail-empty">
                            這一天還沒有明細
                          </p>
                        ) : (
                          <ul className="calendar-detail-list">
                            {calendarEntryRecords.map((record) => (
                              <li key={record.id}>
                                <div>
                                  <span className="item-icon" aria-hidden="true">
                                    {record.icon}
                                  </span>
                                  <span>{record.name}</span>
                                </div>
                                <strong>{formatMoney(record.amount)}</strong>
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeCalendarRecord(record.id)
                                  }
                                >
                                  移除
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          </div>
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
          <h2>{formatShortDate(today)} 明細</h2>
          <span>{todayItems.length} 個項目</span>
        </div>

        {todayItems.length === 0 ? (
          <p className="empty-state">這一天還沒有花費</p>
        ) : (
          <ul className="records-list">
            {todayItems.map((item) => (
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
          <strong>{formatMoney(todayTotal)}</strong>
        </div>
      </section>

      <section className="period-daily-panel" aria-label="當期每日總結">
        <div className="records-heading">
          <h2>當期每日總結</h2>
          <span>
            {formatShortDate(period.start)} - {formatShortDate(period.displayEnd)}
          </span>
        </div>

        {periodDailySummaries.length === 0 ? (
          <p className="empty-state">本期還沒有記帳</p>
        ) : (
          <ul className="daily-summary-list">
            {periodDailySummaries.map((day) => (
              <li
                className={day.isSelected ? 'is-selected' : ''}
                key={day.dateKey}
              >
                <span>{formatShortDate(day.date)}</span>
                <strong>{formatMoney(day.total)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default App
