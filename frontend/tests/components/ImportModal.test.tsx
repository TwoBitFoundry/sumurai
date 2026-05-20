import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportModalView } from '@/features/import/components/ImportModal';
import type { UseImportTransactionsResult } from '@/features/import/hooks/useImportTransactions';
import type { CsvColumnMapping, ImportResponse, ValidateResponse } from '@/models/import';
import { ThemeTestProvider } from '../utils/ThemeTestProvider';

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
  transaction_count: 3,
  truncated_count: 1,
  date_range: {
    start_date: '2026-01-01',
    end_date: '2026-01-03',
  },
  preview_rows: [
    {
      date: '2026-01-01',
      description: 'Coffee Shop With A Very Long Merchant Name',
      amount: '-4.75',
    },
    { date: '2026-01-02', description: 'Payroll', amount: '2500.00' },
  ],
  suggested_csv_mapping: completeMapping,
  sample_csv_rows: [
    ['Date', 'Description', 'Debit Amount', 'Credit Amount'],
    ['2026-01-01', 'Coffee Shop', '4.75', ''],
  ],
  errors: [],
};

const importResult: ImportResponse = {
  imported_count: 2,
  skipped_count: 1,
  truncated_count: 1,
  total_parsed: 4,
  errors: ['Row 4 was skipped because the amount was missing.'],
};

function workflow(
  overrides: Partial<UseImportTransactionsResult> = {}
): UseImportTransactionsResult {
  return {
    status: 'idle',
    selectedFile: null,
    validationResult: null,
    importResult: null,
    csvMapping: null,
    error: null,
    validateFile: jest.fn().mockResolvedValue(csvValidation),
    importFile: jest.fn().mockResolvedValue(importResult),
    setCsvMapping: jest.fn(),
    reset: jest.fn(),
    backToPreview: jest.fn(),
    ...overrides,
  };
}

function renderModal(activeWorkflow: UseImportTransactionsResult) {
  return render(
    <ThemeTestProvider>
      <ImportModalView
        account={{ id: 'account-1', name: 'Checking', mask: '1234' }}
        isOpen
        onClose={jest.fn()}
        onImportSuccess={jest.fn()}
        workflow={activeWorkflow}
      />
    </ThemeTestProvider>
  );
}

describe('ImportModal', () => {
  it('shows a tappable upload drop zone and validates selected and dropped files', async () => {
    const user = userEvent.setup();
    const activeWorkflow = workflow();
    renderModal(activeWorkflow);

    const file = new File(['date,description,amount'], 'bank.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText(/choose a csv, qbo, or qfx file/i), file);
    expect(activeWorkflow.validateFile).toHaveBeenCalledWith(file);

    const dropped = new File(['ofx'], 'statement.qbo', { type: 'application/octet-stream' });
    fireEvent.drop(screen.getByTestId('import-drop-zone'), {
      dataTransfer: { files: [dropped] },
    });
    expect(activeWorkflow.validateFile).toHaveBeenCalledWith(dropped);
  });

  it('prevents dismissal and hides footer actions while validating', () => {
    const onClose = jest.fn();
    const activeWorkflow = workflow({
      status: 'validating',
      selectedFile: new File(['content'], 'statement.qfx'),
    });

    render(
      <ThemeTestProvider>
        <ImportModalView
          account={{ id: 'account-1', name: 'Checking', mask: '1234' }}
          isOpen
          onClose={onClose}
          workflow={activeWorkflow}
        />
      </ThemeTestProvider>
    );

    expect(screen.getByText(/validating statement.qfx/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    fireEvent.pointerDown(screen.getByTestId('modal-backdrop'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows preview metadata, table rows, and keeps complete CSV mapping collapsed by default', () => {
    renderModal(
      workflow({
        status: 'preview',
        selectedFile: new File(['csv'], 'bank.csv'),
        validationResult: csvValidation,
        csvMapping: completeMapping,
      })
    );

    expect(screen.getByText('3 transactions')).toBeVisible();
    expect(screen.getByText('2026-01-01 to 2026-01-03')).toBeVisible();
    expect(screen.getAllByText('Csv')[0]).toBeVisible();
    expect(screen.getAllByText('••1234')[0]).toBeVisible();
    expect(screen.getByText('Ready to import')).toBeVisible();
    expect(screen.getByText('Coffee Shop With A Very Long Merchant Name')).toBeVisible();
    expect(screen.getByText('-$4.75')).toBeVisible();
    expect(screen.getByText('$2,500.00')).toBeVisible();
    expect(screen.getByRole('button', { name: /review column mapping/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('auto-expands incomplete CSV mapping and enforces required mapping rules', async () => {
    const user = userEvent.setup();
    const setCsvMapping = jest.fn();
    renderModal(
      workflow({
        status: 'preview',
        selectedFile: new File(['csv'], 'bank.csv'),
        validationResult: { ...csvValidation, suggested_csv_mapping: incompleteMapping },
        csvMapping: incompleteMapping,
        setCsvMapping,
      })
    );

    expect(screen.getByText('Choose columns to continue')).toBeVisible();
    expect(screen.getByRole('button', { name: /review column mapping/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('button', { name: /^import transactions$/i })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Date column'), 'Date');
    expect(setCsvMapping).toHaveBeenLastCalledWith({ ...incompleteMapping, date_column: 'Date' });

    await user.selectOptions(screen.getByLabelText('Amount column'), 'Debit Amount');
    expect(setCsvMapping).toHaveBeenLastCalledWith({
      ...incompleteMapping,
      amount_column: 'Debit Amount',
      debit_column: null,
      credit_column: null,
    });
  });

  it('shows distinct actionable validation and import errors', () => {
    renderModal(
      workflow({
        status: 'validation-error',
        selectedFile: new File(['bad'], 'bad.csv'),
        error: 'Unsupported file structure.',
      })
    );

    expect(screen.getByText('Validation failed')).toBeVisible();
    expect(screen.getByRole('button', { name: /try another file/i })).toBeVisible();

    renderModal(
      workflow({
        status: 'error',
        selectedFile: new File(['csv'], 'bank.csv'),
        validationResult: csvValidation,
        csvMapping: completeMapping,
        error: 'Import failed.',
      })
    );

    expect(screen.getByText('Import failed')).toBeVisible();
    expect(screen.getByRole('button', { name: /try again/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /choose another file/i })).toBeVisible();
  });

  it('shows success receipt counts and row warnings', () => {
    renderModal(
      workflow({
        status: 'success',
        selectedFile: new File(['csv'], 'bank.csv'),
        validationResult: csvValidation,
        importResult,
      })
    );

    expect(screen.getByText('Import complete')).toBeVisible();
    expect(screen.getByText('2 imported')).toBeVisible();
    expect(screen.getByText('1 skipped')).toBeVisible();
    expect(screen.getByText('1 truncated')).toBeVisible();
    expect(screen.getByText('1 row warning')).toBeVisible();
    expect(screen.getByText(importResult.errors[0])).toBeVisible();
  });
});
