'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { AxiosError } from 'axios';
import api from '@/lib/api';

// Re-using the SearchableSelect from your first example
type Option = { id: string | number; name: string };

function SearchableSelect(props: {
  id?: string;
  options: Option[];
  value: string | number | '';
  onChange: (v: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const { options, value, onChange, placeholder = 'Select...', disabled } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const filtered = query.trim()
    ? options.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(-1);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [close]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && highlight < filtered.length) {
        onChange(filtered[highlight].id);
        close();
      }
    }
  };

  const displayLabel = options.find((o) => String(o.id) === String(value))?.name ?? '';

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%' }} onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="form-control d-flex align-items-center justify-content-between"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        style={{ textAlign: 'left', gap: 8 }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {displayLabel || placeholder}
        </span>
        <span aria-hidden style={{ marginLeft: 8 }}>▾</span>
      </button>
      {open && (
        <div role="dialog" style={{ position: 'absolute', zIndex: 10, left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #ddd', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 280, overflow: 'auto' }}>
          <div style={{ padding: 8 }}>
            <input ref={searchRef} value={query} onChange={(e) => { setQuery(e.target.value); setHighlight(0); }} placeholder="Search..." className="form-control" style={{ marginBottom: 8 }} />
            <ul role="listbox" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {filtered.length === 0 && <li style={{ padding: '8px 10px', color: '#666' }}>No results</li>}
              {filtered.map((opt, i) => {
                const isHighlighted = i === highlight;
                const isSelected = String(opt.id) === String(value);
                return (
                  <li key={opt.id}>
                    <button type="button" role="option" aria-selected={isSelected} onMouseEnter={() => setHighlight(i)} onClick={() => { onChange(opt.id); close(); }} style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: isHighlighted ? '#f0f0f0' : 'transparent', border: 'none', cursor: 'pointer' }}>
                      {opt.name} {isSelected && '✓'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple component for handling image uploads and previews
function ImageUpload(props: {
  label: string;
  onFileChange: (file: File | null) => void;
  required?: boolean;
}) {
  const { label, onFileChange, required } = props;
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    onFileChange(file);
    if (file) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
    }
  };

  const clearFile = () => {
    onFileChange(null);
    setPreview(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="text-center">
      <label className="form-label">{label} {required && <span style={{ color: '#d93025' }}>*</span>}</label>
      <div className="kv-avatar rounded border p-2" style={{ width: '100%', minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', cursor: 'pointer' }} onClick={() => inputRef.current?.click()}>
        {preview ? (
          <img src={preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 150, objectFit: 'contain' }} />
        ) : (
          <span className="text-muted">Click to select photo</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="d-none"
          required={required}
        />
      </div>
      {preview && <button type="button" className="btn btn-sm btn-light mt-2" onClick={clearFile}>Clear</button>}
    </div>
  );
}

// The main page component
export default function SelfOnboardingPage() {
  // --- State for all form fields ---
  const [firstName, setFirstName] = useState('');
  const [otherName, setOtherName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<string | number>('');
  const [nationalId, setNationalId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [postalAddress, setPostalAddress] = useState('');
  const [physicalAddress, setPhysicalAddress] = useState('');
  const [consent, setConsent] = useState(false);

  // --- State for file uploads ---
  const [borrowerPhoto, setBorrowerPhoto] = useState<File | null>(null);
  const [idFrontPhoto, setIdFrontPhoto] = useState<File | null>(null);
  const [idBackPhoto, setIdBackPhoto] = useState<File | null>(null);
  const [passportPhoto, setPassportPhoto] = useState<File | null>(null);

  // --- State for Device Details ---
  const [phoneType, setPhoneType] = useState<string | number>('');
  const [color, setColor] = useState<string | number>('');
  const [memory, setMemory] = useState<string | number>('');
  const [phoneState, setPhoneState] = useState<string | number>('');
  const [deviceCashPrice, setDeviceCashPrice] = useState('');

  // --- State for Loan Details ---
  const [deposit, setDeposit] = useState('');
  const [amountFinanced, setAmountFinanced] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [loanTenure, setLoanTenure] = useState('');
  const [amountToBePaid, setAmountToBePaid] = useState('');
  const [totalDue, setTotalDue] = useState('');

  // --- Form handling state ---
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [otp, setOtp] = useState('');

  // Static options for the Gender dropdown
  const genderOptions: Option[] = [
      { id: 'Male', name: 'Male' },
      { id: 'Female', name: 'Female' },
      { id: 'Other', name: 'Other' }
  ];

  // --- Dynamic options for dropdowns ---
  const [phoneTypes, setPhoneTypes] = useState<Option[]>([]);
  const [colors, setColors] = useState<Option[]>([]);
  const [memories, setMemories] = useState<Option[]>([]);
  const [phoneStates, setPhoneStates] = useState<Option[]>([]);

  // Helper function to normalize API response data into Option[]
  function normalizeOptions(input: unknown): Option[] {
    const list: unknown[] = Array.isArray(input)
      ? input
      : typeof input === 'object' && input !== null && Array.isArray((input as { data?: unknown }).data)
      ? (input as { data: unknown[] }).data
      : [];

    return list.map((it) => {
      if (typeof it === 'string') return { id: it, name: it };
      if (typeof it === 'number') return { id: it, name: String(it) };
      if (typeof it === 'object' && it !== null) {
        const obj = it as Record<string, unknown>;
        const id = obj.id ?? obj.value ?? obj.name ?? JSON.stringify(obj);
        const name =
          typeof obj.name === 'string'
            ? obj.name
            : typeof obj.value === 'string'
            ? obj.value
            : typeof obj.id === 'string' || typeof obj.id === 'number'
            ? String(obj.id)
            : JSON.stringify(obj);
        return { id: id as string | number, name };
      }
      return { id: String(it), name: String(it) };
    });
  }

  // Helper function to show error messages (re-used from your example)
  function getErrorMessage(err: unknown): string {
    if (typeof err === 'object' && err !== null && 'isAxiosError' in err && (err as AxiosError).isAxiosError) {
      const a = err as AxiosError;
      const data = a.response?.data as Record<string, unknown> | undefined;
      if (data) {
        if (typeof data.message === 'string') return data.message;
        if (typeof data.error === 'string') return data.error;
      }
      return a.message || 'API error';
    }
    if (err instanceof Error) return err.message;
    return String(err);
  }

  // --- Fetching options on component mount ---
  useEffect(() => {
    let mounted = true;
    async function loadOptions() {
      try {
        const [ptResp, cResp, mResp, psResp] = await Promise.all([
          api.get('/api/Leads/GetPhoneModels'),
          api.get('/api/Leads/GetPhoneColors'),
          api.get('/api/Leads/GetPhoneMemory'),
          api.get('/api/Leads/GetPhoneState'),
        ]);

        if (!mounted) return;
        setPhoneTypes(normalizeOptions(ptResp.data));
        setColors(normalizeOptions(cResp.data));
        setMemories(normalizeOptions(mResp.data));
        setPhoneStates(normalizeOptions(psResp.data));
      } catch (err: unknown) {
        setMessage({
          text: 'Could not load device options. Please refresh the page.',
          isError: true,
        });
      }
    }
    loadOptions();
    return () => {
      mounted = false;
    };
  }, []);
  
  // --- Step 1: Handle Send OTP ---
  async function handleSendOTP(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setMessage(null);

    // Basic Validation for Step 1
    if (!firstName.trim()) return setMessage({ text: 'First name is required.', isError: true });
    if (!nationalId.trim()) return setMessage({ text: 'National ID is required.', isError: true });
    if (!phoneNumber.trim()) return setMessage({ text: 'Phone number is required.', isError: true });
    if (!borrowerPhoto) return setMessage({ text: 'Borrower photo is required.', isError: true });
    if (!consent) return setMessage({ text: 'You must agree to the Terms & Conditions.', isError: true });

    if (submitting) return;
    setSubmitting(true);

    try {
      // Simulate API call to send OTP
      await api.post('/api/otp/send', { phoneNumber: `+254${phoneNumber.trim()}` });
      setMessage({ text: 'OTP sent successfully! Please check your phone.', isError: false });
      setCurrentStep(2); // Move to the next step
    } catch (err: unknown) {
      setMessage({ text: getErrorMessage(err), isError: true });
    } finally {
      setSubmitting(false);
    }
  }

  // --- Step 2: Handle OTP Verification and Final Submission ---
  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setMessage(null);

    // Final Validation for Step 2
    if (!otp.trim()) return setMessage({ text: 'OTP is required.', isError: true });

    // Combine all form data
    const formData = new FormData();
    formData.append('BorrowerFirstName', firstName.trim());
    formData.append('BorrowerOtherName', otherName.trim());
    formData.append('DOB', dob);
    formData.append('Gender', String(gender));
    formData.append('NationalID', nationalId.trim());
    formData.append('PhoneNumber', `+254${phoneNumber.trim()}`);
    formData.append('EmailAddress', email.trim());
    formData.append('PostalAddress', postalAddress.trim());
    formData.append('PhysicalAddress', physicalAddress.trim());
    formData.append('Consent', String(consent));
    
    // Append new device and loan details to FormData
    formData.append('PhoneType', String(phoneType));
    if (color) formData.append('Color', String(color));
    if (memory) formData.append('Memory', String(memory));
    if (phoneState) formData.append('PhoneState', String(phoneState));
    formData.append('DeviceCashPrice', deviceCashPrice);

    formData.append('Deposit', deposit);
    formData.append('AmountFinanced', amountFinanced);
    formData.append('PaymentType', paymentType);
    if (amountToBePaid) formData.append('AmountToBePaid', amountToBePaid);
    formData.append('LoanTenure', loanTenure);
    formData.append('TotalDue', totalDue);

    // Append files if they exist
    if (borrowerPhoto) formData.append('borrowerPhoto', borrowerPhoto);
    if (idFrontPhoto) formData.append('idFrontPhoto', idFrontPhoto);
    if (idBackPhoto) formData.append('idBackPhoto', idBackPhoto);
    if (passportPhoto) formData.append('passportPhoto', passportPhoto);
    
    // Append OTP for verification
    formData.append('OTP', otp);

    setSubmitting(true);

    try {
      // Simulate API call to verify OTP and submit form data
      await api.post('/api/otp/verify-and-submit', formData);
      setMessage({ text: 'You have successfully submitted your information.' });
      setCurrentStep(3); // A final success step, or redirect
      // Clear form on success
      setFirstName('');
      setOtherName('');
      setDob('');
      setGender('');
      setNationalId('');
      setPhoneNumber('');
      setEmail('');
      setPostalAddress('');
      setPhysicalAddress('');
      setBorrowerPhoto(null);
      setIdFrontPhoto(null);
      setIdBackPhoto(null);
      setPassportPhoto(null);
      setConsent(false);
      setPhoneType('');
      setColor('');
      setMemory('');
      setPhoneState('');
      setDeviceCashPrice('');
      setDeposit('');
      setAmountFinanced('');
      setPaymentType('');
      setLoanTenure('');
      setAmountToBePaid('');
      setTotalDue('');
      setOtp('');
    } catch (err: unknown) {
      setMessage({ text: getErrorMessage(err), isError: true });
    } finally {
      setSubmitting(false);
    }
  }

  // A render function to conditionally show the forms
  const renderForm = () => {
    switch (currentStep) {
      case 1:
        // Main Onboarding Form
        return (
          <form onSubmit={handleSendOTP}>
            <h3 className="mb-4 border-bottom pb-3">Self Onboarding</h3>
            
            {/* --- Basic Information --- */}
            <div className="row">
              <div className="col-md-9">
                <div className="row">
                  <div className="col-md-4 mb-3">
                    <label className="form-label">First Name <span style={{ color: '#d93025' }}>*</span></label>
                    <input className="form-control" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Other Name <span style={{ color: '#d93025' }}>*</span></label>
                    <input className="form-control" value={otherName} onChange={(e) => setOtherName(e.target.value)} required />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Date of Birth</label>
                    <input type="date" className="form-control" value={dob} onChange={(e) => setDob(e.target.value)} />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Gender <span style={{ color: '#d93025' }}>*</span></label>
                    <SearchableSelect options={genderOptions} value={gender} onChange={setGender} placeholder="Select Gender..." required />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">National ID <span style={{ color: '#d93025' }}>*</span></label>
                    <input className="form-control" value={nationalId} onChange={(e) => setNationalId(e.target.value)} required />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Phone Number <span style={{ color: '#d93025' }}>*</span></label>
                    <div className="input-group">
                      <span className="input-group-text">+254</span>
                      <input className="form-control" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))} required placeholder="712345678" />
                    </div>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Email Address <span style={{ color: '#d93025' }}>*</span></label>
                    <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Postal Address</label>
                    <input className="form-control" value={postalAddress} onChange={(e) => setPostalAddress(e.target.value)} />
                  </div>
                  <div className="col-12 mb-3">
                    <label className="form-label">Physical Address <span style={{ color: '#d93025' }}>*</span></label>
                    <input className="form-control" value={physicalAddress} onChange={(e) => setPhysicalAddress(e.target.value)} required />
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <ImageUpload label="Borrower Photo" onFileChange={setBorrowerPhoto} required />
              </div>
            </div>

            <hr className="my-4" />

            {/* --- Document Uploads --- */}
            <h4 className="mb-3">Identification Documents</h4>
            <div className="row">
              <div className="col-md-4 mb-3">
                <ImageUpload label="National ID Photo - Front" onFileChange={setIdFrontPhoto} />
              </div>
              <div className="col-md-4 mb-3">
                <ImageUpload label="National ID Photo - Back" onFileChange={setIdBackPhoto} />
              </div>
              <div className="col-md-4 mb-3">
                <ImageUpload label="Passport Photo" onFileChange={setPassportPhoto} />
              </div>
            </div>

            <hr className="my-4" />

            {/* --- Device Details --- */}
            <h4 className="mb-3">Device Details</h4>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">Phone Type <span style={{ color: '#d93025' }}>*</span></label>
                <SearchableSelect
                  options={phoneTypes}
                  value={phoneType}
                  onChange={setPhoneType}
                  placeholder="Select Phone Type..."
                  required
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Color <span style={{ color: '#d93025' }}>*</span></label>
                <SearchableSelect
                  options={colors}
                  value={color}
                  onChange={setColor}
                  placeholder="Select Color..."
                  required
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Memory <span style={{ color: '#d93025' }}>*</span></label>
                <SearchableSelect
                  options={memories}
                  value={memory}
                  onChange={setMemory}
                  placeholder="Select Memory..."
                  required
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Phone State <span style={{ color: '#d93025' }}>*</span></label>
                <SearchableSelect
                  options={phoneStates}
                  value={phoneState}
                  onChange={setPhoneState}
                  placeholder="Select Phone State..."
                  required
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Device Cash Price <span style={{ color: '#d93025' }}>*</span></label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={deviceCashPrice}
                  onChange={(e) => setDeviceCashPrice(e.target.value)}
                  required
                />
              </div>
            </div>

            <hr className="my-4" />

            {/* --- Loan Details --- */}
            <h4 className="mb-3">Loan Details</h4>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">Deposit <span style={{ color: '#d93025' }}>*</span></label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  required
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Amount Financed <span style={{ color: '#d93025' }}>*</span></label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="form-control"
                  value={amountFinanced}
                  onChange={(e) => setAmountFinanced(e.target.value)}
                  required
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Payment Type <span style={{ color: '#d93025' }}>*</span></label>
                <select
                  className="form-control"
                  value={paymentType}
                  onChange={(e) => {
                    setPaymentType(e.target.value);
                    setAmountToBePaid(''); // Clear the amount when payment type changes
                  }}
                  required
                >
                  <option value="">Select Payment Type...</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>
              {paymentType && (
                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    {paymentType === 'Weekly' ? 'Weekly' : 'Monthly'} Amount to be Paid{' '}
                    <span style={{ color: '#d93025' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="form-control"
                    value={amountToBePaid}
                    onChange={(e) => setAmountToBePaid(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="col-md-6 mb-3">
                <label className="form-label">Loan Tenure (in months) <span style={{ color: '#d93025' }}>*</span></label>
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  value={loanTenure}
                  onChange={(e) => setLoanTenure(e.target.value)}
                  required
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Total Due <span style={{ color: '#d93025' }}>*</span></label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="form-control"
                  value={totalDue}
                  onChange={(e) => setTotalDue(e.target.value)}
                  required
                />
              </div>
            </div>

            <hr className="my-4" />

            {/* --- Consent Section --- */}
            <h4 className="mb-3">Consent</h4>

            {/* Disclaimer above consent checkbox */}
            <div
              className="alert alert-warning"
              role="alert"
              style={{ fontSize: "0.9rem" }}
            >
              Make sure you have carefully read the{" "}
              <a
                href="/docs/Onboarding_Info.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                Terms & Conditions
              </a>{" "}
              before giving your consent.
            </div>

            {/* Privacy policy consent checkbox with link */}
            <div className="mb-3 form-check">
              <input
                id="consent"
                type="checkbox"
                className="form-check-input"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required // Consent is now a required field
              />
              <label className="form-check-label" htmlFor="consent">
                I consent to the{" "}
                <a
                  href="/docs/Onboarding_Info.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Agreement/Terms & Conditions
                </a>
                .
              </label>
            </div>

            {/* --- Submission Area --- */}
            <div className="d-flex align-items-center gap-2 mt-4 pt-3 border-top">
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Verifying…' : 'Verify'}
                </button>
                {message && (
                  <div className={message.isError ? 'text-danger' : 'text-success'} style={{ marginLeft: 16 }}>
                    {message.text}
                  </div>
                )}
              </div>
          </form>
        );
      
      case 2:
        // OTP Verification View
        return (
          <form onSubmit={handleSubmit}>
            <h3 className="mb-4 border-bottom pb-3">Verify Phone Number</h3>
            <p className="text-muted">A verification code has been sent to **+254{phoneNumber}**. Please enter the code below to continue.</p>
            <div className="mb-3">
              <label className="form-label">Enter OTP <span style={{ color: '#d93025' }}>*</span></label>
              <input 
                type="text" 
                className="form-control" 
                value={otp} 
                onChange={(e) => setOtp(e.target.value)} 
                required 
                maxLength={6} 
              />
            </div>
            <div className="d-flex align-items-center gap-2 mt-4">
              <button type="submit" disabled={submitting} className="btn btn-primary">
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
              <button 
                type="button" 
                className="btn btn-light"
                onClick={() => setCurrentStep(1)}
              >
                Back
              </button>
            </div>
            {message && (
                <div className={message.isError ? 'text-danger mt-2' : 'text-success mt-2'}>
                  {message.text}
                </div>
              )}
          </form>
        );

      case 3:
        // Success Message View
        return (
          <div className="text-center p-5">
            <h3 className="text-success mb-3">✅ Success!</h3>
            <p className="lead">You have successfully submitted your information.</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', background: '#f1f3f4', padding: '32px 16px' }}>
      <div style={{ maxWidth: 900, width: '100%', background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(60,64,67,.1), 0 4px 8px rgba(60,64,67,.08)', padding: 28 }}>
        {renderForm()}
      </div>
    </div>
  );
}