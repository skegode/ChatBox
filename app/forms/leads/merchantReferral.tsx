"use client";

import React, { useEffect, useState } from "react";
import api from "../../../lib/api";

type Option = { id: string | number; name: string };

export default function MerchantReferralForm() {
  const [firstName, setFirstName] = useState("");
  const [otherName, setOtherName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [referrerPhone, setReferrerPhone] = useState("");
  const [phoneModel, setPhoneModel] = useState<string | number>("");
  const [county, setCounty] = useState<string | number>("");
  const [merchantId, setMerchantId] = useState<string | number>("");
  const [consent, setConsent] = useState(false);
  const [phoneModels, setPhoneModels] = useState<Option[]>([]);
  const [counties, setCounties] = useState<Option[]>([]);
  const [merchants, setMerchants] = useState<Option[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [submittedProspect, setSubmittedProspect] = useState<unknown | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const [ptResp, cResp, mResp] = await Promise.all([
          api.get("/api/Leads/GetPhoneModels"),
          api.get("/api/Leads/GetCounties"),
          api.get("/api/Merchants"),
        ]);
        if (!mounted) return;
        setPhoneModels(normalizeOptions(ptResp.data ?? ptResp));
        setCounties(normalizeOptions(cResp.data ?? cResp));
        setMerchants(normalizeOptions(mResp.data ?? mResp));
      } catch (err) {
        setMessage({ text: "Could not load form options. Refresh to try again.", isError: true });
      } finally {
        if (mounted) setLoadingOptions(false);
      }
    }
    loadOptions();
    return () => { mounted = false; };
  }, []);

  function normalizeOptions(input: unknown): Option[] {
    const list: unknown[] = Array.isArray(input)
      ? input
      : typeof input === "object" && input !== null && Array.isArray((input as { data?: unknown }).data)
      ? (input as { data: unknown[] }).data
      : [];
    return list.map((it) => {
      if (typeof it === "string") return { id: it, name: it };
      if (typeof it === "number") return { id: it, name: String(it) };
      if (typeof it === "object" && it !== null) {
        const obj = it as Record<string, unknown>;
        const id = obj.id ?? obj.value ?? obj.name ?? JSON.stringify(obj);
        const name = typeof obj.name === "string"
          ? obj.name
          : typeof obj.value === "string"
          ? obj.value
          : typeof obj.id === "string" || typeof obj.id === "number"
          ? String(obj.id)
          : JSON.stringify(obj);
        return { id: id as string | number, name };
      }
      return { id: String(it), name: String(it) };
    });
  }

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setMessage(null);
    if (!firstName.trim()) return setMessage({ text: "First name is required.", isError: true });
    if (!email.trim()) return setMessage({ text: "Email is required.", isError: true });
    if (!phone.trim()) return setMessage({ text: "Phone is required.", isError: true });
    if (!phoneModel) return setMessage({ text: "Select a phone model.", isError: true });
    if (!county) return setMessage({ text: "Select a county.", isError: true });
    if (!merchantId) return setMessage({ text: "Select a merchant.", isError: true });
    if (!consent) return setMessage({ text: "You must consent to the privacy policy to continue.", isError: true });
    if (submitting) return;
    const payload = {
      firstName: firstName.trim(),
      otherName: otherName.trim() || undefined,
      email: email.trim(),
      phone: `+254${phone.trim()}`,
      phoneModel: Number(phoneModel),
      county: Number(county),
      consent: consent,
      merchantId: Number(merchantId),
      ...(referrerPhone.trim() && { referrerPhone: referrerPhone.trim() })
    };
    try {
      setSubmitting(true);
      const res = await api.post("/api/Leads/SubmitMerchantReferralProspect", payload);
      setMessage({ text: "Submitted successfully." });
      setSubmittedProspect(res.data);
      setFirstName("");
      setOtherName("");
      setPhone("");
      setEmail("");
      setConsent(false);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setMessage({ text: errMsg || "Submission failed.", isError: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 bg-white" style={{ minHeight: "100vh", display: "flex", alignItems: "flex-start", justifyContent: "center", background: "#f1f3f4" }}>
      <form className="mx-auto" style={{ maxWidth: 600, width: "100%", background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(60,64,67,.1), 0 4px 8px rgba(60,64,67,.08)", padding: 28 }} onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">First Name <span style={{ color: "#d93025" }}>*</span></label>
          <input className="form-control" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" required />
        </div>
        <div className="mb-3">
          <label className="form-label">Other Name</label>
          <input className="form-control" value={otherName} onChange={e => setOtherName(e.target.value)} placeholder="Other name" />
        </div>
        <div className="mb-3">
          <label className="form-label">Phone Number <span style={{ color: "#d93025" }}>*</span></label>
          <div className="input-group">
            <span className="input-group-text">+254</span>
            <input className="form-control" inputMode="numeric" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="707123456" required />
          </div>
          <div className="form-text">Enter the local number without the leading zero.</div>
        </div>
        <div className="mb-3">
          <label className="form-label">Email Address <span style={{ color: "#d93025" }}>*</span></label>
          <input className="form-control" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
        </div>
        <div className="mb-3">
          <label className="form-label">Phone Type you Want <span style={{ color: "#d93025" }}>*</span></label>
          <select className="form-control" value={phoneModel} onChange={e => setPhoneModel(e.target.value)} required disabled={loadingOptions}>
            <option value="">{loadingOptions ? "Loading phone types…" : "Select phone model"}</option>
            {phoneModels.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">County of residence <span style={{ color: "#d93025" }}>*</span></label>
          <select className="form-control" value={county} onChange={e => setCounty(e.target.value)} required disabled={loadingOptions}>
            <option value="">{loadingOptions ? "Loading counties…" : "Select county"}</option>
            {counties.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Referring Merchant <span style={{ color: "#d93025" }}>*</span></label>
          <select className="form-control" value={merchantId} onChange={e => setMerchantId(e.target.value)} required disabled={loadingOptions}>
            <option value="">{loadingOptions ? "Loading merchants…" : "Select merchant"}</option>
            {merchants.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
          </select>
        </div>
        <div className="alert alert-warning" role="alert" style={{ fontSize: "0.9rem" }}>
          Make sure you have carefully read the <a href="/docs/Onboarding_Info.pdf" target="_blank" rel="noopener noreferrer">Terms & Conditions</a> before giving your consent.
        </div>
        <div className="mb-3 form-check">
          <input id="consent" type="checkbox" className="form-check-input" checked={consent} onChange={e => setConsent(e.target.checked)} />
          <label className="form-check-label" htmlFor="consent">
            I consent to the <a href="/docs/Onboarding_Info.pdf" target="_blank" rel="noopener noreferrer">Agreement/Terms & Conditions</a>.
          </label>
        </div>
        <div className="d-flex align-items-center gap-2 mt-4">
          <button type="submit" disabled={submitting} className="btn btn-primary" style={{ visibility: "visible" }}>{submitting ? "Submitting…" : "Submit"}</button>
          <button type="button" onClick={() => { setFirstName(""); setOtherName(""); setPhone(""); setEmail(""); setMessage(null); setConsent(false); }} className="btn btn-light" style={{ visibility: "visible" }}>Clear</button>
          {message && <div className={message.isError ? "text-danger" : "text-success"} style={{ marginLeft: 8 }}>{message.text}</div>}
        </div>
      </form>
      {submittedProspect && (
        <div className="mt-4 p-3 bg-light border rounded">
          <h5>Prospect Details</h5>
          <pre style={{ fontSize: "0.95em", whiteSpace: "pre-wrap" }}>{JSON.stringify(submittedProspect, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
