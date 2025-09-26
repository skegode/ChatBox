"use client";
import { useState, useEffect, useRef } from "react";
import api from "../../../lib/api";
import { useAuth } from "../../../components/providers/AuthProvider";
import { PERMISSIONS } from "../../../lib/permissions";
import ProtectedRoute from '../../../components/ProtectedRoute';

// --- SVG Icon Components ---
const PaperclipIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0z"/>
    </svg>
);

const PaperPlaneIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083l6-15Zm-1.833 1.89L6.637 10.07l-4.99-3.176 14.13-6.393Z"/>
    </svg>
);
// --- End SVG Icon Components ---

type Contact = {
  id: string;
  name: string;
  waId?: string;
};

type ApiContact = {
  waId?: string;
  contactId?: string;
  name?: string;
};

type Conversation = {
  contactId: string;
  contactName?: string | null;
  lastMessageText?: string | null;
  lastMessageTime?: string | Date | null;
  unreadCount?: number;
  messageCount?: number;
};

type Template = {
  name: string;
  languageCode: string; // Updated from language_code
  status: string;
  components: string; // The backend sends this as a JSON string
};

type ParsedTemplateComponent = {
  type: string;
  text?: string;
  format?: string;
}

type TemplateComponent = {
  type: string;
  parameters?: Array<{
    type: string;
    text: string;
  }>;
};

type CreateTemplateComponent = {
  type: string;
  format?: string;
  text: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
};

type Language = {
  code: string;
  name: string;
};

// Partial list of supported languages
const supportedLanguages: Language[] = [
    { code: "af", name: "Afrikaans" }, { code: "sq", name: "Albanian" }, { code: "ar", name: "Arabic" },
    { code: "az", name: "Azerbaijani" }, { code: "bn", name: "Bengali" }, { code: "bg", name: "Bulgarian" },
    { code: "ca", name: "Catalan" }, { code: "zh_CN", name: "Chinese (CHN)" }, { code: "zh_HK", name: "Chinese (HKG)" },
    { code: "zh_TW", name: "Chinese (TAI)" }, { code: "hr", name: "Croatian" }, { code: "cs", name: "Czech" },
    { code: "da", name: "Danish" }, { code: "nl", name: "Dutch" }, { code: "en", name: "English" },
    { code: "en_GB", name: "English (UK)" }, { code: "en_US", name: "English (US)" }, { code: "et", name: "Estonian" },
    { code: "fil", name: "Filipino" }, { code: "fi", name: "Finnish" }, { code: "fr", name: "French" },
    { code: "ka", name: "Georgian" }, { code: "de", name: "German" }, { code: "el", name: "Greek" },
    { code: "gu", name: "Gujarati" }, { code: "ha", name: "Hausa" }, { code: "he", name: "Hebrew" },
    { code: "hi", name: "Hindi" }, { code: "hu", name: "Hungarian" }, { code: "id", name: "Indonesian" },
    { code: "ga", name: "Irish" }, { code: "it", name: "Italian" }, { code: "ja", name: "Japanese" },
    { code: "kn", name: "Kannada" }, { code: "kk", name: "Kazakh" }, { code: "ko", name: "Korean" },
    { code: "lt", name: "Lithuanian" }, { code: "mk", name: "Macedonian" }, { code: "ms", name: "Malay" },
    { code: "ml", name: "Malayalam" }, { code: "mr", name: "Marathi" }, { code: "nb", name: "Norwegian" },
    { code: "fa", name: "Persian" }, { code: "pl", name: "Polish" }, { code: "pt_BR", name: "Portuguese (BR)" },
    { code: "pt_PT", name: "Portuguese (POR)" }, { code: "pa", name: "Punjabi" }, { code: "ro", name: "Romanian" },
    { code: "ru", name: "Russian" }, { code: "sr", name: "Serbian" }, { code: "sk", name: "Slovak" },
    { code: "sl", name: "Slovenian" }, { code: "es", name: "Spanish" }, { code: "es_AR", name: "Spanish (ARG)" },
    { code: "es_ES", name: "Spanish (SPA)" }, { code: "es_MX", name: "Spanish (MEX)" }, { code: "sw", name: "Swahili" },
    { code: "sv", name: "Swedish" }, { code: "ta", name: "Tamil" }, { code: "te", name: "Telugu" },
    { code: "th", name: "Thai" }, { code: "tr", name: "Turkish" }, { code: "uk", name: "Ukrainian" },
    { code: "ur", name: "Urdu" }, { code: "uz", name: "Uzbek" }, { code: "vi", name: "Vietnamese" },
    { code: "zu", name: "Zulu" },
];

const categories = ["AUTHENTICATION", "MARKETING", "UTILITY"];

// Helper function to format WhatsApp phone numbers to international format
const formatWhatsAppNumber = (number: string): string => {
  const cleaned = number.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return `+${cleaned.substring(2)}`;
  return `+${cleaned}`;
};

// Helper function to validate WhatsApp phone numbers
const isValidWhatsAppNumber = (number: string): boolean => {
  const formatted = formatWhatsAppNumber(number);
  return /^\+\d{8,15}$/.test(formatted);
};

// Helper function to detect if a name is actually a phone number
function digitsOnly(s?: string) {
  return (s ?? "").replace(/\D/g, "");
}

function contactNameLooksLikePhone(candidate?: string, contactId?: string) {
  if (!candidate) return false;
  const a = digitsOnly(candidate);
  if (!a) return false;
  const b = digitsOnly(contactId ?? "");
  if (!b) return true;
  return a === b || a.endsWith(b) || b.endsWith(a);
}

function getNumBodyParams(template: Template | undefined): number {
    if (!template) return 0;
    try {
        const components: ParsedTemplateComponent[] = JSON.parse(template.components);
        const body = components.find(c => c.type.toUpperCase() === 'BODY');
        if (!body || !body.text) return 0;
        const matches = body.text.match(/{{\d+}}/g) || [];
        const nums = matches.map(m => parseInt(m.replace(/{{|}}/g, '')));
        return nums.length > 0 ? Math.max(...nums) : 0;
    } catch (e) {
        console.error("Failed to parse template components:", template.components, e);
        return 0;
    }
}

function RegularMessageInput({ onSend }: { onSend: (text: string, file?: File | null) => Promise<boolean> }) {
    const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  const handleSend = async () => {
    const success = await onSend(text, file);
    if (success) {
      setText("");
      setFile(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="d-flex flex-column gap-2">
      {file && (
        <div className="alert alert-info d-flex align-items-center justify-content-between">
          <span><i className="fas fa-file me-2"></i>{file.name}</span>
          <button className="btn btn-sm btn-close" onClick={() => setFile(null)}></button>
        </div>
      )}
      <textarea
        ref={textareaRef}
        className="form-control"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your broadcast message..."
        rows={1}
        style={{
          overflow: "hidden",
          resize: "none",
          minHeight: "40px",
          maxHeight: "200px",
        }}
      />
      <div className="d-flex justify-content-end">
        <input
          type="file"
          id="fileUpload"
          className="d-none"
          onChange={handleFileChange}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
        />
        <label htmlFor="fileUpload" className="btn btn-outline-secondary me-2">
          <PaperclipIcon />
        </label>
        <button className="btn btn-primary" onClick={handleSend}>
          <PaperPlaneIcon />
        </button>
      </div>
    </div>
  );
}

function TemplateMessageInput({ templates, onSend, onCreateTemplate, onSyncTemplates }: { templates: Template[]; onSend: (templateName: string, languageCode: string, components: TemplateComponent[]) => Promise<boolean>; onCreateTemplate: () => void; onSyncTemplates: () => void }) {
  const [templateName, setTemplateName] = useState("");
  const [languageCode, setLanguageCode] = useState("");
  const [paramValues, setParamValues] = useState<string[]>([]);

  const uniqueTemplateNames = [...new Set(templates.map(t => t.name))];

  const availableLanguages = templates
    .filter(t => t.name === templateName)
    .map(t => ({ code: t.languageCode, status: t.status }));

  useEffect(() => {
    if (availableLanguages.length > 0 && !languageCode) {
      const approved = availableLanguages.find(l => l.status === 'APPROVED');
      setLanguageCode(approved ? approved.code : availableLanguages[0]?.code || "");
    }
  }, [templateName, availableLanguages, languageCode]);

  useEffect(() => {
    if (languageCode) {
      const selectedTemp = templates.find(t => t.name === templateName && t.languageCode === languageCode);
      const numParams = getNumBodyParams(selectedTemp);
      setParamValues(Array(numParams).fill(''));
    }
  }, [languageCode, templateName, templates]);

  const updateParam = (index: number, value: string) => {
    const newParams = [...paramValues];
    newParams[index] = value;
    setParamValues(newParams);
  };

    const handleSend = async () => {
    const components: TemplateComponent[] = [
      {
        type: "body",
        parameters: paramValues.map(text => ({ type: "text", text }))
      }
    ];
    
    const success = await onSend(templateName, languageCode, components);
    if (success) {
      setTemplateName("");
      setLanguageCode("");
      setParamValues([]);
    }
    return success;
  };

  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex justify-content-between">
        <select
          className="form-select me-2"
          value={templateName}
          onChange={(e) => {
            setTemplateName(e.target.value);
            setLanguageCode("");
            setParamValues([]);
          }}
        >
          <option value="">Select Template</option>
          {uniqueTemplateNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <div className="d-flex gap-1">
          <button className="btn btn-sm btn-outline-info" onClick={onSyncTemplates}>
            <i className="fas fa-sync me-1"></i>
            Sync
          </button>
          <button className="btn btn-sm btn-outline-primary" onClick={onCreateTemplate}>
            Create New
          </button>
        </div>
      </div>
      {templateName && (
        <select
          className="form-select"
          value={languageCode}
          onChange={(e) => setLanguageCode(e.target.value)}
        >
          <option value="">Select Language</option>
          {availableLanguages.map(lang => (
            <option key={lang.code} value={lang.code}>
              {lang.code} ({lang.status})
            </option>
          ))}
        </select>
      )}
      {paramValues.map((val, index) => (
        <input
          key={index}
          type="text"
          className="form-control"
          placeholder={`Parameter {{${index + 1}}}`}
          value={val}
          onChange={(e) => updateParam(index, e.target.value)}
        />
      ))}
      <div className="d-flex justify-content-end">
        <button
          className="btn btn-primary"
          onClick={handleSend}
          disabled={!templateName || !languageCode || paramValues.some(v => v === '')}
        >
          <PaperPlaneIcon />
        </button>
      </div>
    </div>
  );
}

function CreateTemplateModal({ show, onClose, onCreate }: { show: boolean; onClose: () => void; onCreate: () => void }) {
  const [name, setName] = useState("");
  const [languageCode, setLanguageCode] = useState("");
  const [category, setCategory] = useState("");
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [headerExample, setHeaderExample] = useState("");
  const [bodyExamples, setBodyExamples] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const headerHasVar = /{{1}}/.test(headerText);
    if (!headerHasVar) {
      setHeaderExample("");
    }

    const matches = bodyText.match(/{{\d+}}/g) || [];
    const numParams = matches.length > 0 ? Math.max(...matches.map(m => parseInt(m.replace(/{{|}}/g, "")))) : 0;
    setBodyExamples(prev => {
      const newEx = Array(numParams).fill("");
      for (let i = 0; i < Math.min(prev.length, numParams); i++) {
        newEx[i] = prev[i];
      }
      return newEx;
    });
  }, [headerText, bodyText]);

  const handleSubmit = async () => {
    if (!name || !languageCode || !category || !bodyText) {
      setError("All required fields must be filled");
      return;
    }
    
    const components: CreateTemplateComponent[] = [];

     if (headerText) {
      const headerComp: CreateTemplateComponent = {
        type: "HEADER",
        format: "TEXT",
        text: headerText,
      };
     if (/{{1}}/.test(headerText)) {
        if (!headerExample) {
          setError("Provide example for header variable");
          return;
        }
        headerComp.example = { header_text: [headerExample] };
      }
      components.push(headerComp);
    }

    const bodyComp: CreateTemplateComponent = {
      type: "BODY",
      text: bodyText,
    };
    const numBodyParams = bodyExamples.length;
    if (numBodyParams > 0) {
      if (bodyExamples.some(e => !e)) {
        setError("Provide examples for all body variables");
        return;
      }
      bodyComp.example = { body_text: [bodyExamples] };
    }
    components.push(bodyComp);

    if (footerText) {
      components.push({
        type: "FOOTER",
        text: footerText,
      });
    }

    setLoading(true);
    setError(null);

    try {
      await api.post("/api/Messages/templates", {
        Name: name,
        LanguageCode: languageCode,
        Category: category,
        Components: components,
      });
      onCreate();
      onClose();
    } catch (err) {
      console.error("Error creating template:", err);
      setError("Failed to create template");
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <>
      <div className="modal-backdrop fade show"></div>
      <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Create New Template</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="mb-3">
                <label className="form-label">Name (lowercase letters, numbers, underscores only)</label>
                <input type="text" className="form-control" value={name} onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
              </div>
              <div className="mb-3">
                <label className="form-label">Language</label>
                <select className="form-select" value={languageCode} onChange={e => setLanguageCode(e.target.value)}>
                  <option value="">Select Language</option>
                  {supportedLanguages.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.name} ({lang.code})</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">Category</label>
                <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>              
              <div className="mb-3">
                <label className="form-label">Header Text (optional, use {`{{1}}`} for variable)</label>
                <input type="text" className="form-control" value={headerText} onChange={e => setHeaderText(e.target.value)} />
                {/{{1}}/.test(headerText) && (
                  <input type="text" className="form-control mt-2" placeholder={`Example for {{1}}`} value={headerExample} onChange={e => setHeaderExample(e.target.value)} />
                )}
              </div>
              <div className="mb-3">
                <label className="form-label">Body Text (use {`{{1}}`}, {`{{2}}`}, etc. for variables)</label>
                <textarea className="form-control" value={bodyText} onChange={e => setBodyText(e.target.value)} />
                {bodyExamples.map((ex, i) => (
                  <input key={i} type="text" className="form-control mt-2" placeholder={`Example for {{${i+1}}}`} value={ex} onChange={e => {
                    const newEx = [...bodyExamples];
                    newEx[i] = e.target.value;
                    setBodyExamples(newEx);
                  }} />
                ))}
              </div>
              <div className="mb-3">
                <label className="form-label">Footer Text (optional, no variables)</label>
                <input type="text" className="form-control" value={footerText} onChange={e => setFooterText(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function BroadcastPage() {
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([]);
  const [newContactId, setNewContactId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showContactManager, setShowContactManager] = useState(false);
  const [isTemplateMode, setIsTemplateMode] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
        fetchContacts();
        fetchTemplates();
    }
  }, [isAuthenticated]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const response = await api.get("api/Messages");

      if (Array.isArray(response.data)) {
        const conversations: Conversation[] = response.data;
        const uniqueContacts = new Map<string, Contact>();

        conversations.forEach((chat) => {
          const contactId = chat.contactId;
          if (!contactId) return;

          const rawName = chat.contactName;
          const isPhoneLike = contactNameLooksLikePhone(rawName ?? undefined, contactId);
          const displayName = rawName && !isPhoneLike ? rawName : contactId;

          uniqueContacts.set(contactId, {
            id: contactId.startsWith("+") ? contactId : `+${contactId}`,
            name: displayName,
          });
        });
        setAvailableContacts(Array.from(uniqueContacts.values()));
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setError("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await api.get("api/Messages/templates");
      setTemplates(response.data || []); 
    } catch (err) {
      console.error("Error fetching templates:", err);
      setError("Failed to load templates");
    }
  };

  const syncTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      await api.post("/api/Messages/templates/sync");
      await fetchTemplates(); // Refresh the templates list after sync
      setSuccess("Templates synced successfully");
    } catch (err) {
      console.error("Error syncing templates:", err);
      setError("Failed to sync templates");
    } finally {
      setLoading(false);
    }
  };

  const addNewContact = () => {
    if (!newContactId || newContactId.trim() === "") {
      setError("Please enter a valid phone number");
      return;
    }

    const formattedId = formatWhatsAppNumber(newContactId.trim());

    if (!isValidWhatsAppNumber(formattedId)) {
      setError("Please enter a valid WhatsApp number in international format");
      return;
    }

    if (selectedContacts.some((c) => c.id === formattedId)) {
      setError("This contact is already added");
      return;
    }

    setSelectedContacts([ ...selectedContacts, { id: formattedId, name: formattedId }]);
    setNewContactId("");
    setError(null);
  };

  const handleSelectContact = (contact: Contact, selected: boolean) => {
    if (selected) {
      setSelectedContacts((prev) => [...prev, contact]);
    } else {
      setSelectedContacts((prev) => prev.filter((c) => c.id !== contact.id));
    }
  };

  const removeAllContacts = () => {
    if (selectedContacts.length > 0) {
        setSelectedContacts([]);
    }
  };

  const selectAllContacts = () => {
    const notYetSelected = availableContacts.filter(
      (contact) => !selectedContacts.some((selected) => selected.id === contact.id)
    );
    setSelectedContacts([...selectedContacts, ...notYetSelected]);
  };

  const handleSendRegularMessage = async (text: string, file?: File | null): Promise<boolean> => {
      if (selectedContacts.length === 0) {
          setError("Please select at least one contact");
          return false;
      }
      if (!text && !file) {
          setError("Please enter a message or select a file");
          return false;
      }
  
      setSending(true);
      setError(null);
      setSuccess(null);
  
      try {
          let mediaId = null;
          let mediaType = null;
          let mediaLocalPath = null;
          let mediaFileName = null;
  
          if (file) {
              const fd = new FormData();
              fd.append("file", file);
              const mediaResp = await api.post("/api/Messages/media", fd);
              const mediaMeta = mediaResp?.data;
              if (mediaMeta) {
                  mediaId = mediaMeta.mediaId;
                  mediaType = mediaMeta.mediaType;
                  mediaLocalPath = mediaMeta.mediaLocalPath;
                  mediaFileName = mediaMeta.fileName;
              }
          }
  
          const results = await Promise.allSettled(
              selectedContacts.map((contact) => {
                  const payload = {
                      ContactId: contact.id.replace(/^\+/, ""),
                      MessageText: text,
                      MediaId: mediaId,
                      MediaType: mediaType,
                      MediaLocalPath: mediaLocalPath,
                      MediaFileName: mediaFileName,
                  };
                  return api.post("/api/Messages/send", payload);
              })
          );
  
          const successful = results.filter((r) => r.status === "fulfilled").length;
          const failed = results.filter((r) => r.status === "rejected").length;
  
          setSuccess(`Successfully sent to ${successful} contacts${failed > 0 ? ` (${failed} failed)` : ""}`);
          if (failed === 0) {
              setSelectedContacts([]);
          }
          return failed === 0;
      } catch (err) {
          console.error("Error sending regular broadcast:", err);
          setError("Failed to send broadcast message");
          return false;
      } finally {
          setSending(false);
      }
  };
  
  const handleSendTemplateMessage = async (templateName: string, languageCode: string, components: TemplateComponent[]): Promise<boolean> => {
      if (selectedContacts.length === 0) {
          setError("Please select at least one contact");
          return false;
      }
  
      setSending(true);
      setError(null);
      setSuccess(null);
  
      try {
          const results = await Promise.allSettled(
              selectedContacts.map((contact) => {
                  const payload = {
                      ContactId: contact.id.replace(/^\+/, ""),
                      TemplateName: templateName,
                      LanguageCode: languageCode,
                      Components: components,
                  };
                  return api.post("/api/Messages/send-template", payload);
              })
          );
  
          const successful = results.filter((r) => r.status === "fulfilled").length;
          const failed = results.filter((r) => r.status === "rejected").length;
  
          setSuccess(`Template sent to ${successful} contacts${failed > 0 ? ` (${failed} failed)` : ""}`);
          if (failed === 0) {
              setSelectedContacts([]);
          }
          return failed === 0;
      } catch (err) {
          console.error("Error sending template broadcast:", err);
          setError("Failed to send template message");
          return false;
      } finally {
          setSending(false);
      }
  };

  return (
    <ProtectedRoute requiredPermissions={['adminOnly']} requiredPolicy={PERMISSIONS.POLICY_ADMIN_ONLY}>
      <div className="w-100 overflow-hidden position-relative">
        <div className="p-3 p-lg-4 border-bottom user-chat-topbar">
          <h4 className="mb-0"><i className="ri-broadcast-line me-2" />Broadcast Message</h4>
        </div>

        <div className="chat-conversation p-3 p-lg-4" style={{ height: 'calc(100vh - 140px)', overflowY: 'auto' }}>
          {error && (
            <div className="alert alert-danger alert-dismissible fade show mb-3" role="alert">
              <i className="fas fa-exclamation-triangle me-2"></i>
              {error}
              <button type="button" className="btn-close" onClick={() => setError(null)}></button>
            </div>
          )}
          {success && (
            <div className="alert alert-success alert-dismissible fade show mb-3" role="alert">
              <i className="fas fa-check-circle me-2"></i>
              {success}
               <button type="button" className="btn-close" onClick={() => setSuccess(null)}></button>
            </div>
          )}

          <div className="row g-4">
            <div className="col-lg-5">
              <div className="card h-100 shadow-sm">
                <div className="card-header bg-primary text-white">
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="mb-0">
                      <i className="fas fa-users me-2"></i>
                      Select Recipients
                    </h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-light text-primary fw-semibold"
                      onClick={() => setShowContactManager(true)}
                    >
                      <i className="fas fa-cog me-1"></i>
                      Manage ({selectedContacts.length})
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  <div className="mb-4">
                    <label className="form-label fw-semibold">
                      <i className="fas fa-plus-circle me-2 text-success"></i>
                      Quick Add Phone Number
                    </label>
                    <div className="input-group">
                      <span className="input-group-text">
                        <i className="fab fa-whatsapp text-success"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        value={newContactId}
                        onChange={(e) => setNewContactId(e.target.value)}
                        placeholder="e.g. +254 712 345 678"
                        onKeyPress={(e) => {
                          if (e.key === "Enter") addNewContact();
                        }}
                      />
                      <button className="btn btn-success" onClick={addNewContact} type="button">
                        <i className="fas fa-plus"></i>
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <label className="form-label fw-semibold mb-0">
                        <i className="fas fa-address-book me-2 text-info"></i>
                        Your Contacts
                      </label>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-info"
                        onClick={selectAllContacts}
                        disabled={loading}
                      >
                        <i className="fas fa-check-double me-1"></i>
                        Select All
                      </button>
                    </div>
                    
                    <div
                      className="border rounded-3 p-3 bg-light"
                      style={{ maxHeight: "350px", overflowY: "auto" }}
                    >
                      {loading ? (
                        <div className="text-center py-4">
                          <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                          <span className="text-muted">Loading contacts...</span>
                        </div>
                      ) : availableContacts.length === 0 ? (
                        <div className="text-center py-4 text-muted">
                          <i className="fas fa-user-slash fs-2 mb-2 d-block"></i>
                          <p className="mb-0">No saved contacts found</p>
                        </div>
                      ) : (
                        <div className="row g-2">
                          {availableContacts.map((contact, index) => {
                            const isSelected = selectedContacts.some((c) => c.id === contact.id);
                            return (
                              <div key={`available-${contact.id}-${index}`} className="col-12">
                                <div className={`card border ${isSelected ? 'border-success bg-light' : 'border-light'} mb-1`}>
                                  <div className="card-body py-2 px-3">
                                    <div className="form-check mb-0">
                                      <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id={`contact-${contact.id}-${index}`}
                                        checked={isSelected}
                                        onChange={(e) => handleSelectContact(contact, e.target.checked)}
                                      />
                                      <label className="form-check-label fw-medium" htmlFor={`contact-${contact.id}-${index}`}>
                                        <div className="d-flex align-items-center">
                                          <i className="fas fa-user-circle text-muted me-2"></i>
                                          <div>
                                            <div>{contact.name}</div>
                                            {contact.name !== contact.id && (
                                              <small className="text-muted">{contact.id}</small>
                                            )}
                                          </div>
                                        </div>
                                      </label>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-7">
              <div className="card h-100 shadow-sm">
                <div className="card-header bg-success text-white">
                  <h6 className="mb-0">
                    <i className="fas fa-edit me-2"></i>
                    Compose Broadcast Message
                  </h6>
                </div>
                <div className="card-body d-flex flex-column justify-content-center">
                  <div className="d-flex justify-content-end mb-3">
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="templateSwitch"
                        checked={isTemplateMode}
                        onChange={(e) => setIsTemplateMode(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="templateSwitch">
                        Send as Template
                      </label>
                    </div>
                  </div>

                  <div className="chat-input-wrapper border rounded-3 bg-white p-3 mx-auto" style={{ width: "100%", maxWidth: "600px" }}>
                    {isTemplateMode ? (
                      <TemplateMessageInput
                        templates={templates}
                        onSend={handleSendTemplateMessage}
                        onCreateTemplate={() => setShowTemplateModal(true)}
                        onSyncTemplates={syncTemplates}
                      />
                    ) : (
                      <RegularMessageInput
                        onSend={handleSendRegularMessage}
                      />
                    )}
                    {sending && (
                      <div className="text-center mt-3">
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        <small className="text-muted">Sending broadcast to {selectedContacts.length} recipient{selectedContacts.length !== 1 ? 's' : ''}...</small>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showContactManager && (
          <>
            <div className="modal-backdrop fade show"></div>
            <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1} role="dialog">
              <div className="modal-dialog modal-lg modal-dialog-scrollable">
                <div className="modal-content">
                  <div className="modal-header bg-primary text-white">
                    <h5 className="mb-0">
                      <i className="fas fa-users-cog me-2"></i>
                      Manage Recipients
                    </h5>
                    <button type="button" className="btn-close btn-close-white" onClick={() => setShowContactManager(false)}></button>
                  </div>

                  <div className="modal-body">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="mb-0">
                        <i className="fas fa-check-circle text-success me-2"></i>
                        Selected Recipients ({selectedContacts.length})
                      </h6>
                      {selectedContacts.length > 0 && (
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={removeAllContacts}>
                          <i className="fas fa-trash me-1"></i>
                          Clear All
                        </button>
                      )}
                    </div>

                    {selectedContacts.length === 0 ? (
                      <div className="text-center py-5">
                        <i className="fas fa-user-plus fs-1 text-muted mb-3 d-block"></i>
                        <h6 className="text-muted">No recipients selected yet</h6>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-hover align-middle">
                          <thead className="table-light sticky-top">
                            <tr>
                              <th><i className="fas fa-user me-1"></i> Name</th>
                              <th><i className="fas fa-phone me-1"></i> Contact ID</th>
                              <th style={{ width: "100px" }}><i className="fas fa-cog me-1"></i> Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedContacts.map((contact, index) => (
                              <tr key={`manage-${contact.id}-${index}`}>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <i className="fas fa-user-circle text-muted me-2"></i>
                                    <span className="fw-medium">{contact.name}</span>
                                  </div>
                                </td>
                                <td>
                                  <code className="text-muted">{contact.id}</code>
                                </td>
                                <td>
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => setSelectedContacts((prev) => prev.filter((c) => c.id !== contact.id))}
                                  >
                                    <i className="fas fa-times"></i>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowContactManager(false)}>
                      <i className="fas fa-times me-1"></i>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <CreateTemplateModal
          show={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          onCreate={fetchTemplates}
        />
      </div>
    </ProtectedRoute>
  );
}