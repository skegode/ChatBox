"use client";
import { useState, useEffect, useRef } from "react";
import api from "../../../lib/api";
import { useAuth } from "../../../components/providers/AuthProvider";
import { PERMISSIONS } from "../../../lib/permissions";
import ProtectedRoute from '../../../components/ProtectedRoute';
// @ts-expect-error - react-csv doesn't have official TypeScript definitions
import { CSVLink } from "react-csv";
import Papa from 'papaparse';

// Add Bootstrap Modal typings so we don't use `any`
declare global {
  interface BootstrapModalInstance {
    show?: () => void;
    hide?: () => void;
  }
  interface BootstrapModalConstructor {
    getOrCreateInstance?: (el: Element | null) => BootstrapModalInstance | undefined;
  }
  interface BootstrapStatic {
    Modal?: BootstrapModalConstructor;
  }
  interface Window {
    bootstrap?: BootstrapStatic;
  }
}

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

const CsvIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M4.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-7zm7 11.5a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v11z"/>
        <path d="M6.354 9.854a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 0-.708l2-2a.5.5 0 0 1 .708.708L4.707 7.5l1.647 1.646a.5.5 0 0 1 0 .708zm3.292 0a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0 0-.708l-2-2a.5.5 0 0 0-.708.708L11.293 7.5 9.646 9.146a.5.5 0 0 0 0 .708z"/>
    </svg>
);

// --- End SVG Icon Components ---

type Contact = {
  id: string;
  name: string;
  waId?: string;
  variables?: { [key: string]: string };
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
  id: number;
  name: string;
  languageCode: string;
  category: string;
  components: string;
  variablesInfo?: string;
};

type TemplateVariable = {
  component: string;
  index: number;
  placeholder: string;
  example?: string;
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

type TemplateRecipient = {
  phoneNumber: string;
  variables: string[];
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

// Helper function to parse template components and extract variables
function parseTemplateVariables(template: Template): TemplateVariable[] {
  if (!template || !template.components) return [];
  
  try {
    // First check if variablesInfo is available from the updated backend
    if (template.variablesInfo) {
      const variables = JSON.parse(template.variablesInfo);
      return Array.isArray(variables) ? variables : [];
    }
    
    // Fallback to parsing components
    const components = JSON.parse(template.components);
    const variables: TemplateVariable[] = [];
    
    components.forEach((component: ParsedTemplateComponent) => {
      if (!component.type || !component.text) return;
      
      const componentType = component.type.toUpperCase();
      const text = component.text;
      
      const matches = text.match(/{{\d+}}/g);
      if (!matches) return;
      
      matches.forEach(match => {
        const index = parseInt(match.replace(/{{|}}/g, ''));
        variables.push({
          component: componentType.toLowerCase(),
          index: index,
          placeholder: match
        });
      });
    });
    
    return variables;
  } catch (e) {
    console.error("Failed to parse template variables:", e);
    return [];
  }
}

// Helper function to get template preview text with placeholders
function getTemplatePreviewText(template: Template): { header?: string, body?: string, footer?: string } {
  if (!template || !template.components) return {};
  
  try {
    const components = JSON.parse(template.components);
    const result: { header?: string, body?: string, footer?: string } = {};
    
    components.forEach((component: ParsedTemplateComponent) => {
      if (!component.type || !component.text) return;
      
      const type = component.type.toLowerCase();
      if (type === 'header') result.header = component.text;
      else if (type === 'body') result.body = component.text;
      else if (type === 'footer') result.footer = component.text;
    });
    
    return result;
  } catch (e) {
    console.error("Failed to get template preview text:", e);
    return {};
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

// Add proper CSV data types
type CsvDataRow = {
  phoneNumber: string;
  [key: string]: string; // for variable_1, variable_2, etc.
};

type CsvTemplateData = (string | CsvDataRow)[][]; // Changed to be array of arrays


function TemplateMessageInput({ 
  templates, 
  contacts, 
  onSend, 
  onCreateTemplate, 
  onSyncTemplates,
  onUpdateContactVariables
}: {   
   templates: Template[]; 
  contacts: Contact[];
  onSend: (templateName: string, languageCode: string, recipients: TemplateRecipient[]) => Promise<boolean>;
  onCreateTemplate: () => void; 
  onSyncTemplates: () => void;
  onUpdateContactVariables: (contactId: string, variableName: string, value: string) => void;
}) {

  const [templateName, setTemplateName] = useState("");
  const [languageCode, setLanguageCode] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showPersonalization, setShowPersonalization] = useState(false);
  const [loading, setLoading] = useState(false);
  const [csvData, setCsvData] = useState<CsvTemplateData>([]);
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
 

  // Get unique template names for dropdown
  const uniqueTemplateNames = [...new Set(templates.map(t => t.name))];

  // Get available language codes for the selected template name
  const availableLanguages = templates
    .filter(t => t.name === templateName)
    .map(t => ({ code: t.languageCode, status: 'APPROVED' }));

  // Get variables for the selected template
  const templateVariables = selectedTemplate ? parseTemplateVariables(selectedTemplate) : [];
  const templatePreview = selectedTemplate ? getTemplatePreviewText(selectedTemplate) : {};

  // Effect to handle template and language selection
  useEffect(() => {
    if (availableLanguages.length > 0 && !languageCode) {
      setLanguageCode(availableLanguages[0]?.code || "");
    } else if (availableLanguages.length === 0) {
      setLanguageCode("");
    }
  }, [templateName, availableLanguages]);

  // Effect to handle selected template changes
  useEffect(() => {
    if (templateName && languageCode) {
      const template = templates.find(
        t => t.name === templateName && t.languageCode === languageCode
      );
      
      if (template) {
        setSelectedTemplate(template);
      } else {
        setSelectedTemplate(null);
      }
    }
  }, [languageCode, templateName, templates]);

    // Generate CSV template when template changes
  useEffect(() => {
    if (selectedTemplate && templateVariables.length > 0) {
      // Create CSV headers with variable names
      const headers = ['phoneNumber'];
      
      // Sort variables by index and add them as headers
      templateVariables
        .sort((a, b) => a.index - b.index)
        .forEach(v => {
          headers.push(`variable_${v.index}`);
        });
      
          // Generate sample data with phone number and empty variables
      const sampleData: (string | CsvDataRow)[] = headers.map(() => '');
      sampleData[0] = "+1234567890";
      
      // Set CSV data as array of arrays for CSVLink compatibility
      setCsvData([headers, sampleData as string[]]);
    }
  }, [selectedTemplate, templateVariables]);


  // Handle sending the template to all recipients
  const handleSend = async () => {
    if (!selectedTemplate || !languageCode) return false;
    
    // Convert contacts to recipients with personalized variables
    const recipients: TemplateRecipient[] = contacts.map(contact => {
      // Get variables for this contact, or use empty strings
      const variables = templateVariables.map(v => {
        return contact.variables?.[`var_${v.index}`] || '';
      });
      
      return {
        phoneNumber: contact.id.replace(/^\+/, ""),
        variables
      };
    });
    
    return await onSend(templateName, languageCode, recipients);
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse<CsvDataRow>(file, {
      header: true,
      complete: (results) => {
        // Process the parsed data
        if (results.data && Array.isArray(results.data) && results.data.length > 0) {
          processCsvData(results.data);
        }
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
      }
    });
  };

  const processCsvData = (data: CsvDataRow[]) => {
    // Map CSV data to contacts with variables by calling parent updater
    data.forEach((row) => {
      const phoneNumberRaw = row.phoneNumber;
      if (!phoneNumberRaw) return;

      // Normalize formats to try to match contact.id values (which generally are "+...").
      const variants = new Set<string>();
      const cleaned = phoneNumberRaw.trim();
      variants.add(cleaned);
      variants.add(formatWhatsAppNumber(cleaned));
      variants.add(cleaned.replace(/^\+/, ""));
      variants.add(cleaned.replace(/^00/, '').replace(/^\+?/, '+'));

      // find contact in provided contacts prop
      const matched = contacts.find(c => {
        if (!c?.id) return false;
        const idNoPlus = c.id.replace(/^\+/, "");
        return variants.has(c.id) || variants.has(idNoPlus) || variants.has(c.id.replace(/^\+/, ""));
      });

      if (!matched) return;

      // For each variable column in the CSV row, call parent updater
      Object.keys(row).forEach(key => {
        if (key.startsWith('variable_')) {
          const parts = key.split('_');
          const varIndex = parts[1];
          if (varIndex) {
            const varName = `var_${varIndex}`;
            const value = row[key] ?? '';
            try {
              onUpdateContactVariables(matched.id, varName, value);
            } catch (e) {
              console.error("onUpdateContactVariables callback error:", e);
            }
          }
        }
      });
    });

    // close upload modal
    setShowCsvUpload(false);
  };

  // Prepare variables for preview display
  const getPreviewText = (text?: string, contactVars?: { [key: string]: string }): string => {
    if (!text) return '';
    
    let previewText = text;
    templateVariables.forEach((v) => {
      const placeholder = v.placeholder;
      const replacement = contactVars ? (contactVars[`var_${v.index}`] || `<${v.index}>`) : `<${v.index}>`;
      previewText = previewText.replace(placeholder, replacement);
    });
    
    return previewText;
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex justify-content-between align-items-center">
        <select
          className="form-select me-2"
          value={templateName}
          onChange={(e) => {
            setTemplateName(e.target.value);
            setLanguageCode("");
            setShowPersonalization(false);
          }}
        >
          <option value="">Select Template</option>
          {uniqueTemplateNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <div className="d-flex gap-1">
          <button 
            className="btn btn-sm btn-outline-info" 
            onClick={onSyncTemplates}
            disabled={loading}
          >
            <i className="fas fa-sync me-1"></i>
            Sync
          </button>
          <button className="btn btn-sm btn-outline-primary" onClick={onCreateTemplate}>
            <i className="fas fa-plus me-1"></i>
            Create
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
              {supportedLanguages.find(l => l.code === lang.code)?.name || lang.code}
            </option>
          ))}
        </select>
      )}

      {selectedTemplate && (
        <div className="template-preview border rounded p-3 mb-3 bg-light">
          <h6 className="border-bottom pb-2 mb-3">Template Preview</h6>
          
          {templatePreview.header && (
            <div className="mb-2">
              <small className="text-muted">HEADER</small>
              <div className="fw-bold">{getPreviewText(templatePreview.header)}</div>
            </div>
          )}
          
          {templatePreview.body && (
            <div className="mb-2">
              <small className="text-muted">BODY</small>
              <div>{getPreviewText(templatePreview.body)}</div>
            </div>
          )}
          
          {templatePreview.footer && (
            <div>
              <small className="text-muted">FOOTER</small>
              <div className="text-muted font-italic">{templatePreview.footer}</div>
            </div>
          )}
        </div>
      )}

      {selectedTemplate && templateVariables.length > 0 && (
        <>
          <div className="d-flex justify-content-between align-items-center">
            <h6 className="mb-0">Personalization</h6>
            <div className="d-flex gap-2">
              {csvData.length > 0 && (
                <CSVLink 
                  data={csvData} 
                  filename={`${templateName}_template.csv`}
                  className="btn btn-sm btn-outline-secondary"
                >
                  <CsvIcon /> Download Template
                </CSVLink>
              )}
              <button 
                className="btn btn-sm btn-outline-primary"
                onClick={() => setShowCsvUpload(true)}
              >
                <i className="fas fa-upload me-1"></i> Import CSV
              </button>
              <button
                className="btn btn-sm btn-outline-info"
                onClick={() => setShowPersonalization(!showPersonalization)}
              >
                {showPersonalization ? (
                  <><i className="fas fa-eye-slash me-1"></i> Hide Variables</>
                ) : (
                  <><i className="fas fa-eye me-1"></i> Show Variables</>
                )}
              </button>
            </div>
          </div>

          {showPersonalization && (
            <div className="mt-3 border rounded p-3">
              <h6 className="border-bottom pb-2 mb-3">Customize Variables for Each Contact</h6>
              
              {contacts.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-bordered table-sm">
                    <thead className="table-light">
                      <tr>
                        <th>Contact</th>
                        {templateVariables
                          .sort((a, b) => a.index - b.index)
                          .map((v) => (
                            <th key={`header-var-${v.index}`}>Variable {v.index}</th>
                          ))}
                        <th>Preview</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((contact, idx) => (
                        <tr key={`contact-row-${contact.id}-${idx}`}>
                          <td>
                            <div className="d-flex align-items-center">
                              <i className="fas fa-user-circle text-muted me-2"></i>
                              <div>
                                <div className="fw-medium">{contact.name}</div>
                                <small className="text-muted">{contact.id}</small>
                              </div>
                            </div>
                          </td>
                          {templateVariables
                            .sort((a, b) => a.index - b.index)
                            .map((v) => (
                              <td key={`var-${contact.id}-${v.index}`}>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder={`Variable ${v.index}`}
                                  value={contact.variables?.[`var_${v.index}`] || ''}
                                  onChange={(e) => {
                                    // propagate the change to parent so selectedContacts are updated
                                    onUpdateContactVariables(contact.id, `var_${v.index}`, e.target.value);
                                  }}
                                />
                              </td>
                            ))}
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-info"
                              data-bs-toggle="tooltip"
                              data-bs-placement="top"
                              title="View personalized preview"
                              onClick={() => {
                                // show a simple alert-style preview in the modal element (keeps behavior minimal)
                                const previewBody = getPreviewText(templatePreview.body, contact.variables);
                                const previewHeader = getPreviewText(templatePreview.header, contact.variables);
                                const previewFooter = getPreviewText(templatePreview.footer, contact.variables);
                                const content = `
Header: ${previewHeader || '-'}
Body: ${previewBody || '-'}
Footer: ${previewFooter || '-'}
`;
                                // find previewContent element and set text
                                const el = document.getElementById('previewContent');
                                if (el) el.textContent = content;
                                // show bootstrap modal if present
                                const modal = window.bootstrap?.Modal?.getOrCreateInstance?.(document.getElementById('variablePreviewModal'));
                                modal?.show?.();
                              }}
                            >
                              <i className="fas fa-eye"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="alert alert-info">
                  No contacts selected. Please select contacts to personalize variables.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Hidden file input for CSV upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="d-none" 
        accept=".csv" 
        onChange={handleFileUpload} 
      />

      {/* CSV Upload Modal */}
      {showCsvUpload && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Import Variables from CSV</h5>
                  <button type="button" className="btn-close" onClick={() => setShowCsvUpload(false)}></button>
                </div>
                <div className="modal-body">
                  <p>Upload a CSV file with variables for each contact. The CSV should have:</p>
                  <ul>
                    <li>A <code>phoneNumber</code> column with contact phone numbers</li>
                    <li>Columns named <code>variable_1</code>, <code>variable_2</code>, etc. for each template variable</li>
                  </ul>
                  
                  <div className="mb-3">
                    <label className="form-label">Upload CSV File</label>
                    <input 
                      type="file"
                      className="form-control"
                      accept=".csv"
                      onChange={handleFileUpload}
                    />
                  </div>
                  
                  <div className="d-grid gap-2">
                    <button 
                      className="btn btn-primary" 
                      onClick={handleUploadClick}
                    >
                      <i className="fas fa-upload me-2"></i>
                      Upload and Process
                    </button>
                  </div>
                  
                  <hr />
                  
                  <div className="d-grid">
                    <CSVLink 
                      data={csvData} 
                      filename={`${templateName}_template.csv`}
                      className="btn btn-outline-secondary"
                    >
                      <i className="fas fa-download me-2"></i>
                      Download Template CSV
                    </CSVLink>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCsvUpload(false)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="d-flex justify-content-end mt-2">
        <button
          className="btn btn-primary"
          onClick={handleSend}
          disabled={
            !templateName || 
            !languageCode || 
            !selectedTemplate
          }
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
    const varIndices = matches.map(m => parseInt(m.replace(/{{|}}/g, "")));
    const numParams = varIndices.length > 0 ? Math.max(...varIndices) : 0;
    
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
        name: name,
        languageCode: languageCode,
        category: category,
        components: components,
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
                <input 
                  type="text" 
                  className="form-control" 
                  value={name} 
                  onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                />
                <small className="text-muted">Template name must be unique and follow WhatsApp's naming conventions</small>
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
                <small className="text-muted">
                  AUTHENTICATION: For OTP codes and verification<br />
                  MARKETING: For promotional content<br />
                  UTILITY: For transactional updates, confirmations, etc.
                </small>
              </div>              
              <div className="mb-3">
                <label className="form-label">Header Text (optional, use {`{{1}}`} for variable)</label>
                <input type="text" className="form-control" value={headerText} onChange={e => setHeaderText(e.target.value)} />
                {/{{1}}/.test(headerText) && (
                  <div className="mt-2">
                    <label className="form-label text-muted small">Example for header variable</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Example value for {{1}}" 
                      value={headerExample} 
                      onChange={e => setHeaderExample(e.target.value)} 
                    />
                  </div>
                )}
              </div>
              <div className="mb-3">
                <label className="form-label">Body Text (use {`{{1}}`}, {`{{2}}`}, etc. for variables)</label>
                <textarea className="form-control" rows={3} value={bodyText} onChange={e => setBodyText(e.target.value)} />
                <small className="text-muted">This is the main content of your template message</small>
                {bodyExamples.map((ex, i) => (
                  <div className="mt-2" key={`body-ex-${i+1}`}>                    
                    <label className="form-label text-muted small">Example for variable {`{{${i+1}}}`}</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder={`Example value for {{${i+1}}}`} 
                      value={ex} 
                      onChange={e => {
                        const newEx = [...bodyExamples];
                        newEx[i] = e.target.value;
                        setBodyExamples(newEx);
                      }} 
                    />
                  </div>
                ))}
              </div>
              <div className="mb-3">
                <label className="form-label">Footer Text (optional, no variables)</label>
                <input type="text" className="form-control" value={footerText} onChange={e => setFooterText(e.target.value)} />
                <small className="text-muted">Fixed text that appears at the bottom of your message</small>
              </div>
            </div>
            <div className="modal-footer d-flex justify-content-between">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSubmit} 
                disabled={loading || !name || !languageCode || !category || !bodyText}
              >
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
  const [newContactName, setNewContactName] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showContactManager, setShowContactManager] = useState(false);
  const [isTemplateMode, setIsTemplateMode] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkImportText, setBulkImportText] = useState("");
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
            variables: {}
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

    setSelectedContacts([
      ...selectedContacts,
      {
        id: formattedId,
        name: newContactName.trim() || formattedId,
        variables: {}
      }
    ]);
    
    setNewContactId("");
    setNewContactName("");
    setError(null);
  };

  const handleSelectContact = (contact: Contact, selected: boolean) => {
    if (selected) {
      // Copy contact but make sure it has a variables object
      const contactWithVars = {
        ...contact,
        variables: contact.variables || {}
      };
      setSelectedContacts((prev) => [...prev, contactWithVars]);
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
    const notYetSelected = availableContacts
      .filter((contact) => !selectedContacts.some((selected) => selected.id === contact.id))
      .map(contact => ({
        ...contact,
        variables: contact.variables || {}
      }));
      
    setSelectedContacts([...selectedContacts, ...notYetSelected]);
  };

  const processBulkImport = () => {
    if (!bulkImportText.trim()) {
      setError("Please enter contact information");
      return;
    }
    
    const lines = bulkImportText.trim().split('\n');
    const newContacts: Contact[] = [];
    const errors: string[] = [];
    
    lines.forEach((line, index) => {
      const parts = line.split(',').map(p => p.trim());
      
      if (parts.length < 1) {
        errors.push(`Line ${index + 1}: Invalid format`);
        return;
      }
      
      const phoneNumber = parts[0];
      const name = parts.length > 1 ? parts[1] : phoneNumber;
      
      if (!phoneNumber || !isValidWhatsAppNumber(phoneNumber)) {
        errors.push(`Line ${index + 1}: Invalid phone number ${phoneNumber}`);
        return;
      }
      
      const formattedNumber = formatWhatsAppNumber(phoneNumber);
      
      // Check if already in selected contacts
      if (selectedContacts.some(c => c.id === formattedNumber)) {
        errors.push(`Line ${index + 1}: ${formattedNumber} already added`);
        return;
      }
      
      // Check if already processed in this batch
      if (newContacts.some(c => c.id === formattedNumber)) {
        errors.push(`Line ${index + 1}: ${formattedNumber} duplicate in import`);
        return;
      }
      
      // Add to new contacts
      newContacts.push({
        id: formattedNumber,
        name: name,
        variables: {}
      });
    });
    
    if (errors.length > 0) {
      setError(`Import had errors:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n...and ${errors.length - 5} more` : ''}`);
    } else {
      setSelectedContacts([...selectedContacts, ...newContacts]);
      setShowBulkImportModal(false);
      setBulkImportText("");
      setSuccess(`Successfully imported ${newContacts.length} contacts`);
    }
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

  const handleSendTemplateMessage = async (
    templateName: string,
    languageCode: string,
    recipients: TemplateRecipient[]
  ): Promise<boolean> => {
    if (selectedContacts.length === 0) {
      setError("Please select at least one contact");
      return false;
    }

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      // Use new broadcast-template endpoint
      const response = await api.post("/api/Messages/broadcast-template", {
        templateName,
        languageCode,
        recipients: recipients // Use recipients passed from TemplateMessageInput
      });

      const successful = response.data.successful || 0;
      const failed = response.data.failed || 0;

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

  // Update a contact's variables
  const updateContactVariables = (contactId: string, variableName: string, value: string) => {
    setSelectedContacts(prevContacts => {
      return prevContacts.map(contact => {
        if (contact.id === contactId) {
          return {
            ...contact,
            variables: {
              ...(contact.variables || {}),
              [variableName]: value
            }
          };
        }
        return contact;
      });
    });
  };

  return (
    <ProtectedRoute requiredPermissions={['adminOnly']} requiredPolicy={PERMISSIONS.POLICY_ADMIN_ONLY}>
      <div className="w-100 overflow-hidden position-relative">
        <div className="p-3 p-lg-4 border-bottom user-chat-topbar">
          <h4 className="mb-0"><i className="ri-broadcast-line me-2" />Broadcast Message</h4>
        </div>

        <div className="chat-conversation p-3 p-lg-4" style={{ height: '90vh', overflowY: 'auto' }}>
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
            <div className="col-lg-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0">
                  <i className="mdi mdi-account-multiple-outline me-2"></i>
                  Recipients
                </h6>
                <div>
                  <button
                    type="button"
                    className="btn btn-sm btn-light text-primary fw-semibold me-2"
                    onClick={() => setShowBulkImportModal(true)}
                  >
                    <i className="fas fa-file-import me-1"></i>
                    Import
                  </button>
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
              <div className="card border">
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label text-center fw-semibold">
                      Quick Add Contact
                    </label>
                    <div className="input-group mb-2">
                      <span className="input-group-text">
                        <i className="mdi mdi-phone"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        value={newContactId}
                        onChange={(e) => setNewContactId(e.target.value)}
                        placeholder="+1234567890"
                        onKeyPress={(e) => {
                          if (e.key === "Enter") addNewContact();
                        }}
                      />
                    </div>
                    <div className="input-group">
                      <span className="input-group-text">
                        <i className="mdi mdi-account-circle"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        placeholder="Contact Name (optional)"
                        onKeyPress={(e) => {
                          if (e.key === "Enter") addNewContact();
                        }}
                      />
                      <button className="btn btn-primary" onClick={addNewContact} type="button">
                        <i className="mdi mdi-plus"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <label className="form-label fw-semibold mb-0">
                    <i className="mdi mdi-book-account me-2"></i>
                    Contacts
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
                  style={{ maxHeight: "50vh", overflowY: "auto" }}
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

            <div className="col-lg-8">
              <div className="card h-100 shadow-sm">
                <div className="card-header bg-white">
                  <h6 className="mb-0">
                    <i className="mdi mdi-message-processing-outline me-2"></i>
                    Broadcast Message
                  </h6>
                </div>
                <div className="card-body d-flex flex-column justify-content-end">
                  <div className="d-flex justify-content-start mb-3">
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

                  <div className="chat-input-wrapper border rounded-3 bg-white p-3 mx-auto" style={{ width: '100%' }}>
                    {isTemplateMode ? (
                      <TemplateMessageInput
                        templates={templates}
                        contacts={selectedContacts}
                        onSend={handleSendTemplateMessage}
                        onCreateTemplate={() => setShowTemplateModal(true)}
                        onSyncTemplates={syncTemplates}
                        onUpdateContactVariables={updateContactVariables}
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

                {/* Contact Manager Modal */}
        {showContactManager && (
          <>
            <div className="modal-backdrop fade show"></div>
            <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1} role="dialog">
              <div className="modal-dialog modal-lg modal-dialog-scrollable">
                <div className="modal-content">
                  {/* <div className="modal-header">
                    <h5 className="mb-0">
                      <i className="fas fa-users-cog me-2"></i>
                      Manage Recipients
                    </h5>
                    <button type="button" className="btn-close btn-close-white" onClick={() => setShowContactManager(false)}>

                    </button>
                  </div> */}

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

        {/* Bulk Import Modal */}
        {showBulkImportModal && (
          <>
            <div className="modal-backdrop fade show"></div>
            <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1} role="dialog">
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="mb-0">
                      <i className="fas fa-file-import me-2"></i>
                      Import Contacts
                    </h5>
                    <button type="button" className="btn-close" onClick={() => setShowBulkImportModal(false)}></button>
                  </div>
                  <div className="modal-body">
                    <p>Enter one contact per line in the format:</p>
                    <p className="bg-light p-2 border rounded"><code>+PhoneNumber,Name</code></p>
                    <p className="text-muted small">Example: <br />+12345678901,John Smith<br />+44123456789,Jane Doe</p>
                    
                    <div className="form-group mb-3">
                      <label className="form-label">Contact List:</label>
                      <textarea 
                        className="form-control" 
                        rows={10}
                        value={bulkImportText}
                        onChange={(e) => setBulkImportText(e.target.value)}
                        placeholder="+12345678901,John Smith +44123456789,Jane Doe"
                      ></textarea>
                    </div>
                  </div>
                  <div className="modal-footer d-flex justify-content-between">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowBulkImportModal(false)}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={processBulkImport}>
                      <i className="fas fa-file-import me-1"></i>
                      Import
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Variable Preview Modal */}
        <div className="modal fade" id="variablePreviewModal" tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Preview Personalized Message</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div className="modal-body">
                <div id="previewContent" className="p-3 border rounded bg-light"></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              </div>
            </div>
          </div>
        </div>

        <CreateTemplateModal
          show={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          onCreate={fetchTemplates}
        />
      </div>
    </ProtectedRoute>
  );
}