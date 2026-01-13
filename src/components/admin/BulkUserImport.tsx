import React, { useState, useCallback } from 'react';
import { 
  Upload, 
  Download, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  X, 
  Eye,
  UserPlus,
  Users,
  Shuffle,
  Copy
} from 'lucide-react';
import { TempPasswordService } from '../../services/tempPasswordService';

interface BulkUserImportProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (results: any) => void;
  adminId: string;
}

interface CSVUser {
  email: string;
  name: string;
  role?: 'member' | 'admin';
  phone?: string;
  company?: string;
  work?: string;
  position?: string;
  linkedinUsername?: string;
}

interface ImportResults {
  total: number;
  successful: { rowIndex: number; uid: string; email: string; name: string; role: string; }[];
  failed: { rowIndex: number; email: string; name: string; error: string; }[];
  duplicates: { rowIndex: number; email: string; name: string; error: string; }[];
}

const BulkUserImport: React.FC<BulkUserImportProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  adminId 
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [csvData, setCsvData] = useState<CSVUser[]>([]);
  const [defaultTempPassword, setDefaultTempPassword] = useState('12345678');
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'review' | 'results'>('upload');
  
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({
    visible: false,
    message: '',
    type: 'success'
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
  };

  const downloadTemplate = () => {
    const template = 'email,name,role,phone,company,work,position,linkedinUsername\n' +
                   'john.doe@example.com,John Doe,member,+1-555-123-4567,ACME Corp,Software Engineer,Senior Developer,johndoe\n' +
                   'jane.smith@example.com,Jane Smith,admin,,Tech Startup,Product Manager,VP of Product,janesmith';
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Template downloaded successfully', 'success');
  };

  const parseCSV = (csvText: string): CSVUser[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) throw new Error('CSV must have at least a header row and one data row');
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const users: CSVUser[] = [];
    
    // Validate required headers
    if (!headers.includes('email') || !headers.includes('name')) {
      throw new Error('CSV must have at least "email" and "name" columns');
    }
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length !== headers.length) {
        throw new Error(`Row ${i + 1} has ${values.length} columns but expected ${headers.length}`);
      }
      
      const user: CSVUser = {
        email: '',
        name: ''
      };
      
      headers.forEach((header, index) => {
        const value = values[index];
        switch (header) {
          case 'email':
            user.email = value;
            break;
          case 'name':
            user.name = value;
            break;
          case 'role':
            if (value && ['member', 'admin', 'speaker'].includes(value.toLowerCase())) {
              user.role = value.toLowerCase() as 'member' | 'admin' | 'speaker';
            }
            break;
          case 'phone':
            if (value) user.phone = value;
            break;
          case 'company':
            if (value) user.company = value;
            break;
          case 'work':
            if (value) user.work = value;
            break;
          case 'position':
            if (value) user.position = value;
            break;
          case 'linkedinusername':
            if (value) user.linkedinUsername = value;
            break;
        }
      });
      
      // Validate required fields
      if (!user.email || !user.name) {
        throw new Error(`Row ${i + 1} is missing email or name`);
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(user.email)) {
        throw new Error(`Row ${i + 1} has invalid email format: ${user.email}`);
      }
      
      users.push(user);
    }
    
    return users;
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      showToast('Please select a CSV file', 'error');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const parsedUsers = parseCSV(csvText);
        setCsvData(parsedUsers);
        setCurrentStep('review');
        showToast(`${parsedUsers.length} users loaded successfully`, 'success');
      } catch (error: any) {
        showToast(`CSV parsing error: ${error.message}`, 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const generatePassword = () => {
    const newPassword = TempPasswordService.generateTempPassword();
    setDefaultTempPassword(newPassword);
    showToast('Secure password generated', 'success');
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText('12345678');
      showToast('Password copied to clipboard', 'success');
    } catch (error) {
      showToast('Failed to copy password', 'error');
    }
  };

  const handleImport = async () => {
    // Ensure password is always 12345678 for bulk imports
    const importPassword = '12345678';
    if (!importPassword || importPassword.length < 8) {
      showToast('Invalid password configuration', 'error');
      return;
    }

    setIsImporting(true);

    try {
      const response = await fetch('/api/user-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'bulk-import',
          adminId: adminId,
          users: csvData,
          defaultTempPassword: '12345678'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import users');
      }

      setImportResults(result.results);
      setCurrentStep('results');
      onSuccess(result.results);

    } catch (error: any) {
      console.error('❌ Error importing users:', error);
      showToast(error.message || 'Failed to import users', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const resetImport = () => {
    setCsvData([]);
    setDefaultTempPassword('12345678');
    setImportResults(null);
    setCurrentStep('upload');
  };

  const handleClose = () => {
    resetImport();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Toast Notification */}
        {toast.visible && (
          <div className="absolute top-6 right-6 z-60 animate-fade-in">
            <div 
              className={`flex items-center p-4 rounded-xl shadow-lg border ${
                toast.type === 'success' 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              )}
              <p 
                className={`mx-3 text-sm font-medium ${
                  toast.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}
              >
                {toast.message}
              </p>
              <button
                onClick={() => setToast(prev => ({ ...prev, visible: false }))}
                className={`p-1 rounded-full ${
                  toast.type === 'success' 
                    ? 'text-green-600 hover:bg-green-100' 
                    : 'text-red-600 hover:bg-red-100'
                }`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Users className="h-6 w-6 text-brand-light" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Bulk User Import</h2>
              <p className="text-sm text-gray-600">Import multiple users from CSV file</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Steps Indicator */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-center space-x-8">
            <div className={`flex items-center space-x-2 ${currentStep === 'upload' ? 'text-brand-light' : currentStep === 'review' || currentStep === 'results' ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep === 'upload' ? 'bg-blue-50' : currentStep === 'review' || currentStep === 'results' ? 'bg-green-100' : 'bg-gray-100'}`}>1</div>
              <span>Upload CSV</span>
            </div>
            <div className={`flex items-center space-x-2 ${currentStep === 'review' ? 'text-brand-light' : currentStep === 'results' ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep === 'review' ? 'bg-blue-50' : currentStep === 'results' ? 'bg-green-100' : 'bg-gray-100'}`}>2</div>
              <span>Review & Import</span>
            </div>
            <div className={`flex items-center space-x-2 ${currentStep === 'results' ? 'text-brand-light' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep === 'results' ? 'bg-blue-50' : 'bg-gray-100'}`}>3</div>
              <span>Results</span>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Step 1: Upload CSV */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              
              {/* Download Template */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <FileText className="h-5 w-5 text-brand-light mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-900">Need a template?</h4>
                    <p className="text-sm text-blue-700 mb-3">
                      Download our CSV template with sample data and required column headers.
                    </p>
                    <button
                      onClick={downloadTemplate}
                      className="inline-flex items-center px-3 py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-mid transition-colors text-sm font-medium"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Template
                    </button>
                  </div>
                </div>
              </div>

              {/* File Upload */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Drop CSV file here or click to browse
                </h3>
                <p className="text-gray-600 mb-4">
                  Upload a CSV file with user data. Maximum file size: 5MB
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Select CSV File
                </label>
              </div>

              {/* CSV Requirements */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-3">CSV Requirements:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <strong>Required columns:</strong> email, name</li>
                  <li>• <strong>Optional columns:</strong> role (member/admin), phone, company, work, position, linkedinUsername</li>
                  <li>• <strong>Format:</strong> First row must contain column headers</li>
                  <li>• <strong>Encoding:</strong> UTF-8 recommended</li>
                  <li>• <strong>Limit:</strong> Maximum 1000 users per import</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: Review & Import */}
          {currentStep === 'review' && (
            <div className="space-y-6">
              
              {/* Password Configuration */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <h4 className="font-semibold text-yellow-900 mb-3">Temporary Password</h4>
                <p className="text-sm text-yellow-700 mb-3">
                  All users will receive the password <strong>12345678</strong> and must change it on first login.
                </p>
                
                <div className="flex space-x-3 mb-3">
                  <div className="flex-1 relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value="12345678"
                      readOnly
                      className="w-full pr-20 pl-4 py-3 border border-yellow-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
                      placeholder="Temporary password for all users"
                    />
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-1">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <X className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={copyPassword}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Copy password"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg flex items-center space-x-2">
                    <span className="text-sm font-medium">Fixed Password</span>
                  </div>
                </div>
              </div>

              {/* Users Preview */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">
                  Users to Import ({csvData.length})
                </h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto max-h-96">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {csvData.map((user, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-500">{index + 1}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{user.email}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{user.name}</td>
                            <td className="px-4 py-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-800">
                                {user.role || 'member'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">{user.company || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <button
                  onClick={() => setCurrentStep('upload')}
                  className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
                >
                  Back to Upload
                </button>
                <button
                  onClick={handleImport}
                  disabled={isImporting || !defaultTempPassword || defaultTempPassword.length < 8}
                  className="flex-1 bg-brand-dark text-white px-6 py-3 rounded-xl hover:bg-brand-mid transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isImporting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Importing Users...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-5 w-5" />
                      <span>Import {csvData.length} Users</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {currentStep === 'results' && importResults && (
            <div className="space-y-6">
              
              {/* Summary Cards */}
              <div className="grid md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">{importResults.total}</div>
                  <div className="text-sm text-gray-600">Total Users</div>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{importResults.successful.length}</div>
                  <div className="text-sm text-green-700">Successful</div>
                </div>
                <div className="bg-yellow-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-600">{importResults.duplicates.length}</div>
                  <div className="text-sm text-yellow-700">Duplicates</div>
                </div>
                <div className="bg-red-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{importResults.failed.length}</div>
                  <div className="text-sm text-red-700">Failed</div>
                </div>
              </div>

              {/* Success List */}
              {importResults.successful.length > 0 && (
                <div>
                  <h4 className="font-semibold text-green-900 mb-3">
                    Successfully Created ({importResults.successful.length})
                  </h4>
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 max-h-48 overflow-y-auto">
                    {importResults.successful.map((user, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-green-200 last:border-b-0">
                        <div>
                          <div className="text-sm font-medium text-green-900">{user.name}</div>
                          <div className="text-xs text-green-700">{user.email}</div>
                        </div>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {user.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Duplicates List */}
              {importResults.duplicates.length > 0 && (
                <div>
                  <h4 className="font-semibold text-yellow-900 mb-3">
                    Duplicate Users Skipped ({importResults.duplicates.length})
                  </h4>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 max-h-48 overflow-y-auto">
                    {importResults.duplicates.map((user, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-yellow-200 last:border-b-0">
                        <div>
                          <div className="text-sm font-medium text-yellow-900">{user.name}</div>
                          <div className="text-xs text-yellow-700">{user.email}</div>
                        </div>
                        <div className="text-xs text-yellow-600">{user.error}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Failed List */}
              {importResults.failed.length > 0 && (
                <div>
                  <h4 className="font-semibold text-red-900 mb-3">
                    Failed Imports ({importResults.failed.length})
                  </h4>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 max-h-48 overflow-y-auto">
                    {importResults.failed.map((user, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b border-red-200 last:border-b-0">
                        <div>
                          <div className="text-sm font-medium text-red-900">{user.name}</div>
                          <div className="text-xs text-red-700">{user.email}</div>
                        </div>
                        <div className="text-xs text-red-600">{user.error}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <button
                  onClick={resetImport}
                  className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 transition-colors font-semibold"
                >
                  Import More Users
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 bg-brand-dark text-white px-6 py-3 rounded-xl hover:bg-brand-mid transition-colors font-semibold"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkUserImport;
export default BulkUserImport;