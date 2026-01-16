import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mail, User, ChevronDown } from 'lucide-react';
import { UserService } from '../../services/userService';
import { UserCard } from '../../types/user';
import { useAuth } from '../../hooks/useAuth';

export interface EmailRecipient {
  email: string;
  name?: string;
  uid?: string;
}

interface EmailRecipientAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onRecipientsChange?: (recipients: EmailRecipient[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

const EmailRecipientAutocomplete: React.FC<EmailRecipientAutocompleteProps> = ({
  value,
  onChange,
  onRecipientsChange,
  placeholder = 'email@example.com or email1@example.com, email2@example.com',
  disabled = false,
  className = '',
  id
}) => {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<UserCard[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<UserCard[]>([]);
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSelectingRef = useRef(false); // Track if we're currently selecting a suggestion
  const lastSelectionTimeRef = useRef<number>(0); // Track when we last selected to prevent useEffect overwrite

  // Parse value string into recipient chips on mount/change
  // This syncs the parent's `value` prop to internal `recipients` state
  // CRITICAL: Only sync when value changes from parent (not from our own typing)
  useEffect(() => {
    // Skip if we just selected (within last 200ms) to prevent overwriting selection
    const timeSinceLastSelection = Date.now() - lastSelectionTimeRef.current;
    if (timeSinceLastSelection < 200) {
      console.log('[EmailRecipientAutocomplete] Skipping value sync - selection just occurred');
      return;
    }

    // Skip if user is currently typing (inputValue is not empty)
    // This prevents parent value from overwriting recipients while typing
    if (inputValue.trim().length > 0) {
      console.log('[EmailRecipientAutocomplete] Skipping value sync - user is typing');
      return;
    }

    // Only sync if value is empty and we have recipients (clear them)
    // OR if value has emails that differ from current recipients (external update)
    if (!value.trim()) {
      if (recipients.length > 0) {
        setRecipients([]);
        onRecipientsChange?.([]);
      }
      return;
    }

    // Parse value into emails
    const emails = value
      .split(',')
      .map(email => email.trim())
      .filter(email => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

    // Build recipients from emails
    const newRecipients: EmailRecipient[] = emails.map(email => {
      // Check if we already have this recipient (preserve existing if name exists)
      const existing = recipients.find(r => r.email.toLowerCase() === email.toLowerCase());
      if (existing && existing.name) {
        return existing; // Keep existing with name
      }
      
      // Check if email matches a user (or re-check if allUsers just loaded)
      const user = allUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (user) {
        return {
          email,
          name: user.displayName || user.firstName || undefined,
          uid: user.uid
        };
      }

      // Return existing or new email-only recipient
      return existing || { email };
    });

    // Only update if recipients actually changed (avoid unnecessary re-renders)
    const currentEmails = recipients.map(r => r.email.toLowerCase()).sort().join(',');
    const newEmails = newRecipients.map(r => r.email.toLowerCase()).sort().join(',');
    
    if (currentEmails !== newEmails || newRecipients.some((r, i) => r.name !== recipients[i]?.name)) {
      console.log('[EmailRecipientAutocomplete] Syncing value prop to recipients:', newEmails);
      setRecipients(newRecipients);
      onRecipientsChange?.(newRecipients);
    }
    // Note: We check inputValue in the guard above, but don't include it in deps to avoid
    // re-running on every keystroke. The guard uses the latest inputValue from the render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, allUsers.length > 0 ? allUsers.map(u => `${u.uid}-${u.email}`).join(',') : '']); // Re-parse when allUsers loads to enrich with names

  // Load all approved users on mount
  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        const users = await UserService.getAllMembersForDirectory(user?.uid || null, user?.role);
        
        // Normalize and filter users: ensure email field exists and is valid
        const normalizedUsers = users
          .map(user => {
            // Normalize email field - check multiple possible sources
            const email = user.email || 
                         (user as any).userEmail || 
                         (user as any).primaryEmail || 
                         (user as any).contactEmail || 
                         undefined;
            
            // Normalize display name
            const displayName = user.displayName || 
                               user.firstName || 
                               (user as any).name || 
                               'Unknown User';
            
            // Return normalized user object
            return {
              ...user,
              uid: user.uid || user.id || '',
              email: email, // Ensure email is set (may be undefined)
              displayName: displayName,
              firstName: user.firstName || displayName.split(' ')[0],
              lastName: user.lastName || displayName.split(' ').slice(1).join(' ')
            };
          })
          .filter(user => {
            // CRITICAL: Filter out users without valid email addresses
            const hasValidEmail = user.email && 
                                 typeof user.email === 'string' && 
                                 user.email.trim().length > 0 &&
                                 /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email.trim());
            
            if (!hasValidEmail) {
              console.warn('[EmailRecipientAutocomplete] Filtering out user without valid email:', {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email
              });
            }
            
            return hasValidEmail;
          });
        
        console.log(`[EmailRecipientAutocomplete] Loaded ${normalizedUsers.length} users with valid emails (from ${users.length} total)`);
        setAllUsers(normalizedUsers);
      } catch (error) {
        console.error('❌ Error loading users for autocomplete:', error);
        setAllUsers([]);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [user?.uid, user?.role]);

  // Debounced search
  const searchUsers = useCallback((query: string) => {
    if (!query.trim() || query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matchingUsers = allUsers
      .filter(user => {
        // Ensure user has valid email before including in search
        const email = user.email || '';
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return false;
        }
        
        const nameMatch = 
          user.displayName?.toLowerCase().includes(lowerQuery) ||
          user.firstName?.toLowerCase().includes(lowerQuery) ||
          user.lastName?.toLowerCase().includes(lowerQuery) ||
          `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase().includes(lowerQuery);
        
        const emailMatch = email.toLowerCase().includes(lowerQuery);
        
        return nameMatch || emailMatch;
      })
      .slice(0, 10); // Limit to top 10

    setSuggestions(matchingUsers);
    setShowSuggestions(matchingUsers.length > 0);
    setSelectedIndex(-1);
  }, [allUsers]);

  // Handle input change with debouncing
  // CRITICAL: Only update inputValue, do NOT call onChange with typed text
  // onChange should only be called when recipients actually change (selection/addition)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // ONLY update inputValue (what user is typing)
    // Do NOT update parent's value prop or recipients while typing
    setInputValue(newValue);

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce the search (for autocomplete suggestions)
    debounceTimerRef.current = setTimeout(() => {
      searchUsers(newValue);
    }, 200);
  };

  // Handle selection from dropdown
  const selectUser = (user: UserCard, event?: React.MouseEvent) => {
    // Normalize email field - check multiple possible sources
    const email = user.email || 
                 (user as any).userEmail || 
                 (user as any).primaryEmail || 
                 (user as any).contactEmail || 
                 undefined;
    
    // Validate email before proceeding
    if (!email || typeof email !== 'string' || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      console.error('[EmailRecipientAutocomplete] selectUser called with invalid email:', {
        uid: user.uid,
        displayName: user.displayName,
        email: email,
        userObject: user
      });
      return;
    }

    // Normalize email (trim and lowercase for consistency)
    const normalizedEmail = email.trim().toLowerCase();

    // DEV LOG: Confirm selection
    console.log('[EmailRecipientAutocomplete] SELECTED', normalizedEmail);
    console.log('[EmailRecipientAutocomplete] Current recipients before selection:', recipients.map(r => r.email));

    // Prevent event propagation to avoid triggering outside click handler
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      // Mark that we're selecting to prevent outside click handler from closing dropdown
      isSelectingRef.current = true;
    }

    const newRecipient: EmailRecipient = {
      email: normalizedEmail,
      name: user.displayName || user.firstName || undefined,
      uid: user.uid || user.id || ''
    };

    // Check if already added (case-insensitive)
    const existing = recipients.find(r => r.email.toLowerCase() === normalizedEmail);
    if (existing) {
      // Already added, just clear input and close dropdown
      console.log('[EmailRecipientAutocomplete] Email already in recipients:', normalizedEmail);
      setInputValue('');
      setShowSuggestions(false);
      setSelectedIndex(-1);
      isSelectingRef.current = false;
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
      return;
    }

    // Add to recipients array
    const newRecipients = [...recipients, newRecipient];
    console.log('[EmailRecipientAutocomplete] New recipients after selection:', newRecipients.map(r => r.email));
    
    // Update value string (comma-separated emails) for parent
    const emails = newRecipients.map(r => r.email).join(', ');
    console.log('[EmailRecipientAutocomplete] Calling onChange with emails string:', emails);
    
    // CRITICAL: Update ALL state synchronously
    // Mark selection time BEFORE state updates to prevent useEffect from overwriting
    lastSelectionTimeRef.current = Date.now();
    isSelectingRef.current = true;
    
    // 1. Update internal recipients array (this controls chips display)
    setRecipients(newRecipients);
    // 2. Clear input field (this controls the text input)
    setInputValue('');
    // 3. Close dropdown
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    // 4. Update parent state (these trigger parent re-renders)
    onRecipientsChange?.(newRecipients);
    onChange(emails);
    
    // 5. Reset selection flag after a short delay (allows parent update to propagate)
    setTimeout(() => {
      isSelectingRef.current = false;
    }, 50);
    
    // Log final state after all updates
    console.log('[EmailRecipientAutocomplete] TO STATE NOW (internal recipients):', newRecipients.map(r => r.email));
    console.log('[EmailRecipientAutocomplete] TO STATE NOW (emails string):', emails);
    
    // Refocus input for quick additional selections
    setTimeout(() => {
      inputRef.current?.focus();
      console.log('[EmailRecipientAutocomplete] Selection complete, input refocused');
    }, 0);
  };

  // Handle removing a chip
  const removeRecipient = (email: string) => {
    const newRecipients = recipients.filter(r => r.email !== email);
    setRecipients(newRecipients);
    onRecipientsChange?.(newRecipients);

    const emails = newRecipients.map(r => r.email).join(', ');
    onChange(emails);
    inputRef.current?.focus();
  };

  // Handle adding manually typed email to recipients
  const addTypedEmail = (emailText: string) => {
    const trimmedEmail = emailText.trim();
    
    // Validate email format
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      console.log('[EmailRecipientAutocomplete] Invalid email format:', trimmedEmail);
      return false;
    }
    
    const normalizedEmail = trimmedEmail.toLowerCase();
    
    // Check if already added (case-insensitive)
    const existing = recipients.find(r => r.email.toLowerCase() === normalizedEmail);
    if (existing) {
      console.log('[EmailRecipientAutocomplete] Email already in recipients:', normalizedEmail);
      setInputValue('');
      return false; // Already exists, just clear input
    }
    
    // Check if email matches a known user (to get name)
    const user = allUsers.find(u => u.email?.toLowerCase() === normalizedEmail);
    
    const newRecipient: EmailRecipient = {
      email: normalizedEmail,
      name: user?.displayName || user?.firstName || undefined,
      uid: user?.uid || ''
    };
    
    // Add to recipients array
    const newRecipients = [...recipients, newRecipient];
    console.log('[EmailRecipientAutocomplete] Added typed email:', normalizedEmail);
    console.log('[EmailRecipientAutocomplete] New recipients:', newRecipients.map(r => r.email));
    
    // Update value string (comma-separated emails) for parent
    const emails = newRecipients.map(r => r.email).join(', ');
    
    // Update state
    setRecipients(newRecipients);
    setInputValue('');
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    // Update parent state
    onRecipientsChange?.(newRecipients);
    onChange(emails);
    
    // Refocus input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    
    return true;
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Enter key
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (showSuggestions && suggestions.length > 0) {
        // If suggestions are shown, select from suggestions
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          selectUser(suggestions[selectedIndex], undefined);
        } else if (suggestions.length > 0 && selectedIndex === -1) {
          // If no selection but suggestions exist, select the first one
          selectUser(suggestions[0], undefined);
        }
      } else if (inputValue.trim()) {
        // If no suggestions but user typed an email, add it as a chip
        const emailText = inputValue.trim();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailText)) {
          addTypedEmail(emailText);
        }
      }
      return;
    }
    
    // Handle Comma key - convert typed email to chip
    if (e.key === ',' || e.key === ';') {
      e.preventDefault();
      
      if (inputValue.trim()) {
        const emailText = inputValue.trim();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailText)) {
          addTypedEmail(emailText);
        }
      }
      return;
    }
    
    // Handle backspace to remove last chip (when input is empty)
    if (e.key === 'Backspace' && !inputValue && recipients.length > 0) {
      removeRecipient(recipients[recipients.length - 1].email);
      return;
    }
    
    // Handle arrow keys and other navigation when suggestions are shown
    if (!showSuggestions || suggestions.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
      case 'Tab':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle paste - parse comma-separated emails
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    const emails = pastedText
      .split(',')
      .map(email => email.trim())
      .filter(email => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

    if (emails.length > 0) {
      e.preventDefault();
      
      const newRecipients: EmailRecipient[] = [...recipients];
      
      emails.forEach(email => {
        // Check if already added
        const existing = newRecipients.find(r => r.email.toLowerCase() === email.toLowerCase());
        if (existing) return;

        // Check if email matches a user
        const user = allUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());
        newRecipients.push({
          email,
          name: user?.displayName || user?.firstName || undefined,
          uid: user?.uid
        });
      });

      setRecipients(newRecipients);
      onRecipientsChange?.(newRecipients);

      const emailsString = newRecipients.map(r => r.email).join(', ');
      onChange(emailsString);
      setInputValue('');
    }
  };

  // Handle focus
  const handleFocus = () => {
    if (inputValue.trim()) {
      searchUsers(inputValue);
    }
  };

  // Handle outside click - using a ref flag to prevent race conditions
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      // Check if the click target is inside the container
      const target = event.target as Node;
      
      // Don't close if we just selected a suggestion (flag prevents this)
      // Check flag immediately, but use setTimeout for closing to ensure selection completes
      if (isSelectingRef.current) {
        // Selection in progress, don't close
        return;
      }

      // Close dropdown if clicking outside the container
      // Use setTimeout to allow selection handler to complete first
      setTimeout(() => {
        // Double-check flag after delay
        if (isSelectingRef.current) {
          isSelectingRef.current = false;
          return;
        }

        if (containerRef.current && !containerRef.current.contains(target)) {
          setShowSuggestions(false);
          setSelectedIndex(-1);
        }
      }, 50); // Small delay to allow suggestion button mousedown to process
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Scroll selected suggestion into view
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const selectedElement = suggestionsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Recipient Chips */}
      {recipients.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {recipients.map((recipient) => (
            <div
              key={recipient.email}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm"
            >
              <Mail className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
              <span className="text-blue-900 font-medium">
                {recipient.name || recipient.email}
              </span>
              {recipient.name && (
                <span className="text-blue-600 text-xs">({recipient.email})</span>
              )}
              <button
                type="button"
                onClick={() => removeRecipient(recipient.email)}
                className="ml-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded p-0.5 transition-colors"
                aria-label={`Remove ${recipient.email}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Field */}
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={handleFocus}
          placeholder={recipients.length === 0 ? placeholder : 'Add more recipients...'}
          disabled={disabled}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 pr-10"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls={showSuggestions ? 'email-suggestions' : undefined}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          id="email-suggestions"
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto"
          role="listbox"
        >
          {suggestions.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              <User className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p>No matches found</p>
            </div>
          ) : (
            suggestions
              .filter(user => {
                // DEFENSIVE: Double-check email exists before rendering (should be filtered already, but be safe)
                const email = user.email || '';
                const hasValidEmail = email && 
                                     typeof email === 'string' && 
                                     email.trim().length > 0 &&
                                     /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
                if (!hasValidEmail) {
                  console.warn('[EmailRecipientAutocomplete] Filtering out user without valid email in suggestions:', {
                    uid: user.uid,
                    displayName: user.displayName,
                    email: email
                  });
                }
                return hasValidEmail;
              })
              .map((user, index) => {
                // Normalize email for display (should already be normalized, but be safe)
                const email = user.email?.trim() || '';
                const displayName = user.displayName || user.firstName || 'Unknown User';
                
                return (
                  <button
                    key={user.uid}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('[EmailRecipientAutocomplete] Button mousedown for user:', email);
                      // Call selectUser synchronously - no setTimeout wrapper
                      selectUser(user, e);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center space-x-3 ${
                      index === selectedIndex ? 'bg-blue-50' : ''
                    } ${index === 0 ? 'rounded-t-xl' : ''} ${index === suggestions.length - 1 ? 'rounded-b-xl' : ''}`}
                    role="option"
                    aria-selected={index === selectedIndex}
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={displayName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {displayName}
                      </div>
                      <div className="text-sm text-gray-600 truncate">{email}</div>
                    </div>
                    <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  </button>
                );
              })
          )}
        </div>
      )}
    </div>
  );
};

export default EmailRecipientAutocomplete;
