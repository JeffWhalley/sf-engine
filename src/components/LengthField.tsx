import { useCalcStore } from '../store/useCalcStore';
import { NumberField } from './NumberField';
import { lengthFromDisplay, lengthToDisplay, lengthUnit, type UnitSystem } from '../ui/format';

/**
 * Backlog — per-field unit selection. A length input whose in/mm suffix is
 * clickable: clicking flips JUST this field's display unit (stored per field
 * id in the calc store). Canonical value stays inches, always.
 */
export function LengthField({
  fieldId,
  value_in,
  onCommit_in,
  imperialDigits = 3,
  metricDigits = 2,
  minExclusive = 0,
}: {
  fieldId: string;
  value_in: number;
  onCommit_in: (v_in: number) => void;
  imperialDigits?: number;
  metricDigits?: number;
  minExclusive?: number;
}) {
  const globalSys = useCalcStore((s) => s.unitSystem);
  const override = useCalcStore((s) => s.fieldUnits[fieldId]);
  const setFieldUnit = useCalcStore((s) => s.setFieldUnit);
  const sys: UnitSystem = override ?? globalSys;

  return (
    <NumberField
      value={lengthToDisplay(value_in, sys)}
      unit={lengthUnit(sys)}
      digits={sys === 'metric' ? metricDigits : imperialDigits}
      step={sys === 'metric' ? 0.1 : 0.001}
      minExclusive={minExclusive}
      onCommit={(v) => onCommit_in(lengthFromDisplay(v, sys))}
      onUnitClick={() =>
        setFieldUnit(fieldId, sys === 'metric' ? 'imperial' : 'metric')
      }
    />
  );
}
