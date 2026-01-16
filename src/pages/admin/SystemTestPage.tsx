import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Mail, 
  MessageSquare, 
  Zap, 
  Check, 
  X, 
  AlertCircle, 
  Send, 
  Phone, 
  Bot, 
  RefreshCw,
  Cpu,
  Database,
  Globe,
  Server
} from 'lucide-react';
import AdminHeader from '../../components/admin/AdminHeader';
import { useAuth } from '../../hooks/useAuth';

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
  
  const [emailTest, setEmailTest] = useState({
    recipient: '',
    subject: 'Alma Links System Test',
    message: 'This is a test email from the Alma Links admin panel.'
  });
  
  const [smsTest, setSmsTest] = useState({
    recipient: '',
    message: 'This is a test SMS from Alma Links admin panel.'
  });
  
  const [gptTest, setGptTest] = useState({
    prompt: 'Briefly describe Alma Links in one sentence.'
  });
  
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [runningTest, setRunningTest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
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
  
  // Test Email API
  const testEmailApi = async () => {
    const testId = `email-${Date.now()}`;
    
    // Add initial test result
    addTestResult({
      id: testId,
      name: 'Email API',
      status: 'pending',
      message: 'Testing email delivery...',
      timestamp: new Date()
    });
    
    setRunningTest('email');
    const startTime = performance.now();
    
    try {
      // Call the consolidated system test API
      const response = await fetch('/api/system-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testType: 'email',
          recipient: emailTest.recipient,
          subject: emailTest.subject,
          message: emailTest.message
        })
      });
      
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      // Get response text first to debug parsing issues
      const responseText = await response.text();
      console.log('Raw API Response:', responseText);
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        updateTestResult(testId, {
          status: 'error',
          message: `JSON parsing failed: ${parseError.message}`,
          duration,
          details: {
            rawResponse: responseText.substring(0, 200) + '...',
            parseError: parseError.message,
            status: response.status,
            statusText: response.statusText
          }
        });
        return;
      }
      
      if (response.ok) {
        updateTestResult(testId, {
          status: 'success',
          message: 'Email sent successfully',
          duration,
          details: responseData
        });
      } else {
        updateTestResult(testId, {
          status: 'error',
          message: `Failed to send email: ${responseData.error || response.statusText}`,
          duration,
          details: responseData
        });
      }
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
  
  // Test SMS API
  const testSmsApi = async () => {
    const testId = `sms-${Date.now()}`;
    
    // Add initial test result
    addTestResult({
      id: testId,
      name: 'SMS API',
      status: 'pending',
      message: 'Testing SMS delivery...',
      timestamp: new Date()
    });
    
    setRunningTest('sms');
    const startTime = performance.now();
    
    try {
      // Call the Vercel API function to send a test SMS (Updated)
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: smsTest.recipient,
          body: smsTest.message
        })
      });
      
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      const responseData = await response.json();
      
      if (response.ok) {
        updateTestResult(testId, {
          status: 'success',
          message: 'SMS sent successfully',
          duration,
          details: responseData
        });
      } else {
        updateTestResult(testId, {
          status: 'error',
          message: `Failed to send SMS: ${responseData.error || response.statusText}`,
          duration,
          details: responseData
        });
      }
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
  
  // Test OpenAI GPT API
  const testGptApi = async () => {
    const testId = `gpt-${Date.now()}`;
    
    // Add initial test result
    addTestResult({
      id: testId,
      name: 'OpenAI GPT API',
      status: 'pending',
      message: 'Testing GPT API...',
      timestamp: new Date()
    });
    
    setRunningTest('gpt');
    const startTime = performance.now();
    
    try {
      // Call the Vercel API function to test GPT (Updated)
      const response = await fetch('/api/system-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testType: 'gpt',
          prompt: gptTest.prompt
        })
      });
      
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      const responseData = await response.json();
      
      if (response.ok) {
        updateTestResult(testId, {
          status: 'success',
          message: 'GPT API test successful',
          duration,
          details: responseData
        });
      } else {
        updateTestResult(testId, {
          status: 'error',
          message: `Failed to test GPT API: ${responseData.error || response.statusText}`,
          duration,
          details: responseData
        });
      }
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
  
  // Run all tests
  const runAllTests = async () => {
    setIsRunningTests(true);
    setError(null);
    
    try {
      // Run tests sequentially to avoid overwhelming the system
      await testNetworkConnectivity();
      await testFirebaseConnection();
      
      // Only run these if we have the required inputs
      if (emailTest.recipient) {
        await testEmailApi();
      }
      
      if (smsTest.recipient) {
        await testSmsApi();
      }
      
      await testGptApi();
      
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <AdminHeader 
        title="System Test Panel" 
        subtitle="Test and verify all system integrations and APIs"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin')}
            className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Admin Tools</span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Test Configuration Panel */}
          <div className="space-y-8">
            {/* Email Test */}
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="flex items-center space-x-3 mb-6">
                <Mail className="h-6 w-6 text-brand-light" />
                <h2 className="text-xl font-bold text-gray-900">Email API Test</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="email-recipient" className="block text-sm font-medium text-gray-700 mb-2">
                    Recipient Email
                  </label>
                  <input
                    id="email-recipient"
                    type="email"
                    value={emailTest.recipient}
                    onChange={(e) => setEmailTest(prev => ({ ...prev, recipient: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter test recipient email"
                    disabled={runningTest === 'email'}
                  />
                </div>
                
                <div>
                  <label htmlFor="email-subject" className="block text-sm font-medium text-gray-700 mb-2">
                    Subject
                  </label>
                  <input
                    id="email-subject"
                    type="text"
                    value={emailTest.subject}
                    onChange={(e) => setEmailTest(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter test email subject"
                    disabled={runningTest === 'email'}
                  />
                </div>
                
                <div>
                  <label htmlFor="email-message" className="block text-sm font-medium text-gray-700 mb-2">
                    Message
                  </label>
                  <textarea
                    id="email-message"
                    value={emailTest.message}
                    onChange={(e) => setEmailTest(prev => ({ ...prev, message: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                    placeholder="Enter test email message"
                    disabled={runningTest === 'email'}
                  />
                </div>
                
                <button
                  onClick={testEmailApi}
                  disabled={!emailTest.recipient || runningTest !== null}
                  className="w-full bg-brand-dark text-white px-4 py-3 rounded-xl hover:bg-brand-mid transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {runningTest === 'email' ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Testing Email API...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      <span>Test Email API</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* SMS Test */}
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="flex items-center space-x-3 mb-6">
                <Phone className="h-6 w-6 text-green-600" />
                <h2 className="text-xl font-bold text-gray-900">SMS API Test</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="sms-recipient" className="block text-sm font-medium text-gray-700 mb-2">
                    Recipient Phone Number
                  </label>
                  <input
                    id="sms-recipient"
                    type="tel"
                    value={smsTest.recipient}
                    onChange={(e) => setSmsTest(prev => ({ ...prev, recipient: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter test recipient phone (e.g. +972501234567)"
                    disabled={runningTest === 'sms'}
                  />
                </div>
                
                <div>
                  <label htmlFor="sms-message" className="block text-sm font-medium text-gray-700 mb-2">
                    Message
                  </label>
                  <textarea
                    id="sms-message"
                    value={smsTest.message}
                    onChange={(e) => setSmsTest(prev => ({ ...prev, message: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 resize-none"
                    placeholder="Enter test SMS message"
                    disabled={runningTest === 'sms'}
                  />
                </div>
                
                <button
                  onClick={testSmsApi}
                  disabled={!smsTest.recipient || runningTest !== null}
                  className="w-full bg-green-600 text-white px-4 py-3 rounded-xl hover:bg-green-700 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {runningTest === 'sms' ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Testing SMS API...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      <span>Test SMS API</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* GPT Test */}
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="flex items-center space-x-3 mb-6">
                <Bot className="h-6 w-6 text-brand-dark" />
                <h2 className="text-xl font-bold text-gray-900">OpenAI GPT API Test</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="gpt-prompt" className="block text-sm font-medium text-gray-700 mb-2">
                    Test Prompt
                  </label>
                  <textarea
                    id="gpt-prompt"
                    value={gptTest.prompt}
                    onChange={(e) => setGptTest(prev => ({ ...prev, prompt: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none"
                    placeholder="Enter test prompt for GPT"
                    disabled={runningTest === 'gpt'}
                  />
                </div>
                
                <button
                  onClick={testGptApi}
                  disabled={!gptTest.prompt || runningTest !== null}
                  className="w-full bg-brand-dark text-white px-4 py-3 rounded-xl hover:bg-brand-mid transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {runningTest === 'gpt' ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Testing GPT API...</span>
                    </>
                  ) : (
                    <>
                      <Bot className="h-5 w-5" />
                      <span>Test GPT API</span>
                    </>
                  )}
                </button>
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