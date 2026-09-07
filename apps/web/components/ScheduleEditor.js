'use client';

import { useEffect, useState } from 'react';
import { Input, Label, Select, FieldError } from '@/components/ui/Input';

const DAYS = [
  ['0', 'Sunday'],
  ['1', 'Monday'],
  ['2', 'Tuesday'],
  ['3', 'Wednesday'],
  ['4', 'Thursday'],
  ['5', 'Friday'],
  ['6', 'Saturday'],
];

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

// Best-effort: recognize the two shapes this editor itself generates so
// re-opening an automation shows friendly controls instead of falling back
// to "Custom" for schedules it created.
function parseCronToFriendly(cronExpr) {
  if (!cronExpr) return null;
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minute, hour, dom, mon, dow] = parts;
  if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour) || dom !== '*' || mon !== '*') return null;
  const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  if (dow === '*') return { frequency: 'daily', time, dayOfWeek: '1' };
  if (/^\d+$/.test(dow)) return { frequency: 'weekly', time, dayOfWeek: dow };
  return null;
}

function buildCron({ frequency, time, dayOfWeek }) {
  const [hour, minute] = (time || '09:00').split(':').map((n) => Number(n));
  if (frequency === 'weekly') return `${minute} ${hour} * * ${dayOfWeek}`;
  return `${minute} ${hour} * * *`;
}

export function describeSchedule(schedule) {
  if (!schedule || schedule.mode !== 'cron' || !schedule.cron) return 'Manual only';
  const friendly = parseCronToFriendly(schedule.cron);
  const tz = schedule.timezone ? ` (${schedule.timezone})` : '';
  if (!friendly) return `Custom · ${schedule.cron}${tz}`;
  if (friendly.frequency === 'daily') return `Daily at ${friendly.time}${tz}`;
  const dayLabel = DAYS.find(([v]) => v === friendly.dayOfWeek)?.[1] || friendly.dayOfWeek;
  return `Weekly on ${dayLabel}s at ${friendly.time}${tz}`;
}

/**
 * Controlled editor for Automation.schedule ({mode, cron, timezone}).
 * Emits the same shape it's given - callers PATCH it straight through, no
 * schema change needed since this matches the existing scheduleSchema.
 */
export function ScheduleEditor({ value, onChange }) {
  const friendly = parseCronToFriendly(value?.cron) || { frequency: 'daily', time: '09:00', dayOfWeek: '1' };
  const [frequency, setFrequency] = useState(friendly.frequency);
  const [time, setTime] = useState(friendly.time);
  const [dayOfWeek, setDayOfWeek] = useState(friendly.dayOfWeek);
  const [customCron, setCustomCron] = useState(value?.mode === 'cron' && !parseCronToFriendly(value?.cron) ? value.cron : '');
  const isCustom = value?.mode === 'cron' && !!customCron;

  function emit(next) {
    onChange({ ...value, ...next });
  }

  function setMode(mode) {
    if (mode === 'manual') {
      emit({ mode: 'manual', cron: null, timezone: null });
      return;
    }
    emit({ mode: 'cron', cron: isCustom ? customCron : buildCron({ frequency, time, dayOfWeek }), timezone: browserTimezone() });
  }

  function updateFriendly(next) {
    const merged = { frequency, time, dayOfWeek, ...next };
    setFrequency(merged.frequency);
    setTime(merged.time);
    setDayOfWeek(merged.dayOfWeek);
    setCustomCron('');
    emit({ mode: 'cron', cron: buildCron(merged), timezone: browserTimezone() });
  }

  function updateCustom(cronExpr) {
    setCustomCron(cronExpr);
    emit({ mode: 'cron', cron: cronExpr, timezone: browserTimezone() });
  }

  useEffect(() => {
    // Keep local friendly-field state in sync if the parent resets `value`
    // (e.g. loading a different automation into the same mounted editor).
    const parsed = parseCronToFriendly(value?.cron);
    if (parsed) {
      setFrequency(parsed.frequency);
      setTime(parsed.time);
      setDayOfWeek(parsed.dayOfWeek);
      setCustomCron('');
    } else if (value?.mode === 'cron' && value?.cron) {
      setCustomCron(value.cron);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.cron]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="radio" name="scheduleMode" checked={value?.mode !== 'cron'} onChange={() => setMode('manual')} />
          Send manually only — you click &ldquo;Run now&rdquo; each time
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="radio" name="scheduleMode" checked={value?.mode === 'cron'} onChange={() => setMode('cron')} />
          Send automatically on a schedule
        </label>
      </div>

      {value?.mode === 'cron' ? (
        <div className="space-y-3 border-l-2 border-line pl-4">
          <div>
            <Label htmlFor="frequency">Frequency</Label>
            <Select
              id="frequency"
              value={isCustom ? 'custom' : frequency}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setCustomCron(value?.cron || '0 9 * * *');
                  emit({ mode: 'cron', cron: value?.cron || '0 9 * * *', timezone: browserTimezone() });
                } else {
                  updateFriendly({ frequency: e.target.value });
                }
              }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="custom">Custom (advanced)</option>
            </Select>
          </div>

          {!isCustom ? (
            <div className="grid grid-cols-2 gap-3">
              {frequency === 'weekly' ? (
                <div>
                  <Label htmlFor="dayOfWeek">Day</Label>
                  <Select id="dayOfWeek" value={dayOfWeek} onChange={(e) => updateFriendly({ dayOfWeek: e.target.value })}>
                    {DAYS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
              <div>
                <Label htmlFor="time">Time</Label>
                <Input id="time" type="time" value={time} onChange={(e) => updateFriendly({ time: e.target.value })} />
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="customCron">Cron expression</Label>
              <Input
                id="customCron"
                value={customCron}
                onChange={(e) => updateCustom(e.target.value)}
                placeholder="0 9 * * *"
                className="font-mono"
              />
              <FieldError>{customCron && !/^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/.test(customCron) ? 'Must be a 5-field cron expression.' : ''}</FieldError>
            </div>
          )}

          <p className="text-xs text-slate">
            {describeSchedule(value)}
            {value?.timezone ? '' : ' · times use the server\'s local timezone'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
