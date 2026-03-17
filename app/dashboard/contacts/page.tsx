// app/dashboard/contacts/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";

type Contact = {
  contactId: string;
  contactName?: string | null;
  lastMessageTime?: string | Date | null;
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    fetchContacts();
  }, [isAuthenticated, router]);

  const fetchContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch conversations and filter to only those with saved names
      const response = await api.get("api/Messages");
      if (Array.isArray(response.data)) {
        // Filter contacts that have a saved name (not just a phone number)
        const savedContacts = response.data.filter((c: Contact) => {
          if (!c.contactName) return false;
          // Check if contactName looks like a phone number
          const digits = c.contactName.replace(/\D/g, "");
          const contactDigits = c.contactId?.replace(/\D/g, "") ?? "";
          // If the name is all digits and matches contactId, it's not a real saved name
          if (digits && (!contactDigits || digits === contactDigits || digits.endsWith(contactDigits) || contactDigits.endsWith(digits))) {
            return false;
          }
          return true;
        });
        setContacts(savedContacts);
      } else {
        setContacts([]);
      }
    } catch (err) {
      console.error("Error fetching contacts:", err);
      setError("Failed to load contacts");
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = useMemo(() => {
    if (!query.trim()) return contacts;
    const q = query.toLowerCase();
    return contacts.filter(
      (c) =>
        (c.contactName || "").toLowerCase().includes(q) ||
        (c.contactId || "").toLowerCase().includes(q)
    );
  }, [contacts, query]);

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setEditName(contact.contactName || "");
    setSaveError(null);
  };

  const closeEditModal = () => {
    setEditingContact(null);
    setEditName("");
    setSaveError(null);
  };

  const handleSaveContact = async () => {
    if (!editingContact) return;
    if (!editName.trim()) {
      setSaveError("Name is required");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await api.post("/api/Messages/contacts/save-name", {
        ContactId: editingContact.contactId.trim(),
        ContactName: editName.trim(),
      });
      // Update local state
      setContacts((prev) =>
        prev.map((c) =>
          c.contactId === editingContact.contactId
            ? { ...c, contactName: editName.trim() }
            : c
        )
      );
      closeEditModal();
    } catch (err) {
      console.error("Error saving contact:", err);
      setSaveError("Failed to save contact");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChat = (contactId: string) => {
    router.push(`/dashboard/${encodeURIComponent(contactId)}`);
  };

  if (loading) {
    return (
      <div className="w-100 p-4">
        <h4 className="mb-4">Contacts</h4>
        <p className="text-muted">Loading contacts...</p>
      </div>
    );
  }

  return (
    <div className="w-100 overflow-hidden position-relative">
      <div className="p-3 p-lg-4 border-bottom">
        <div className="row align-items-center">
          <div className="col">
            <h4 className="mb-0">Contacts</h4>
            <p className="text-muted mb-0 mt-1">
              {contacts.length} saved contact{contacts.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="p-3 p-lg-4">
        {/* Search */}
        <div className="search-box mb-4">
          <div className="input-group rounded-3">
            <span className="input-group-text text-muted bg-light pe-1 ps-3">
              <i className="ri-search-line search-icon font-size-18" />
            </span>
            <input
              type="text"
              className="form-control bg-light"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts..."
            />
          </div>
        </div>

        {error && (
          <div className="alert alert-danger mb-4">{error}</div>
        )}

        {filteredContacts.length === 0 ? (
          <div className="text-center text-muted py-5">
            <i className="ri-contacts-book-line font-size-48 d-block mb-3" />
            {query ? (
              <p>No contacts match your search</p>
            ) : (
              <>
                <p>No saved contacts yet</p>
                <p className="small">
                  Save contacts from chats by clicking "Edit" in a conversation
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Phone Number</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact) => (
                  <tr key={contact.contactId}>
                    <td style={{ width: 50 }}>
                      <img
                        src="/images/default-avatar.png"
                        className="rounded-circle avatar-xs"
                        alt={contact.contactName || "Contact"}
                      />
                    </td>
                    <td>
                      <h6 className="mb-0">{contact.contactName}</h6>
                    </td>
                    <td className="text-muted">{contact.contactId}</td>
                    <td className="text-end">
                      <button
                        className="btn btn-sm btn-light me-2"
                        onClick={() => openEditModal(contact)}
                        title="Edit contact"
                      >
                        <i className="ri-pencil-line" />
                      </button>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleOpenChat(contact.contactId)}
                        title="Open chat"
                      >
                        <i className="ri-message-3-line" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Contact Modal */}
      {editingContact && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={closeEditModal}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Contact</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeEditModal}
                />
              </div>
              <div className="modal-body">
                <p className="text-muted small mb-3">
                  Phone: {editingContact.contactId}
                </p>
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter contact name"
                />
                {saveError && (
                  <p className="text-danger small mt-2 mb-0">{saveError}</p>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeEditModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveContact}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
