// 웨이포인트 통과 기록 입력 (탭 한 번 + 숫자 키패드). 아이폰: 아래에서 올라오는 시트 / 넓은 화면: 가운데 창
import { useEffect, useRef, useState } from 'react';
import { fmtKg, fmtSigned } from '../../lib/format';
import { formatZ } from '../../lib/time';
import type { MassUnit, OfpWaypoint } from '../ofp/types';
import { nowHHMM, parseAta, parseFuelInput, type Actual } from './deviation';

interface Props {
  w: OfpWaypoint;
  unit: MassUnit;
  revisedEto: string;
  existing?: Actual;
  onSave: (ata: string, fuel: number | null) => Promise<void>;
  onVoid?: () => Promise<void>;
  onClose: () => void;
}

const hhmmOf = (iso: string) => formatZ(iso).replace('Z', '');

export function EntrySheet({ w, unit, revisedEto, existing, onSave, onVoid, onClose }: Props) {
  const [ata, setAta] = useState(existing ? hhmmOf(existing.ata) : nowHHMM());
  const [fuel, setFuel] = useState(existing?.fuel != null ? String(existing.fuel) : '');
  const [busy, setBusy] = useState(false);
  const fuelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fuelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ataIso = parseAta(ata, w.eto);
  const f = parseFuelInput(fuel, w.fuelRem, unit);
  const dt = ataIso ? Math.round((Date.parse(ataIso) - Date.parse(w.eto)) / 60000) : null;
  const df = f ? f.value - w.fuelRem : null;
  const valid = !!ataIso && (fuel.trim() === '' || !!f);

  const shift = (min: number) => {
    const base = ataIso ? Date.parse(ataIso) : Date.now();
    setAta(hhmmOf(new Date(base + min * 60000).toISOString()));
  };

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onSave(ataIso!, f ? f.value : null);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop sheetish" role="dialog" aria-modal="true" aria-label={`${w.name} 통과 기록`} onClick={onClose}>
      <form
        className="modal entry"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="entry-head">
          <div>
            <div className="mono flt-no small-no">{w.name}</div>
            <div className="muted small mono">
              {w.fullName && w.fullName !== w.name ? `${w.fullName} · ` : ''}
              {w.flText && !/^\d+$/.test(w.flText) ? w.flText : `FL${w.fl}`}
            </div>
          </div>
          <div className="entry-plan mono">
            <span className="cell-k">PLAN</span>
            <div>
              ETO {formatZ(w.eto)}
              {revisedEto !== w.eto && <span className="muted"> → {formatZ(revisedEto)}</span>}
            </div>
            <div>
              R/F {fmtKg(w.fuelRem)} {unit.toUpperCase()}
            </div>
          </div>
        </div>

        <label className="label" htmlFor="ata">
          ATA (UTC HHMM)
        </label>
        <div className="entry-row">
          <input id="ata" className="input big-input mono" inputMode="numeric" autoComplete="off" maxLength={5} value={ata} onChange={(e) => setAta(e.target.value)} />
          <button type="button" className="btn" onClick={() => shift(-1)} aria-label="1분 빼기">
            −1
          </button>
          <button type="button" className="btn" onClick={() => shift(1)} aria-label="1분 더하기">
            +1
          </button>
          <button type="button" className="btn" onClick={() => setAta(nowHHMM())}>
            지금
          </button>
        </div>
        <div className={`small mono ${dt != null && Math.abs(dt) >= 5 ? 'c-caution' : 'muted'}`}>{ataIso ? `ΔT ${dt! >= 0 ? '+' : '−'}${Math.abs(dt!)} min` : '시각 형식: 0533'}</div>

        <label className="label" htmlFor="fuel">
          FUEL REMAINING ({unit.toUpperCase()})
        </label>
        <div className="entry-row">
          <input
            id="fuel"
            ref={fuelRef}
            className="input big-input mono"
            inputMode="numeric"
            autoComplete="off"
            placeholder={unit === 'lbs' ? `${fmtKg(w.fuelRem)} 또는 ${Math.round(w.fuelRem / 100)}` : fmtKg(w.fuelRem)}
            value={fuel}
            onChange={(e) => setFuel(e.target.value)}
          />
          <button type="button" className="btn" onClick={() => setFuel(String(w.fuelRem))}>
            계획값
          </button>
        </div>
        <div className={`small mono ${df != null && df < 0 ? 'c-caution' : 'muted'}`}>
          {f ? `= ${fmtKg(f.value)} ${unit.toUpperCase()}${f.scaled ? ' (100 단위 입력)' : ''} · ΔFUEL ${fmtSigned(df!)}` : fuel.trim() ? '숫자만 입력' : '비워두면 시각만 기록'}
        </div>

        <div className="row entry-actions">
          <button type="submit" className="btn primary" disabled={!valid || busy}>
            저장
          </button>
          <button type="button" className="btn" onClick={onClose}>
            닫기
          </button>
          {existing && onVoid && (
            <button
              type="button"
              className="btn danger"
              onClick={async () => {
                if (!confirm(`${w.name} 기록을 취소할까요?`)) return;
                await onVoid();
                onClose();
              }}
            >
              기록 취소
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
