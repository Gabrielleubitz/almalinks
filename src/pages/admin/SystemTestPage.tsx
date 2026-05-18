import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '../../components/ui/BackButton';
import { 
  ArrowLeft, 
  Mail, 
  Zap, 
  Check, 
  X, 
  AlertCircle, 
  Send, 
  RefreshCw,
  Cpu,
  Database,
  Globe,
  Server
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { auth } from '../../firebase/config';

interface TestResult {
  id: string;
  name: string;
  status: 'success' | 'error' | 'pending' | 'idle';
  message: string;
  timestamp: Date;
  duration?: number;
  details?: any;
}

const SystemTestPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [emailRecipient, setEmailRecipient] = useState('');
  const [lastEmailResponse, setLastEmailResponse] = useState<{
    provider: string;
    sentTo: string;
    ok: boolean;
    providerMessageId?: string;
    error?: string;
    timestamp: string;
  } | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });
  const [emailConfig, setEmailConfig] = useState<{ mailjet: boolean; mailchimp: boolean } | null>(null);
  const [runningTemplate, setRunningTemplate] = useState<string | null>(null);
  
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [runningTest, setRunningTest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const EMAIL_TEMPLATES: { key: string; label: string }[] = [
    { key: 'test', label: 'Test email' },
    { key: 'welcome', label: 'Welcome (signup received)' },
    { key: 'welcome-approved', label: 'Welcome approved' },
    { key: 'application-follow-up', label: 'Thank you for your application (intro / Zoom)' },
    { key: 'event-announcement', label: 'Event announcement' },
    { key: 'registration-confirmation', label: 'Registration confirmation' },
    { key: 'event-reminder', label: 'Event reminder' },
    { key: 'event-thank-you-attending', label: 'Thank you for attending (post-event + review link)' },
    { key: 'password-reset', label: 'Password reset' },
    { key: 'user-credentials', label: 'User credentials' },
  ];

  // Default recipient to logged-in admin email
  useEffect(() => {
    if (user?.email && !emailRecipient) {
      setEmailRecipient(user.email);
    }
  }, [user?.email]);

  // Load email provider config (admin-only endpoint)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch('/api/admin/test/email-config', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data?.ok && !cancelled) setEmailConfig({ mailjet: !!data.mailjet, mailchimp: !!data.mailchimp });
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);
  
  // Scroll to top synchronously before paint to prevent visible scroll jump
  useLayoutEffect(() => {
    // Capture scroll position before reset
    const scrollBefore = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
    
    // Reset all possible scroll positions (order matters for compatibility)
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
    
    // Verify scroll was reset
    const scrollAfter = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
    
    // Dev-only console log for verification
    if (process.env.NODE_ENV === 'development') {
      console.log('[SystemTestPage] Scroll reset:', {
        target: 'window',
        scrollBefore,
        scrollAfter,
        success: scrollAfter === 0,
        windowScrollY: window.scrollY,
        docElementScrollTop: document.documentElement.scrollTop,
        bodyScrollTop: document.body.scrollTop
      });
    }
  }, []);
  
  // Add a test result to the list
  const addTestResult = (result: TestResult) => {
    setTestResults(prev => [result, ...prev]);
  };
  
  // Update a test result
  const updateTestResult = (id: string, updates: Partial<TestResult>) => {
    setTestResults(prev => 
      prev.map(result => 
        result.id === id ? { ...result, ...updates } : result
      )
    );
  };
  
  const sendTestEmail = async (provider: 'mailjet' | 'mailchimp') => {
    const to = emailRecipient.trim().toLowerCase();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      addTestResult({
        id: `email-${Date.now()}`,
        name: `${provider === 'mailjet' ? 'Mailjet' : 'Mailchimp'} Test`,
        status: 'error',
        message: 'Please enter a valid recipient email',
        timestamp: new Date(),
      });
      return;
    }

    const testId = `${provider}-${Date.now()}`;
    const label = provider === 'mailjet' ? 'Mailjet Test Email' : 'Mailchimp Test Email';
    addTestResult({
      id: testId,
      name: label,
      status: 'pending',
      message: `Sending test email via ${provider}...`,
      timestamp: new Date(),
    });
    setRunningTest(provider);
    setLastEmailResponse(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        updateTestResult(testId, { status: 'error', message: 'Not authenticated' });
        setRunningTest(null);
        return;
      }
      const idToken = await currentUser.getIdToken();
      const url = provider === 'mailjet' ? '/api/admin/test/mailjet' : '/api/admin/test/mailchimp';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ to }),
      });
      const data = await response.json().catch(() => ({}));
      const duration = 0;

      const payload = {
        provider: data.provider ?? provider,
        sentTo: data.sentTo ?? to,
        ok: data.ok === true,
        providerMessageId: data.providerMessageId,
        error: data.error,
        timestamp: new Date().toISOString(),
      };
      setLastEmailResponse(payload);

      if (response.ok && data.ok) {
        updateTestResult(testId, {
          status: 'success',
          message: `Test email sent to ${data.sentTo}`,
          duration,
          details: payload,
        });
        setToast({ visible: true, message: `Test email sent to ${data.sentTo}`, type: 'success' });
        setTimeout(() => setToast((t) => ({ ...t, visible: false })), 4000);
      } else {
        const errMsg = data.error || response.statusText || 'Send failed';
        updateTestResult(testId, {
          status: 'error',
          message: errMsg,
          duration,
          details: payload,
        });
        setToast({ visible: true, message: errMsg, type: 'error' });
        setTimeout(() => setToast((t) => ({ ...t, visible: false })), 5000);
      }
    } catch (err: any) {
      const payload = {
        provider,
        sentTo: to,
        ok: false,
        error: err?.message || 'Request failed',
        timestamp: new Date().toISOString(),
      };
      setLastEmailResponse(payload);
      const errMsg = err?.message || 'Request failed';
      updateTestResult(testId, {
        status: 'error',
        message: errMsg,
        details: payload,
      });
      setToast({ visible: true, message: errMsg, type: 'error' });
      setTimeout(() => setToast((t) => ({ ...t, visible: false })), 5000);
    } finally {
      setRunningTest(null);
    }
  };

  const sendTemplateEmail = async (templateKey: string) => {
    const to = emailRecipient.trim().toLowerCase();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      setToast({ visible: true, message: 'Please enter a valid recipient email', type: 'error' });
      setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
      return;
    }
    const label = EMAIL_TEMPLATES.find((t) => t.key === templateKey)?.label ?? templateKey;
    setRunningTemplate(templateKey);
    setLastEmailResponse(null);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setToast({ visible: true, message: 'Not authenticated', type: 'error' });
        setRunningTemplate(null);
        return;
      }
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/admin/test/send-template-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ to, template: templateKey }),
      });
      const data = await response.json().catch(() => ({}));
      const payload = {
        provider: 'transactional',
        sentTo: data.sentTo ?? to,
        ok: data.ok === true,
        providerMessageId: data.messageId,
        error: data.error,
        timestamp: new Date().toISOString(),
      };
      setLastEmailResponse(payload);
      if (data.ok) {
        setToast({ visible: true, message: `${label} sent to ${data.sentTo}`, type: 'success' });
        setTimeout(() => setToast((t) => ({ ...t, visible: false })), 4000);
      } else {
        setToast({ visible: true, message: data.error || 'Send failed', type: 'error' });
        setTimeout(() => setToast((t) => ({ ...t, visible: false })), 5000);
      }
    } catch (err: any) {
      setLastEmailResponse({
        provider: 'transactional',
        sentTo: to,
        ok: false,
        error: err?.message || 'Request failed',
        timestamp: new Date().toISOString(),
      });
      setToast({ visible: true, message: err?.message || 'Request failed', type: 'error' });
      setTimeout(() => setToast((t) => ({ ...t, visible: false })), 5000);
    } finally {
      setRunningTemplate(null);
    }
  };
  
  // Test Firebase Connection
  const testFirebaseConnection = async () => {
    const testId = `firebase-${Date.now()}`;
    
    // Add initial test result
    addTestResult({
      id: testId,
      name: 'Firebase Connection',
      status: 'pending',
      message: 'Testing Firebase connection...',
      timestamp: new Date()
    });
    
    setRunningTest('firebase');
    const startTime = performance.now();
    
    try {
      // Check if we have a user object, which indicates Firebase Auth is working
      if (!user) {
        throw new Error('Not authenticated. Firebase Auth connection may be down.');
      }
      
      // For a more comprehensive test, you could try to read/write to Firestore
      // This would require implementing a specific test endpoint or function
      
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      updateTestResult(testId, {
        status: 'success',
        message: 'Firebase connection successful',
        duration,
        details: {
          auth: 'Connected',
          user: user.email
        }
      });
    } catch (error: any) {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      updateTestResult(testId, {
        status: 'error',
        message: `Error: ${error.message}`,
        duration,
        details: error
      });
    } finally {
      setRunningTest(null);
    }
  };
  
  // Test Network Connectivity
  const testNetworkConnectivity = async () => {
    const testId = `network-${Date.now()}`;
    
    // Add initial test result
    addTestResult({
      id: testId,
      name: 'Network Connectivity',
      status: 'pending',
      message: 'Testing network connectivity...',
      timestamp: new Date()
    });
    
    setRunningTest('network');
    const startTime = performance.now();
    
    try {
      // Make a simple fetch request to check connectivity
      const response = await fetch('https://www.google.com', { 
        mode: 'no-cors',
        cache: 'no-cache'
      });
      
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      updateTestResult(testId, {
        status: 'success',
        message: 'Network connectivity test successful',
        duration,
        details: {
          online: navigator.onLine,
          connectionType: (navigator as any).connection?.effectiveType || 'unknown'
        }
      });
    } catch (error: any) {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      updateTestResult(testId, {
        status: 'error',
        message: `Error: ${error.message}`,
        duration,
        details: {
          online: navigator.onLine,
          error: error.toString()
        }
      });
    } finally {
      setRunningTest(null);
    }
  };
  
  // Run all tests (Firebase + Network only; email tests are run separately)
  const runAllTests = async () => {
    setIsRunningTests(true);
    setError(null);
    try {
      await testNetworkConnectivity();
      await testFirebaseConnection();
    } catch (error: any) {
      console.error('❌ Error running tests:', error);
      setError(`Failed to run all tests: ${error.message}`);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Clear all test results
  const clearTestResults = () => {
    setTestResults([]);
  };
  
  // Format timestamp
  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };
  
  return (
    <div className="min-h-full overflow-x-hidden w-full max-w-full">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Back Button */}
        <div className="mb-8">
          <BackButton fallbackTo="/admin" />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Toast for email test result */}
        {toast.visible && (
          <div className="fixed top-4 right-4 z-50 max-w-sm animate-in fade-in duration-200">
            <div className={`p-4 rounded-xl border shadow-lg flex items-center space-x-3 ${
              toast.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}>
              {toast.type === 'success' ? <Check className="h-5 w-5 text-green-600 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />}
              <p className={toast.type === 'success' ? 'text-green-800 text-sm' : 'text-red-800 text-sm'}>{toast.message}</p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Test Configuration Panel */}
          <div className="space-y-8">
            {/* Email Tests — Mailjet & Mailchimp (branded test email) */}
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="flex items-center space-x-3 mb-6">
                <Mail className="h-6 w-6 text-brand-light" />
                <h2 className="text-xl font-bold text-gray-900">Email Tests</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Send a branded AlmaLinks test email to preview how transactional emails look. Uses the same template as event and registration emails.
              </p>
              {emailConfig && (!emailConfig.mailjet || !emailConfig.mailchimp) && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    {!emailConfig.mailjet && !emailConfig.mailchimp
                      ? 'Mailjet and Mailchimp are not configured. Set MAILJET_* or MAILCHIMP_API_KEY to send test emails.'
                      : !emailConfig.mailjet
                        ? 'Mailjet is not configured. Set MAILJET_API_KEY and MAILJET_SECRET_KEY to use Mailjet.'
                        : 'Mailchimp Transactional (Mandrill) is not configured. Set MAILCHIMP_API_KEY to use Mailchimp.'}
                  </div>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label htmlFor="email-recipient" className="block text-sm font-medium text-gray-700 mb-2">
                    Recipient email
                  </label>
                  <input
                    id="email-recipient"
                    type="email"
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="email@example.com"
                    disabled={runningTest !== null}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => sendTestEmail('mailjet')}
                    disabled={!emailRecipient.trim() || runningTest !== null || (emailConfig !== null && !emailConfig.mailjet)}
                    className="bg-brand-dark text-white px-4 py-3 rounded-xl hover:bg-brand-mid transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    title={emailConfig && !emailConfig.mailjet ? 'Mailjet is not configured' : undefined}
                  >
                    {runningTest === 'mailjet' ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5" />
                        <span>Send Mailjet Test</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => sendTestEmail('mailchimp')}
                    disabled={!emailRecipient.trim() || runningTest !== null || (emailConfig !== null && !emailConfig.mailchimp)}
                    className="bg-brand-mid text-white px-4 py-3 rounded-xl hover:bg-brand-light transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    title={emailConfig && !emailConfig.mailchimp ? 'Mailchimp is not configured' : undefined}
                  >
                    {runningTest === 'mailchimp' ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5" />
                        <span>Send Mailchimp Test</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700 mb-3">Send by template</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {EMAIL_TEMPLATES.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => sendTemplateEmail(key)}
                        disabled={!emailRecipient.trim() || runningTemplate !== null || (emailConfig !== null && !emailConfig.mailjet && !emailConfig.mailchimp)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5"
                        title={!emailRecipient.trim() ? 'Enter recipient email' : emailConfig && !emailConfig.mailjet && !emailConfig.mailchimp ? 'Configure Mailjet or Mailchimp' : `Send ${label}`}
                      >
                        {runningTemplate === key ? (
                          <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        ) : (
                          <Send className="h-4 w-4 flex-shrink-0" />
                        )}
                        <span className="truncate">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {lastEmailResponse && (
                  <div className={`mt-4 p-4 rounded-xl border ${lastEmailResponse.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="text-sm font-medium text-gray-900 mb-1">Last response</div>
                    <div className="text-xs text-gray-700 space-y-1">
                      <div><span className="font-medium">Provider:</span> {lastEmailResponse.provider}</div>
                      <div><span className="font-medium">Sent to:</span> {lastEmailResponse.sentTo}</div>
                      <div><span className="font-medium">Time:</span> {new Date(lastEmailResponse.timestamp).toLocaleTimeString()}</div>
                      {lastEmailResponse.providerMessageId && (
                        <div><span className="font-medium">Message ID:</span> {lastEmailResponse.providerMessageId}</div>
                      )}
                      {lastEmailResponse.error && (
                        <div className="text-red-600"><span className="font-medium">Error:</span> {lastEmailResponse.error}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* System Tests */}
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="flex items-center space-x-3 mb-6">
                <Cpu className="h-6 w-6 text-red-600" />
                <h2 className="text-xl font-bold text-gray-900">System Tests</h2>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={testFirebaseConnection}
                    disabled={runningTest !== null}
                    className="bg-orange-600 text-white px-4 py-3 rounded-xl hover:bg-orange-700 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {runningTest === 'firebase' ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Testing...</span>
                      </>
                    ) : (
                      <>
                        <Database className="h-5 w-5" />
                        <span>Test Firebase</span>
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={testNetworkConnectivity}
                    disabled={runningTest !== null}
                    className="bg-teal-600 text-white px-4 py-3 rounded-xl hover:bg-teal-700 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {runningTest === 'network' ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Testing...</span>
                      </>
                    ) : (
                      <>
                        <Globe className="h-5 w-5" />
                        <span>Test Network</span>
                      </>
                    )}
                  </button>
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={runAllTests}
                    disabled={isRunningTests || runningTest !== null}
                    className="w-full bg-gradient-to-r from-brand-blue-dark to-brand-blue-light text-white px-4 py-4 rounded-xl hover:shadow-lg transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {isRunningTests ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Running All Tests...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="h-5 w-5" />
                        <span>Run All Tests</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Test Results Panel */}
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <Server className="h-6 w-6 text-gray-600" />
                <h2 className="text-xl font-bold text-gray-900">Test Results</h2>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={clearTestResults}
                  disabled={testResults.length === 0 || isRunningTests}
                  className="text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear Results
                </button>
                
                <button
                  onClick={() => setTestResults([])}
                  disabled={testResults.length === 0 || isRunningTests}
                  className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {testResults.length === 0 ? (
              <div className="text-center py-12">
                <Server className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Test Results</h3>
                <p className="text-gray-600">
                  Run tests to see results here
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
                {testResults.map((result) => (
                  <div 
                    key={result.id}
                    className={`p-4 rounded-xl border ${
                      result.status === 'success' 
                        ? 'bg-green-50 border-green-200' 
                        : result.status === 'error'
                        ? 'bg-red-50 border-red-200'
                        : result.status === 'pending'
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        {result.status === 'success' && <Check className="h-5 w-5 text-green-600 mt-0.5" />}
                        {result.status === 'error' && <X className="h-5 w-5 text-red-600 mt-0.5" />}
                        {result.status === 'pending' && (
                          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mt-0.5" />
                        )}
                        {result.status === 'idle' && <div className="w-5 h-5 bg-gray-300 rounded-full mt-0.5" />}
                        
                        <div>
                          <div className="font-medium text-gray-900">{result.name}</div>
                          <div className={`text-sm ${
                            result.status === 'success' 
                              ? 'text-green-600' 
                              : result.status === 'error'
                              ? 'text-red-600'
                              : result.status === 'pending'
                              ? 'text-brand-light'
                              : 'text-gray-600'
                          }`}>
                            {result.message}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        {formatTimestamp(result.timestamp)}
                        {result.duration !== undefined && (
                          <span className="ml-2">({result.duration}ms)</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Details Expansion */}
                    {result.details && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs font-mono bg-gray-800 text-gray-200 p-3 rounded-lg overflow-x-auto">
                          <pre>{JSON.stringify(result.details, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* System Information */}
        <div className="mt-8 bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          <div className="flex items-center space-x-3 mb-6">
            <Cpu className="h-6 w-6 text-gray-600" />
            <h2 className="text-xl font-bold text-gray-900">System Information</h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-sm font-medium text-gray-500 mb-1">Browser</div>
              <div className="font-medium text-gray-900">{navigator.userAgent}</div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-sm font-medium text-gray-500 mb-1">Network Status</div>
              <div className="font-medium text-gray-900">
                {navigator.onLine ? (
                  <span className="text-green-600 flex items-center">
                    <Check className="h-4 w-4 mr-1" /> Online
                  </span>
                ) : (
                  <span className="text-red-600 flex items-center">
                    <X className="h-4 w-4 mr-1" /> Offline
                  </span>
                )}
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-sm font-medium text-gray-500 mb-1">Environment</div>
              <div className="font-medium text-gray-900">
                {import.meta.env.MODE === 'production' ? 'Production' : 'Development'}
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-sm font-medium text-gray-500 mb-1">Current User</div>
              <div className="font-medium text-gray-900">{user?.email || 'Not logged in'}</div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-sm font-medium text-gray-500 mb-1">User Role</div>
              <div className="font-medium text-gray-900">{user?.role || 'N/A'}</div>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-xl">
              <div className="text-sm font-medium text-gray-500 mb-1">API Base URL</div>
              <div className="font-medium text-gray-900 truncate">{window.location.origin}</div>
            </div>
          </div>
          
          <div className="mt-6 text-center text-sm text-gray-500">
            System test page allows you to verify all API integrations and system functionality.
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemTestPage;