"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { PERMISSIONS } from "@/lib/permissions";

type Contact = {
  id: string;
  name: string;
  waId?: string;
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
  const cleaned = number.replace(/[^\d+]/g, '');
  
  // If already starts with +, return as is
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // Handle numbers starting with double zeros (international format in some countries)
  if (cleaned.startsWith('00')) {
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
  return (s ?? '').replace(/\D/g, '');
}

function contactNameLooksLikePhone(candidate?: string, contactId?: string) {
  if (!candidate) return false;
  const a = digitsOnly(candidate);
  if (!a) return false; // contains letters -> real name
  const b = digitsOnly(contactId ?? '');
  if (!b) return true; // candidate digits but no contactId -> treat as phone
  return a === b || a.endsWith(b) || b.endsWith(a);
}

export default function BroadcastPage() {
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([]);
  const [message, setMessage] = useState("");
  const [newContactId, setNewContactId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
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
        
        conversations.forEach(chat => {
          const contactId = chat.contactId;
          if (!contactId) return;
          
          // Check if the contactName is a real name or just a formatted phone number
          const rawName = chat.contactName;
          // Fix: Use null coalescing operator to handle null values
          const isPhoneLike = contactNameLooksLikePhone(rawName ?? undefined, contactId);
          const displayName = (rawName && !isPhoneLike) ? rawName : contactId;
          
          uniqueContacts.set(contactId, {
            id: contactId.startsWith('+') ? contactId : `+${contactId}`,
            name: displayName
          });
        });
        
        // Also fetch dedicated contacts if available
        try {
          const contactsResponse = await api.get('api/Messages/contacts');
          if (contactsResponse.data && Array.isArray(contactsResponse.data)) {
            contactsResponse.data.forEach((contact: any) => {
              const id = contact.waId || contact.contactId;
              if (id) {
                uniqueContacts.set(id, {
                  id: id.startsWith('+') ? id : `+${id}`,
                  name: contact.name || id,
                  waId: contact.waId
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
    if (!newContactId || newContactId.trim() === '') {
      setError("Please enter a valid phone number");
      return;
    }
    
    const formattedId = formatWhatsAppNumber(newContactId.trim());
    
    if (!isValidWhatsAppNumber(formattedId)) {
      setError("Please enter a valid WhatsApp number in international format");
      return;
    }
    
    // Check if already added
    if (selectedContacts.some(c => c.id === formattedId)) {
      setError("This contact is already added");
      return;
    }
    
    setSelectedContacts([...selectedContacts, {
      id: formattedId,
      name: formattedId
    }]);
    setNewContactId("");
    setError(null);
  };

  const handleSelectContact = (contact: Contact, selected: boolean) => {
    if (selected) {
      setSelectedContacts(prev => [...prev, contact]);
    } else {
      setSelectedContacts(prev => prev.filter(c => c.id !== contact.id));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setMediaFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setMediaFile(null);
  };

  const removeAllContacts = () => {
    if (selectedContacts.length > 0) {
      if (confirm(`Are you sure you want to remove all ${selectedContacts.length} selected recipients?`)) {
        setSelectedContacts([]);
      }
    }
  };

  const selectAllContacts = () => {
    const notYetSelected = availableContacts.filter(
      contact => !selectedContacts.some(selected => selected.id === contact.id)
    );
    setSelectedContacts([...selectedContacts, ...notYetSelected]);
  };

  const handleSendBroadcast = async () => {
    if (selectedContacts.length === 0) {
      setError("Please select at least one contact");
      return;
    }

    if (!message && !mediaFile) {
      setError("Please enter a message or select a file");
      return;
    }
    
    setSending(true);
    setError(null);
    setSuccess(null);
    
    try {
      let mediaId = null;
      let mediaType = null;
      let mediaLocalPath = null;
      let mediaFileName = null;
      
      if (mediaFile) {
        const fd = new FormData();
        fd.append("file", mediaFile);
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
        selectedContacts.map(contact => {
          const payload = {
            ContactId: contact.id.replace(/^\+/, ""),
            MessageText: message,
          };
          
          if (mediaId) {
            Object.assign(payload, {
              MediaId: mediaId,
              MediaType: mediaType,
              MediaLocalPath: mediaLocalPath,
              MediaFileName: mediaFileName
            });
          }
          
          return api.post("/api/Messages/send", payload);
        })
      );
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      setSuccess(`Successfully sent to ${successful} contacts${failed > 0 ? ` (${failed} failed)` : ''}`);
      
      if (failed === 0) {
        // Clear form on complete success
        setMessage("");
        setSelectedContacts([]);
        setMediaFile(null);
      }
    } catch (err) {
      console.error("Error sending broadcast:", err);
      setError("Failed to send broadcast message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <div className="page-title-box d-flex align-items-center justify-content-between">
            <h4 className="mb-0">Broadcast Message</h4>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              {/* Success or Error messages */}
              {error && <div className="alert alert-danger mb-3">{error}</div>}
              {success && <div className="alert alert-success mb-3">{success}</div>}
              
              <div className="row">
                {/* Contact selection section */}
                <div className="col-lg-5">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0">Select Recipients</h5>
                    <div className="d-flex gap-2">
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setShowContactManager(true)}
                      >
                        Manage Recipients
                      </button>
                    </div>
                  </div>
                  
                  {/* Add new contact */}
                  <div className="mb-3">
                    <label className="form-label">Add by phone number:</label>
                    <div className="input-group">
                      <input
                        type="text"
                        className="form-control"
                        value={newContactId}
                        onChange={(e) => setNewContactId(e.target.value)}
                        placeholder="e.g. +254 712 345 678"
                      />
                      <button 
                        className="btn btn-primary"
                        onClick={addNewContact}
                        type="button"
                      >
                        Add
                      </button>
                    </div>
                    <small className="text-muted">Enter number in international format with country code (e.g. +254, +1, +44)</small>
                  </div>
                  
                  {/* Selected contacts - Enhanced version */}
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <label className="form-label mb-0">
                        Selected Recipients ({selectedContacts.length}):
                      </label>
                      {selectedContacts.length > 0 && (
                        <button 
                          type="button" 
                          className="btn btn-sm btn-outline-danger"
                          onClick={removeAllContacts}
                        >
                          Remove All
                        </button>
                      )}
                    </div>
                    <div className="border rounded p-2" style={{maxHeight: "150px", overflowY: "auto"}}>
                      {selectedContacts.length === 0 ? (
                        <p key="no-selected-contacts" className="text-muted small">No contacts selected</p>
                      ) : (
                        <div className="d-flex flex-wrap gap-1">
                          {selectedContacts.map((contact, index) => (
                            <div key={`selected-${contact.id}-${index}`} className="badge bg-light text-dark p-2 d-flex align-items-center">
                              {contact.name}
                              <button 
                                className="btn-close ms-2 btn-close-white"
                                onClick={() => setSelectedContacts(prev => prev.filter(c => c.id !== contact.id))}
                                aria-label="Remove"
                                style={{fontSize: "0.5rem"}}
                              ></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Available contacts */}
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <label className="form-label mb-0">Your Contacts:</label>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-primary"
                        onClick={selectAllContacts}
                      >
                        Select All
                      </button>
                    </div>
                    <div className="border rounded p-2" style={{maxHeight: "300px", overflowY: "auto"}}>
                      {loading ? (
                        <p key="loading-contacts" className="text-muted">Loading contacts...</p>
                      ) : availableContacts.length === 0 ? (
                        <p key="no-available-contacts" className="text-muted">No saved contacts found</p>
                      ) : (
                        availableContacts.map((contact, index) => {
                          const isSelected = selectedContacts.some(c => c.id === contact.id);
                          return (
                            <div key={`available-${contact.id}-${index}`} className="form-check mb-2">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`contact-${contact.id}-${index}`}
                                checked={isSelected}
                                onChange={(e) => handleSelectContact(contact, e.target.checked)}
                              />
                              <label 
                                className="form-check-label" 
                                htmlFor={`contact-${contact.id}-${index}`}
                              >
                                {contact.name}
                              </label>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Message composition section */}
                <div className="col-lg-7">
                  <h5 className="mb-3">Compose Message</h5>
                  
                  <div className="mb-3">
                    <label className="form-label">Message Text:</label>
                    <textarea
                      className="form-control"
                      rows={6}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type your message here"
                    ></textarea>
                  </div>
                  
                  <div className="mb-4">
                    <label className="form-label">Attach Media (optional):</label>
                    {!mediaFile ? (
                      <input
                        type="file"
                        className="form-control"
                        onChange={handleFileChange}
                      />
                    ) : (
                      <div className="d-flex align-items-center border rounded p-2">
                        <span className="me-auto">{mediaFile.name} ({(mediaFile.size / 1024).toFixed(1)} KB)</span>
                        <button 
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={clearFile}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-end">
                    <button 
                      className="btn btn-primary"
                      onClick={handleSendBroadcast}
                      disabled={sending}
                    >
                      {sending ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                          Sending...
                        </>
                      ) : (
                        <>Send Broadcast</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Manager Modal */}
      {showContactManager && (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-50" 
            style={{zIndex: 1050}}>
          <div className="bg-white rounded shadow p-4" style={{width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto'}}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">Manage Recipients</h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setShowContactManager(false)}
              ></button>
            </div>
            
            <div className="mb-3">
              <h6>Selected Recipients ({selectedContacts.length})</h6>
              {selectedContacts.length === 0 ? (
                <div className="alert alert-info">No recipients selected yet</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Contact ID</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedContacts.map((contact, index) => (
                        <tr key={`manage-${contact.id}-${index}`}>
                          <td>{contact.name}</td>
                          <td>{contact.id}</td>
                          <td>
                            <button 
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => setSelectedContacts(prev => prev.filter(c => c.id !== contact.id))}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="d-flex justify-content-between">
              <button 
                type="button" 
                className="btn btn-outline-secondary"
                onClick={() => setShowContactManager(false)}
              >
                Close
              </button>
              {selectedContacts.length > 0 && (
                <button 
                  type="button" 
                  className="btn btn-outline-danger"
                  onClick={removeAllContacts}
                >
                  Remove All Recipients
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}