import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button, cn, Input, Select } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import { formatCategoryName } from '../../../utils/categories';

export interface BudgetFormValue {
  category: string;
  amount: string;
}

export function BudgetForm({
  categories,
  usedCategories,
  value,
  onChange,
  onSave,
  onCancel,
}: {
  categories: string[];
  usedCategories: Set<string>;
  value: BudgetFormValue;
  onChange: (v: BudgetFormValue) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={cn('flex', 'w-full', 'flex-col', 'gap-2')}>
      <Select
        data-testid="budget-category-select"
        value={value.category}
        onChange={(e) => onChange({ ...value, category: e.target.value })}
        variant="glass"
        selectSize="md"
        className={cn('w-full')}
      >
        <option value="" disabled>
          Select category
        </option>
        {categories.map((cat) => (
          <option key={cat} value={cat} disabled={usedCategories.has(cat)}>
            {formatCategoryName(cat)}
            {usedCategories.has(cat) ? ' (used)' : ''}
          </option>
        ))}
      </Select>
      <Input
        data-testid="budget-amount-input"
        type="number"
        min={0}
        step="0.01"
        placeholder="Amount"
        value={value.amount}
        onChange={(e) => onChange({ ...value, amount: e.target.value })}
        variant="glass"
        className={cn('w-full')}
      />
      <div className={cn('flex', 'w-full', 'justify-end', 'gap-2')}>
        <Button
          onClick={onCancel}
          variant="ghost"
          size="md"
          className={cn(appTitleBarRecipes.settingsIdle, 'normal-case')}
        >
          <XMarkIcon className={cn('h-4', 'w-4')} />
          Cancel
        </Button>
        <Button data-testid="budget-save" onClick={onSave} variant="primary">
          <CheckIcon className={cn('h-4', 'w-4')} />
          Save
        </Button>
      </div>
    </div>
  );
}

export default BudgetForm;
