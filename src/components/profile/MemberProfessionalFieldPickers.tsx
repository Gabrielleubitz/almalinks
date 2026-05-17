import React from 'react';
import MultiSelectField from '../form/MultiSelectField';
import {
  SPECIALTY_OPTIONS,
  INDUSTRY_OPTIONS,
  POSITION_OPTIONS,
  LOOKING_TO_GAIN_OPTIONS,
  parseMultiSelectValue,
  formatMultiSelectValue,
} from '../../constants/memberFieldOptions';

export interface MemberProfessionalFieldValues {
  specialty: string;
  industry: string;
  position: string;
  lookingToGain?: string;
}

interface MemberProfessionalFieldPickersProps {
  values: MemberProfessionalFieldValues;
  onChange: (field: keyof MemberProfessionalFieldValues, value: string) => void;
  disabled?: boolean;
  showLookingToGain?: boolean;
  errors?: Partial<Record<keyof MemberProfessionalFieldValues, string>>;
}

const MemberProfessionalFieldPickers: React.FC<MemberProfessionalFieldPickersProps> = ({
  values,
  onChange,
  disabled = false,
  showLookingToGain = false,
  errors = {},
}) => {
  const specialtyArr = parseMultiSelectValue(values.specialty);
  const industryArr = parseMultiSelectValue(values.industry);
  const positionArr = parseMultiSelectValue(values.position);
  const lookingArr = parseMultiSelectValue(values.lookingToGain);

  return (
    <div className="space-y-6">
      <MultiSelectField
        id="specialty"
        label="Specialty"
        options={SPECIALTY_OPTIONS}
        value={specialtyArr}
        onChange={(next) => onChange('specialty', formatMultiSelectValue(next))}
        required
        disabled={disabled}
        error={errors.specialty}
        helpText="Select all areas that apply."
      />
      <MultiSelectField
        id="industry"
        label="Industry"
        options={INDUSTRY_OPTIONS}
        value={industryArr}
        onChange={(next) => onChange('industry', formatMultiSelectValue(next))}
        required
        disabled={disabled}
        error={errors.industry}
        helpText="Select all industries that apply."
      />
      <MultiSelectField
        id="position"
        label="Position"
        options={POSITION_OPTIONS}
        value={positionArr}
        onChange={(next) => onChange('position', formatMultiSelectValue(next))}
        required
        disabled={disabled}
        error={errors.position}
        helpText="Select all roles that apply."
      />
      {showLookingToGain ? (
        <MultiSelectField
          id="lookingToGain"
          label="What are you looking to gain from AlmaLinks this year?"
          options={LOOKING_TO_GAIN_OPTIONS}
          value={lookingArr}
          onChange={(next) => onChange('lookingToGain', formatMultiSelectValue(next))}
          required
          disabled={disabled}
          error={errors.lookingToGain}
        />
      ) : null}
    </div>
  );
};

export default MemberProfessionalFieldPickers;
