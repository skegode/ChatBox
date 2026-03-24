"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import api from "../../../../lib/api";
import type { AxiosError } from "axios";

type Option = { id: string | number; name: string };

function SearchableSelect(props: {
  id?: string;
  options: Option[];
  value: string | number | "";
  onChange: (v: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const {
    options,
    value,
    onChange,
    placeholder = "Select...",
    disabled,
    required,
  } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const filtered = query.trim()
    ? options.filter((o) =>
        o.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : options;

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(-1);
      // focus search on open for desktop; on mobile it still behaves gracefully
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [close]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0 && highlight < filtered.length) {
        onChange(filtered[highlight].id);
        close();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  const displayLabel =
    options.find((o) => String(o.id) === String(value))?.name ?? "";

  return (
    <div
      ref={rootRef}
      className="searchable-select"
      style={{ position: "relative", width: "100%" }}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="form-control d-flex align-items-center justify-content-between"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        style={{ textAlign: "left", gap: 8 }}
      >
        <span
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {displayLabel || placeholder}
        </span>
        <span aria-hidden style={{ marginLeft: 8 }}>
          ▾
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          style={{
            position: "absolute",
            zIndex: 9999,
            left: 0,
            right: 0,
            marginTop: 6,
            background: "#fff",
            border: "1px solid rgba(0,0,0,.12)",
            borderRadius: 6,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            maxHeight: 320,
            overflow: "auto",
          }}
        >
          <div style={{ padding: 8 }}>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              placeholder="Search..."
              className="form-control"
              aria-label="Search options"
              style={{ marginBottom: 8 }}
            />
            <ul
              role="listbox"
              aria-activedescendant={
                highlight >= 0 ? `opt-${highlight}` : undefined
              }
              style={{ listStyle: "none", margin: 0, padding: 0 }}
            >
              {filtered.length === 0 && (
                <li style={{ padding: "8px 10px", color: "#666" }}>
                  No results
                </li>
              )}
              {filtered.map((opt, i) => {
                const isHighlighted = i === highlight;
                const isSelected = String(opt.id) === String(value);
                return (
                  <li key={opt.id}>
                    <button
                      id={`opt-${i}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => {
                        onChange(opt.id);
                        close();
                      }}
                      className="d-flex align-items-center"
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 10px",
                        background: isHighlighted
                          ? "rgba(0,123,255,0.08)"
                          : "transparent",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {opt.name}
                      </span>
                      {isSelected && (
                        <span style={{ color: "#0d6efd", marginLeft: 8 }}>
                          ✓
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Hidden native input for form semantics */}
      <input type="hidden" value={String(value ?? "")} required={required} />
    </div>
  );
}

export default function LeadFormPage() {
  const rawParams = useParams() as Record<string, string | undefined> | null;
  const urlToken = rawParams?.referralToken ?? rawParams?.ReferralToken ?? "";

  const [firstName, setFirstName] = useState("");
  const [otherName, setOtherName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [phoneModel, setPhoneModel] = useState<string | number>("");
  const [county, setCounty] = useState<string | number>("");
  const [referralToken, setReferralToken] = useState<string>(urlToken);

  const [phoneModels, setPhoneModels] = useState<Option[]>([]);
  const [counties, setCounties] = useState<Option[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    isError?: boolean;
  } | null>(null);

  // Added consent state for privacy policy checkbox
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (urlToken) setReferralToken(urlToken);
  }, [urlToken]);

  function normalizeOptions(input: unknown): Option[] {
    const list: unknown[] = Array.isArray(input)
      ? input
      : typeof input === "object" &&
        input !== null &&
        Array.isArray((input as { data?: unknown }).data)
      ? (input as { data: unknown[] }).data
      : [];

    return list.map((it) => {
      if (typeof it === "string") return { id: it, name: it };
      if (typeof it === "number") return { id: it, name: String(it) };
      if (typeof it === "object" && it !== null) {
        const obj = it as Record<string, unknown>;
        const id = obj.id ?? obj.value ?? obj.name ?? JSON.stringify(obj);
        const name =
          typeof obj.name === "string"
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

  function getErrorMessage(err: unknown): string {
    if (
      typeof err === "object" &&
      err !== null &&
      "isAxiosError" in err &&
      (err as AxiosError).isAxiosError
    ) {
      const a = err as AxiosError;
      const data = a.response?.data as Record<string, unknown> | undefined;
      if (data) {
        if (typeof data.message === "string") return data.message;
        if (typeof data.error === "string") return data.error;
      }
      return a.message || "API error";
    }
    if (err instanceof Error) return err.message;
    return String(err);
  }

  useEffect(() => {
    let mounted = true;
    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const [ptResp, cResp] = await Promise.all([
          api.get("/api/Leads/GetPhoneModels"),
          api.get("/api/Leads/GetCounties"),
        ]);
        if (!mounted) return;
        const pts = normalizeOptions(ptResp.data ?? ptResp);
        const cnts = normalizeOptions(cResp.data ?? cResp);
        setPhoneModels(pts);
        setCounties(cnts);
        if (pts.length && !phoneModel) setPhoneModel(pts[0].id);
        if (cnts.length && !county) setCounty(cnts[0].id);
      } catch (err: unknown) {
        setMessage({
          text:
            getErrorMessage(err) ||
            "Could not load form options. Refresh to try again.",
          isError: true,
        });
      } finally {
        if (mounted) setLoadingOptions(false);
      }
    }
    loadOptions();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const validatePhone = (p: string) => /^\d{6,15}$/.test(p);

  async function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setMessage(null);

    if (!firstName.trim())
      return setMessage({ text: "First name is required.", isError: true });
    if (!otherName.trim())
      return setMessage({ text: "Other name is required.", isError: true });
    if (!phone.trim() || !validatePhone(phone.trim()))
      return setMessage({
        text: "Enter a valid phone number (digits only).",
        isError: true,
      });
    if (!email.trim() || !validateEmail(email.trim()))
      return setMessage({
        text: "Enter a valid email address.",
        isError: true,
      });
    if (!phoneModel)
      return setMessage({ text: "Select a phone model.", isError: true });
    if (!county) return setMessage({ text: "Select a county.", isError: true });

    // Ensure user consented to privacy policy
    if (!consent)
      return setMessage({
        text: "You must consent to the privacy policy to continue.",
        isError: true,
      });

    if (submitting) return;

    const payload = {
      firstName: firstName.trim(),
      otherName: otherName.trim(),
      email: email.trim(),
      phone: `+254${phone.trim()}`,
      phoneModel: Number(phoneModel),
      county: Number(county),
      consent: consent,
      referralToken: referralToken?.trim() || undefined,
    };

    try {
      setSubmitting(true);
      const res = await api.post("/api/Leads/SubmitClientReferralProspect", payload);
      const data = res.data;
      setMessage({ text: "Submitted successfully." });
      // Optionally, display all returned fields below the form
      setSubmittedProspect(data);
      setFirstName("");
      setOtherName("");
      setPhone("");
      setEmail("");
      setConsent(false);
    } catch (err: unknown) {
      setMessage({ text: getErrorMessage(err), isError: true });
    } finally {
      setSubmitting(false);
    }
  }

  // State to hold submitted prospect details
  const [submittedProspect, setSubmittedProspect] = useState<any | null>(null);

  // Consistent styles with dashboard pages
  return (
    <div
      className="p-4 bg-white"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        background: "#f1f3f4",
      }}
    >
      <form
        className="mx-auto"
        style={{
          maxWidth: 600,
          width: "100%",
          background: "#fff",
          borderRadius: 8,
          boxShadow:
            "0 1px 3px rgba(60,64,67,.1), 0 4px 8px rgba(60,64,67,.08)",
          padding: 28,
        }}
        onSubmit={handleSubmit}
      >
        <div className="mb-3">
          <label className="form-label">
            First Name <span style={{ color: "#d93025" }}>*</span>
          </label>
          <input
            className="form-control"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">
            Other Name <span style={{ color: "#d93025" }}>*</span>
          </label>
          <input
            className="form-control"
            value={otherName}
            onChange={(e) => setOtherName(e.target.value)}
            placeholder="Other name"
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">
            Phone Number <span style={{ color: "#d93025" }}>*</span>
          </label>
          <div className="input-group">
            <span className="input-group-text">+254</span>
            <input
              className="form-control"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="707123456"
              required
            />
          </div>
          <div className="form-text">
            Enter the local number without the leading zero.
          </div>
        </div>
        <div className="mb-3">
          <label className="form-label">
            Email Address <span style={{ color: "#d93025" }}>*</span>
          </label>
          <input
            className="form-control"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label">
            Phone Type you Want <span style={{ color: "#d93025" }}>*</span>
          </label>
          <SearchableSelect
            options={phoneModels}
            value={phoneModel}
            onChange={(v) => setPhoneModel(v)}
            placeholder={
              loadingOptions ? "Loading phone types…" : "Select phone model"
            }
            disabled={loadingOptions}
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label">
            County of residence <span style={{ color: "#d93025" }}>*</span>
          </label>
          <SearchableSelect
            options={counties}
            value={county}
            onChange={(v) => setCounty(v)}
            placeholder={loadingOptions ? "Loading counties…" : "Select county"}
            disabled={loadingOptions}
            required
          />
        </div>

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

        <div className="d-flex align-items-center gap-2 mt-4">
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{ visibility: "visible" }}
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
          <button
            type="button"
            onClick={() => {
              setFirstName("");
              setOtherName("");
              setPhone("");
              setEmail("");
              setMessage(null);
              setConsent(false);
            }}
            className="btn btn-light"
            style={{ visibility: "visible" }}
          >
            Clear
          </button>
          {message && (
            <div
              className={message.isError ? "text-danger" : "text-success"}
              style={{ marginLeft: 8 }}
            >
              {message.text}
            </div>
          )}
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
