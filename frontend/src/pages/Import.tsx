import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckCircle,
  Circle,
  Upload,
  Users,
  Calendar,
  Clock,
  DollarSign,
  PartyPopper,
  AlertCircle,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Types for import data
interface ImportPreview {
  caregivers: {
    total: number;
    new_count: number;
    existing_count: number;
    caregivers: Array<{ name: string; default_hourly_rate: string; exists: boolean }>;
  };
  time_entries: {
    total: number;
    date_range: { min: string | null; max: string | null };
  };
  expenses: {
    total: number;
    date_range: { min: string | null; max: string | null };
  };
  pay_periods: {
    existing_count: number;
    date_range: { min: string | null; max: string | null };
  };
}

interface CachedData {
  caregivers: Array<{ name: string; default_hourly_rate: string }>;
  time_entries: Array<Record<string, unknown>>;
  expenses: Array<Record<string, unknown>>;
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

interface GeneratedPeriod {
  id: number;
  start_date: string;
  end_date: string;
  status: string;
}

interface GeneratePeriodsResult {
  created: number;
  total: number;
  periods: GeneratedPeriod[];
}

const STEPS = [
  { id: 1, name: 'Upload File', icon: Upload },
  { id: 2, name: 'Import Caregivers', icon: Users },
  { id: 3, name: 'Generate Periods', icon: Calendar },
  { id: 4, name: 'Time Entries', icon: Clock },
  { id: 5, name: 'Expenses', icon: DollarSign },
  { id: 6, name: 'Complete', icon: PartyPopper },
];

function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function Import() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [cacheKey, setCacheKey] = useState<string | null>(null);
  const [cachedData, setCachedData] = useState<CachedData | null>(null);

  // Step 2: Caregivers result
  const [caregiversResult, setCaregiversResult] = useState<ImportResult | null>(null);

  // Step 3: Pay periods
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [periodEndDate, setPeriodEndDate] = useState('');
  const [generatedPeriods, setGeneratedPeriods] = useState<GeneratePeriodsResult | null>(null);

  // Step 4: Time entries result
  const [timeEntriesResult, setTimeEntriesResult] = useState<ImportResult | null>(null);

  // Step 5: Expenses result
  const [expensesResult, setExpensesResult] = useState<ImportResult | null>(null);

  // Step 1: Upload file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await axios.post<ImportPreview>(
        `${API_BASE}/api/import/upload`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      setPreview(response.data);

      // Set cache key and fetch cached data
      const key = `import_${selectedFile.name}`;
      setCacheKey(key);

      const cachedResponse = await axios.get<CachedData>(
        `${API_BASE}/api/import/cached/${key}`
      );
      setCachedData(cachedResponse.data);

      // Set default date range for pay periods
      const minDate = response.data.time_entries.date_range.min ||
                      response.data.expenses.date_range.min;
      const maxDate = response.data.time_entries.date_range.max ||
                      response.data.expenses.date_range.max;

      if (minDate) setPeriodStartDate(minDate);
      if (maxDate) setPeriodEndDate(maxDate);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Import caregivers
  const handleImportCaregivers = async () => {
    if (!cachedData) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post<ImportResult>(
        `${API_BASE}/api/import/caregivers`,
        { caregivers: cachedData.caregivers }
      );

      setCaregiversResult(response.data);
      setCurrentStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import caregivers');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Generate pay periods
  const handleGeneratePeriods = async () => {
    if (!periodStartDate || !periodEndDate) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post<GeneratePeriodsResult>(
        `${API_BASE}/api/import/generate-periods`,
        {
          start_date: periodStartDate,
          end_date: periodEndDate,
          period_length_days: 14,
        }
      );

      setGeneratedPeriods(response.data);
      setCurrentStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate pay periods');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: Import time entries
  const handleImportTimeEntries = async () => {
    if (!cachedData) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post<ImportResult>(
        `${API_BASE}/api/import/time-entries`,
        { entries: cachedData.time_entries }
      );

      setTimeEntriesResult(response.data);
      setCurrentStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import time entries');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 5: Import expenses
  const handleImportExpenses = async () => {
    if (!cachedData) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post<ImportResult>(
        `${API_BASE}/api/import/expenses`,
        { expenses: cachedData.expenses }
      );

      setExpensesResult(response.data);
      setCurrentStep(6);

      // Clear cache
      if (cacheKey) {
        await axios.delete(`${API_BASE}/api/import/cached/${cacheKey}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import expenses');
    } finally {
      setIsLoading(false);
    }
  };

  // Render step indicator
  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isComplete = currentStep > step.id;
        const isCurrent = currentStep === step.id;

        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isComplete
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isComplete ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <span
                className={`text-xs mt-1 ${
                  isCurrent ? 'font-medium' : 'text-muted-foreground'
                }`}
              >
                {step.name}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-12 mx-2 ${
                  currentStep > step.id ? 'bg-green-500' : 'bg-muted'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  // Step 1: Upload File
  const renderUploadStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Excel File
        </CardTitle>
        <CardDescription>
          Upload your Excel file (.xlsx) to preview the data before importing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file">Excel File</Label>
          <Input
            id="file"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
          />
        </div>

        <Button
          onClick={handleUpload}
          disabled={!selectedFile || isLoading}
        >
          {isLoading ? 'Uploading...' : 'Upload and Preview'}
        </Button>

        {preview && (
          <div className="mt-6 space-y-4">
            <h3 className="text-lg font-semibold">Preview</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Caregivers Found</CardDescription>
                  <CardTitle className="text-2xl">{preview.caregivers.total}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {preview.caregivers.new_count} new, {preview.caregivers.existing_count} existing
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Time Entries Found</CardDescription>
                  <CardTitle className="text-2xl">{preview.time_entries.total}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(preview.time_entries.date_range.min)} - {formatDate(preview.time_entries.date_range.max)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Expenses Found</CardDescription>
                  <CardTitle className="text-2xl">{preview.expenses.total}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(preview.expenses.date_range.min)} - {formatDate(preview.expenses.date_range.max)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Button onClick={() => setCurrentStep(2)}>
              Continue to Import Caregivers
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Step 2: Import Caregivers
  const renderCaregiversStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Import Caregivers
        </CardTitle>
        <CardDescription>
          Review caregivers to import. Existing caregivers will be skipped.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {preview && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Hourly Rate</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.caregivers.caregivers.map((caregiver, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{caregiver.name}</TableCell>
                  <TableCell>${caregiver.default_hourly_rate}</TableCell>
                  <TableCell>
                    {caregiver.exists ? (
                      <span className="text-yellow-600 flex items-center gap-1">
                        <Circle className="h-3 w-3 fill-yellow-600" />
                        Will be skipped
                      </span>
                    ) : (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Will be created
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!caregiversResult && (
          <Button onClick={handleImportCaregivers} disabled={isLoading}>
            {isLoading ? 'Importing...' : 'Import Caregivers'}
          </Button>
        )}

        {caregiversResult && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-green-800">Import Complete</h4>
              <p className="text-green-700">
                Created: {caregiversResult.created} | Skipped: {caregiversResult.skipped}
              </p>
              {caregiversResult.errors.length > 0 && (
                <p className="text-red-600 mt-2">
                  Errors: {caregiversResult.errors.join(', ')}
                </p>
              )}
            </div>
            <Button onClick={() => setCurrentStep(3)}>
              Continue to Generate Pay Periods
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Step 3: Generate Pay Periods
  const renderPeriodsStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Generate Pay Periods
        </CardTitle>
        <CardDescription>
          Generate bi-weekly pay periods for the import date range.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={periodStartDate}
              onChange={(e) => setPeriodStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={periodEndDate}
              onChange={(e) => setPeriodEndDate(e.target.value)}
            />
          </div>
        </div>

        {!generatedPeriods && (
          <Button
            onClick={handleGeneratePeriods}
            disabled={isLoading || !periodStartDate || !periodEndDate}
          >
            {isLoading ? 'Generating...' : 'Generate Bi-Weekly Periods'}
          </Button>
        )}

        {generatedPeriods && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-green-800">Periods Generated</h4>
              <p className="text-green-700">
                Created: {generatedPeriods.created} | Total: {generatedPeriods.total}
              </p>
            </div>

            {generatedPeriods.periods.length > 0 && (
              <div className="max-h-48 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generatedPeriods.periods.slice(0, 10).map((period) => (
                      <TableRow key={period.id}>
                        <TableCell>{formatDate(period.start_date)}</TableCell>
                        <TableCell>{formatDate(period.end_date)}</TableCell>
                        <TableCell>{period.status}</TableCell>
                      </TableRow>
                    ))}
                    {generatedPeriods.periods.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          ... and {generatedPeriods.periods.length - 10} more periods
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            <Button onClick={() => setCurrentStep(4)}>
              Continue to Import Time Entries
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Step 4: Import Time Entries
  const renderTimeEntriesStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Import Time Entries
        </CardTitle>
        <CardDescription>
          Import time entries from the Excel file.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-lg font-semibold">
            {preview?.time_entries.total || 0} time entries ready to import
          </p>
          <p className="text-sm text-muted-foreground">
            Date range: {formatDate(preview?.time_entries.date_range.min || null)} - {formatDate(preview?.time_entries.date_range.max || null)}
          </p>
        </div>

        {!timeEntriesResult && (
          <Button onClick={handleImportTimeEntries} disabled={isLoading}>
            {isLoading ? 'Importing...' : 'Import Time Entries'}
          </Button>
        )}

        {timeEntriesResult && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-green-800">Import Complete</h4>
              <p className="text-green-700">
                Created: {timeEntriesResult.created} | Skipped: {timeEntriesResult.skipped}
              </p>
              {timeEntriesResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-red-600 font-medium">Errors ({timeEntriesResult.errors.length}):</p>
                  <ul className="text-red-600 text-sm list-disc list-inside max-h-32 overflow-y-auto">
                    {timeEntriesResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {timeEntriesResult.errors.length > 5 && (
                      <li>... and {timeEntriesResult.errors.length - 5} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
            <Button onClick={() => setCurrentStep(5)}>
              Continue to Import Expenses
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Step 5: Import Expenses
  const renderExpensesStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Import Expenses
        </CardTitle>
        <CardDescription>
          Import expenses from the Excel file.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-lg font-semibold">
            {preview?.expenses.total || 0} expenses ready to import
          </p>
          <p className="text-sm text-muted-foreground">
            Date range: {formatDate(preview?.expenses.date_range.min || null)} - {formatDate(preview?.expenses.date_range.max || null)}
          </p>
        </div>

        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-yellow-800 font-medium">Note about dates</p>
            <p className="text-sm text-yellow-700">
              Expense dates may be estimated based on the pay period they were recorded in.
            </p>
          </div>
        </div>

        {!expensesResult && (
          <Button onClick={handleImportExpenses} disabled={isLoading}>
            {isLoading ? 'Importing...' : 'Import Expenses'}
          </Button>
        )}

        {expensesResult && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-green-800">Import Complete</h4>
              <p className="text-green-700">
                Created: {expensesResult.created} | Skipped: {expensesResult.skipped}
              </p>
              {expensesResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-red-600 font-medium">Errors ({expensesResult.errors.length}):</p>
                  <ul className="text-red-600 text-sm list-disc list-inside max-h-32 overflow-y-auto">
                    {expensesResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {expensesResult.errors.length > 5 && (
                      <li>... and {expensesResult.errors.length - 5} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
            <Button onClick={() => setCurrentStep(6)}>
              Complete Import
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Step 6: Complete
  const renderCompleteStep = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PartyPopper className="h-5 w-5 text-green-600" />
          Import Complete!
        </CardTitle>
        <CardDescription>
          Your data has been successfully imported.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Caregivers</CardDescription>
              <CardTitle className="text-xl text-green-600">
                {caregiversResult?.created || 0} created
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {caregiversResult?.skipped || 0} skipped
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pay Periods</CardDescription>
              <CardTitle className="text-xl text-green-600">
                {generatedPeriods?.created || 0} created
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {generatedPeriods?.total || 0} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Time Entries</CardDescription>
              <CardTitle className="text-xl text-green-600">
                {timeEntriesResult?.created || 0} created
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {timeEntriesResult?.errors.length || 0} errors
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Expenses</CardDescription>
              <CardTitle className="text-xl text-green-600">
                {expensesResult?.created || 0} created
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {expensesResult?.errors.length || 0} errors
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4">
          <Link to="/">
            <Button>Go to Dashboard</Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => {
              setCurrentStep(1);
              setSelectedFile(null);
              setPreview(null);
              setCacheKey(null);
              setCachedData(null);
              setCaregiversResult(null);
              setGeneratedPeriods(null);
              setTimeEntriesResult(null);
              setExpensesResult(null);
              setPeriodStartDate('');
              setPeriodEndDate('');
              setError(null);
            }}
          >
            Import Another File
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderUploadStep();
      case 2:
        return renderCaregiversStep();
      case 3:
        return renderPeriodsStep();
      case 4:
        return renderTimeEntriesStep();
      case 5:
        return renderExpensesStep();
      case 6:
        return renderCompleteStep();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Import Data</h1>
      </div>

      {renderStepIndicator()}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {renderStepContent()}
    </div>
  );
}

export default Import;
