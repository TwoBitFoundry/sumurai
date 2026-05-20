import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, within } from 'storybook/test';
import type { CsvColumnMapping, ImportResponse, ValidateResponse } from '@/models/import';
import type { UseImportTransactionsResult } from '../hooks/useImportTransactions';
import { ImportModalView } from './ImportModal';

const account = {
  id: 'account-1',
  name: 'Everyday Checking',
  mask: '1234',
};

const completeMapping: CsvColumnMapping = {
  date_column: 'Date',
  amount_column: null,
  debit_column: 'Debit Amount',
  credit_column: 'Credit Amount',
  description_column: 'Description',
};

const incompleteMapping: CsvColumnMapping = {
  date_column: null,
  amount_column: null,
  debit_column: null,
  credit_column: null,
  description_column: 'Description',
};

const csvValidation: ValidateResponse = {
  valid: true,
  format: 'Csv',
  transaction_count: 6,
  truncated_count: 1,
  date_range: {
    start_date: '2026-01-01',
    end_date: '2026-01-06',
  },
  preview_rows: [
    { date: '2026-01-01', description: 'Coffee Shop', amount: '-4.75' },
    { date: '2026-01-02', description: 'Payroll', amount: '2500.00' },
    { date: '2026-01-03', description: 'Neighborhood Grocery', amount: '-72.41' },
  ],
  suggested_csv_mapping: completeMapping,
  csv_headers: ['Date', 'Description', 'Debit Amount', 'Credit Amount'],
  sample_csv_rows: [
    ['Date', 'Description', 'Debit Amount', 'Credit Amount'],
    ['2026-01-01', 'Coffee Shop', '4.75', ''],
  ],
  errors: [],
};

const qboValidation: ValidateResponse = {
  ...csvValidation,
  format: 'Qbo',
  suggested_csv_mapping: null,
  csv_headers: [],
  sample_csv_rows: [],
  transaction_count: 4,
  truncated_count: 0,
  preview_rows: [
    { date: '2026-02-01', description: 'Bookstore', amount: '-31.99' },
    { date: '2026-02-02', description: 'Dividend Payment', amount: '12.42' },
  ],
};

const importResult: ImportResponse = {
  imported_count: 4,
  skipped_count: 2,
  truncated_count: 1,
  total_parsed: 7,
  errors: ['Row 7 was skipped because the date was invalid.'],
};

type ImportModalStoryArgs = {
  workflow: UseImportTransactionsResult;
  width: number;
};

function makeWorkflow(
  overrides: Partial<UseImportTransactionsResult> = {}
): UseImportTransactionsResult {
  return {
    status: 'idle',
    selectedFile: null,
    validationResult: null,
    importResult: null,
    csvMapping: null,
    error: null,
    validateFile: fn(async () => csvValidation),
    importFile: fn(async () => importResult),
    setCsvMapping: fn(),
    reset: fn(),
    backToPreview: fn(),
    ...overrides,
  };
}

function makeFile(name: string): File {
  if (typeof File === 'undefined') {
    return { name } as File;
  }
  return new File(['content'], name);
}

function firstVisibleText(container: ReturnType<typeof within>, text: string | RegExp) {
  const matches = container.getAllByText(text);
  const visible = matches.find((node) => {
    const style = window.getComputedStyle(node);
    return (
      style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0
    );
  });
  if (!visible) {
    throw new Error(`No visible match for text: ${String(text)}`);
  }
  return visible;
}

function StoryShell({ workflow, width }: ImportModalStoryArgs) {
  return (
    <div style={{ minHeight: 760, width, maxWidth: '100%' }}>
      <ImportModalView
        account={account}
        isOpen
        onClose={fn()}
        onImportSuccess={fn()}
        workflow={workflow}
      />
    </div>
  );
}

const meta = {
  title: 'Features/Import/ImportModal',
  component: StoryShell,
  tags: ['autodocs', 'test'],
  args: {
    width: 1024,
    workflow: makeWorkflow(),
  },
  render: (args) => <StoryShell {...args} />,
} satisfies Meta<ImportModalStoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Upload: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText(/choose file or drop it here/i)).toBeVisible();
    await expect(body.getByText('CSV')).toBeVisible();
    await expect(body.getByText('OFX')).toBeVisible();
    await expect(body.getByText('QBO')).toBeVisible();
    await expect(body.getByText('QFX')).toBeVisible();
    await expect(body.getByText('QBX')).toBeVisible();
    await expect(body.getByText(/csv must include a header row/i)).toBeVisible();
    await expect(body.getByText(/up to 10 mb per file/i)).toBeVisible();
  },
};

export const Validating: Story = {
  args: {
    workflow: makeWorkflow({
      status: 'validating',
      selectedFile: makeFile('checking.csv'),
    }),
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText(/validating checking.csv/i)).toBeVisible();
    await expect(body.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  },
};

export const OfxPreview: Story = {
  args: {
    workflow: makeWorkflow({
      status: 'preview',
      selectedFile: makeFile('statement.qbo'),
      validationResult: qboValidation,
    }),
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('QBO')).toBeVisible();
    await expect(firstVisibleText(body, 'Bookstore')).toBeVisible();
    await expect(body.getByRole('button', { name: /^import$/i })).toBeEnabled();
  },
};

export const CsvPreview: Story = {
  args: {
    workflow: makeWorkflow({
      status: 'preview',
      selectedFile: makeFile('checking.csv'),
      validationResult: csvValidation,
      csvMapping: completeMapping,
    }),
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('button', { name: /expand column mapping/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  },
};

export const CsvNeedsMapping: Story = {
  args: {
    workflow: makeWorkflow({
      status: 'preview',
      selectedFile: makeFile('checking.csv'),
      validationResult: { ...csvValidation, suggested_csv_mapping: incompleteMapping },
      csvMapping: incompleteMapping,
    }),
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByRole('button', { name: /^import$/i })).toBeDisabled();
  },
};

export const Importing: Story = {
  args: {
    workflow: makeWorkflow({
      status: 'importing',
      selectedFile: makeFile('checking.csv'),
      validationResult: csvValidation,
      csvMapping: completeMapping,
    }),
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('Importing transactions')).toBeVisible();
    await expect(body.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  },
};

export const Success: Story = {
  args: {
    workflow: makeWorkflow({
      status: 'success',
      selectedFile: makeFile('checking.csv'),
      validationResult: csvValidation,
      importResult,
    }),
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('Import complete')).toBeVisible();
    await expect(body.getByText('4 imported')).toBeVisible();
    await expect(body.getByRole('button', { name: /^done$/i })).toBeVisible();
  },
};

export const ValidationError: Story = {
  args: {
    workflow: makeWorkflow({
      status: 'validation-error',
      selectedFile: makeFile('bad.csv'),
      error: 'This file is not a supported CSV, QBO, or QFX export.',
    }),
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('Validation failed')).toBeVisible();
    await expect(body.getByRole('button', { name: /try another file/i })).toBeVisible();
  },
};

export const ImportError: Story = {
  args: {
    workflow: makeWorkflow({
      status: 'error',
      selectedFile: makeFile('checking.csv'),
      validationResult: csvValidation,
      csvMapping: completeMapping,
      error: 'The import could not be saved.',
    }),
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(body.getByText('Import failed')).toBeVisible();
    await expect(body.getByRole('button', { name: /try again/i })).toBeVisible();
  },
};

export const Mobile: Story = {
  args: {
    width: 360,
    workflow: makeWorkflow({
      status: 'preview',
      selectedFile: makeFile('checking.csv'),
      validationResult: csvValidation,
      csvMapping: completeMapping,
    }),
  },
};

export const Tablet: Story = {
  args: {
    width: 834,
    workflow: makeWorkflow({
      status: 'preview',
      selectedFile: makeFile('checking.csv'),
      validationResult: csvValidation,
      csvMapping: completeMapping,
    }),
  },
};

export const Desktop: Story = {
  args: {
    width: 1280,
    workflow: makeWorkflow({
      status: 'preview',
      selectedFile: makeFile('checking.csv'),
      validationResult: csvValidation,
      csvMapping: completeMapping,
    }),
  },
};

export const ConstrainedPwa: Story = {
  args: {
    width: 520,
    workflow: makeWorkflow({
      status: 'success',
      selectedFile: makeFile('checking.csv'),
      validationResult: csvValidation,
      importResult,
    }),
  },
};
