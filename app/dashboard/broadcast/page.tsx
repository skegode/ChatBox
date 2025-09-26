"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { PERMISSIONS } from "@/lib/permissions";
import { FaPaperclip, FaPaperPlane } from 'react-icons/fa';
import ProtectedRoute from '../../../components/ProtectedRoute';

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

// Helper function to format WhatsApp phone numbers to international format
const formatWhatsAppNumber = (number: string): string => {
  // Remove all non-digit characters except the leading +
  const cleaned = number.replace(/[^\d+]/g, "");

  // If already starts with +, return as is
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  // Handle numbers starting with double zeros (international format in some countries)
  if (cleaned.startsWith("00")) {
    return `+${cleaned.substring(2)}`;
  }

  // If doesn't start with +, assume it needs a country code
  return `+${cleaned}`;
};

// Helper function to validate WhatsApp phone numbers
const isValidWhatsAppNumber = (number: string): boolean => {
  // WhatsApp numbers must be in international format with + and country code
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
  if (!a) return false; // contains letters -> real name
  const b = digitsOnly(contactId ?? "");
  if (!b) return true; // candidate digits but no contactId -> treat as phone
  return a === b || a.endsWith(b) || b.endsWith(a);
}

function MessageInput({ onSend }: { onSend: (text: string, file?: File | null) => Promise<boolean> }) {
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
          maxHeight: "200px", // Optional: set a max height if needed
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
          <FaPaperclip />
        </label>
        <button className="btn btn-primary" onClick={handleSend}>
          <FaPaperPlane />
        </button>
      </div>
    </div>
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
  const router = useRouter();
  const { isAuthenticated, checkPolicy } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    fetchContacts();
  }, [isAuthenticated, router]);

  // Updated to use the same endpoint as ChatList component
  const fetchContacts = async () => {
    setLoading(true);
    try {
      // Use the same endpoint as ChatList to get all conversations
      const response = await api.get("api/Messages");

      if (Array.isArray(response.data)) {
        // Extract unique contacts from conversations
        const conversations: Conversation[] = response.data;
        const uniqueContacts = new Map<string, Contact>();

        conversations.forEach((chat) => {
          const contactId = chat.contactId;
          if (!contactId) return;

          // Check if the contactName is a real name or just a formatted phone number
          const rawName = chat.contactName;
          // Fix: Use null coalescing operator to handle null values
          const isPhoneLike = contactNameLooksLikePhone(
            rawName ?? undefined,
            contactId
          );
          const displayName = rawName && !isPhoneLike ? rawName : contactId;

          uniqueContacts.set(contactId, {
            id: contactId.startsWith("+") ? contactId : `+${contactId}`,
            name: displayName,
          });
        });

        // Also fetch dedicated contacts if available
        try {
          const contactsResponse = await api.get("api/Messages/contacts");
          if (contactsResponse.data && Array.isArray(contactsResponse.data)) {
            contactsResponse.data.forEach((contact: ApiContact) => {
              const id = contact.waId || contact.contactId;
              if (id) {
                uniqueContacts.set(id, {
                  id: id.startsWith("+") ? id : `+${id}`,
                  name: contact.name || id,
                  waId: contact.waId,
                });
              }
            });
          }
        } catch (err) {
          console.warn("Could not fetch additional contacts:", err);
        }

        setAvailableContacts(Array.from(uniqueContacts.values()));
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setError("Failed to load contacts");
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

    // Check if already added
    if (selectedContacts.some((c) => c.id === formattedId)) {
      setError("This contact is already added");
      return;
    }

    setSelectedContacts([
      ...selectedContacts,
      {
        id: formattedId,
        name: formattedId,
      },
    ]);
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
      if (
        confirm(
          `Are you sure you want to remove all ${selectedContacts.length} selected recipients?`
        )
      ) {
        setSelectedContacts([]);
      }
    }
  };

  const selectAllContacts = () => {
    const notYetSelected = availableContacts.filter(
      (contact) =>
        !selectedContacts.some((selected) => selected.id === contact.id)
    );
    setSelectedContacts([...selectedContacts, ...notYetSelected]);
  };

  const handleSendBroadcast = async (text: string, file?: File | null) => {
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

      // Send to each contact
      const results = await Promise.allSettled(
        selectedContacts.map((contact) => {
          const payload = {
            ContactId: contact.id.replace(/^\+/, ""),
            MessageText: text,
          };

          if (mediaId) {
            Object.assign(payload, {
              MediaId: mediaId,
              MediaType: mediaType,
              MediaLocalPath: mediaLocalPath,
              MediaFileName: mediaFileName,
            });
          }

          return api.post("/api/Messages/send", payload);
        })
      );

      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      setSuccess(
        `Successfully sent to ${successful} contacts${
          failed > 0 ? ` (${failed} failed)` : ""
        }`
      );

      if (failed === 0) {
        // Clear form on complete success
        setSelectedContacts([]);
      }

      return true;
    } catch (err) {
      console.error("Error sending broadcast:", err);
      setError("Failed to send broadcast message");
      return false;
    } finally {
      setSending(false);
    }
  };

  return (
    <ProtectedRoute requiredPermissions={['adminOnly']} requiredPolicy={PERMISSIONS.POLICY_ADMIN_ONLY}>
      <div className="w-100 overflow-hidden position-relative">
        {/* Fixed Header */}
        <div className="p-3 p-lg-4 border-bottom user-chat-topbar">
          <h4 className="mb-0"><i className="ri-broadcast-line me-2" />Broadcast Message</h4>
        </div>

        {/* Scrollable Content */}
        <div className="chat-conversation p-3 p-lg-4" style={{ height: 'calc(100vh - 140px)', overflowY: 'auto' }}>
          {/* Success or Error messages */}
          {error && (
            <div className="alert alert-danger alert-dismissible fade show mb-3" role="alert">
              <i className="fas fa-exclamation-triangle me-2"></i>
              {error}
            </div>
          )}
          {success && (
            <div className="alert alert-success alert-dismissible fade show mb-3" role="alert">
              <i className="fas fa-check-circle me-2"></i>
              {success}
            </div>
          )}

          <div className="row g-4">
            {/* Recipients Selection Card */}
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
                  {/* Quick Add Contact */}
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
                          if (e.key === "Enter") {
                            addNewContact();
                          }
                        }}
                      />
                      <button
                        className="btn btn-success"
                        onClick={addNewContact}
                        type="button"
                      >
                        <i className="fas fa-plus"></i>
                      </button>
                    </div>
                    <small className="text-muted mt-1 d-block">
                      <i className="fas fa-info-circle me-1"></i>
                      Enter number with country code (e.g. +254, +1, +44)
                    </small>
                  </div>

                  {/* Available Contacts */}
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
                          <small>Add contacts using the form above</small>
                        </div>
                      ) : (
                        <div className="row g-2">
                          {availableContacts.map((contact, index) => {
                            const isSelected = selectedContacts.some(
                              (c) => c.id === contact.id
                            );
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
                                        onChange={(e) =>
                                          handleSelectContact(contact, e.target.checked)
                                        }
                                      />
                                      <label
                                        className="form-check-label fw-medium"
                                        htmlFor={`contact-${contact.id}-${index}`}
                                      >
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

            {/* Message Composition Card */}
            <div className="col-lg-7">
              <div className="card h-100 shadow-sm">
                <div className="card-header bg-success text-white">
                  <h6 className="mb-0">
                    <i className="fas fa-edit me-2"></i>
                    Compose Broadcast Message
                  </h6>
                </div>
                <div className="card-body d-flex flex-column justify-content-center">
                  {/* Message Input Section - centered vertically in the card body */}
                  <div className="chat-input-wrapper border rounded-3 bg-white p-3 mx-auto" style={{ maxWidth: "90%" }}>
                    <MessageInput 
                      onSend={handleSendBroadcast}                        
                    />
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

        {/* Enhanced Contact Manager Modal - Fixed */}
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
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      onClick={() => setShowContactManager(false)}
                    ></button>
                  </div>

                  <div className="modal-body">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="mb-0">
                        <i className="fas fa-check-circle text-success me-2"></i>
                        Selected Recipients ({selectedContacts.length})
                      </h6>
                      {selectedContacts.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={removeAllContacts}
                        >
                          <i className="fas fa-trash me-1"></i>
                          Clear All
                        </button>
                      )}
                    </div>

                    {selectedContacts.length === 0 ? (
                      <div className="text-center py-5">
                        <i className="fas fa-user-plus fs-1 text-muted mb-3 d-block"></i>
                        <h6 className="text-muted">No recipients selected yet</h6>
                        <p className="text-muted small mb-0">
                          Select contacts from your contact list or add them manually
                        </p>
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
                                    onClick={() =>
                                      setSelectedContacts((prev) =>
                                        prev.filter((c) => c.id !== contact.id)
                                      )
                                    }
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
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowContactManager(false)}
                    >
                      <i className="fas fa-times me-1"></i>
                      Close
                    </button>
                    {selectedContacts.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-primary ms-2"
                        onClick={() => setShowContactManager(false)}
                      >
                        <i className="fas fa-check me-1"></i>
                        Continue with {selectedContacts.length} Recipients
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}