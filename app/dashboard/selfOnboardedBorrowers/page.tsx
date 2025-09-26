'use client';

import { useState, useEffect, ChangeEvent, useCallback } from 'react';
import api from '@/lib/api';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { PERMISSIONS } from '../../../lib/permissions';

// --- Type Definitions ---

interface SelfOnboardedBorrower {
  id: number;
  firstName: string;
  otherName: string;
  phoneNumber: string;
  emailAddress: string;
  nationalID: string;
  createdAt: string;
}

interface SelfOnboardedBorrowerProfile extends SelfOnboardedBorrower {
  dob: string | null;
  gender: string;
  postalAddress: string;
  physicalAddress: string;
  consent: boolean;
  phoneType: string;
  color: string;
  memory: string;
  phoneState: string;
  deviceCashPrice: number;
  deposit: number;
  amountFinanced: number;
  paymentType: string;
  amountToBePaid: number | null;
  loanTenure: number;
  totalDue: number;
  borrowerPhotoPath: string | null;
  idFrontPhotoPath: string | null;
  idBackPhotoPath: string | null;
  passportPhotoPath: string | null;
}

interface ApiResponse {
  items: SelfOnboardedBorrower[];
  total: number;
  page: number;
  pageSize: number;
}

// --- Helper Components ---

const ProfileDetail = ({ label, value }: { label: string; value: string | number | null | undefined }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="col-md-4 mb-3">
      <h6 className="text-muted mb-1" style={{fontSize: '0.8rem'}}>{label}</h6>
      <p className="mb-0" style={{fontSize: '0.9rem'}}>{String(value)}</p>
    </div>
  );
};

const PhotoDisplay = ({ label, path }: { label: string; path: string | null }) => {
  if (!path) return null;
  // The axios instance `api` has the baseURL, so we don't need to construct it here for the image path
  const imageUrl = `${api.defaults.baseURL}${path}`;
  return (
    <div className="my-2">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <a href={imageUrl} target="_blank" rel="noopener noreferrer">
        <img
          src={imageUrl}
          alt={label}
          className="mt-1 rounded-lg border object-cover"
          style={{ width: '100%', height: 'auto', maxHeight: '300px' }}
        />
      </a>
    </div>
  );
};

// --- Main Component ---

export default function SelfOnboardedBorrowersPage() {
  const [borrowers, setBorrowers] = useState<SelfOnboardedBorrower[]>([]);
  const [selectedBorrower, setSelectedBorrower] = useState<SelfOnboardedBorrowerProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination and Search State
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => {
      clearTimeout(timerId);
    };
  }, [searchTerm]);

  const fetchBorrowers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ApiResponse>('/api/borrowers', {
        params: {
          page,
          pageSize,
          q: debouncedSearchTerm || undefined,
        },
      });
      const data = response.data;
      setBorrowers(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, debouncedSearchTerm]);

  useEffect(() => {
    fetchBorrowers();
  }, [fetchBorrowers]);

  const handleRowClick = async (borrowerId: number) => {
    try {
      const response = await api.get<SelfOnboardedBorrowerProfile>(`/api/borrowers/${borrowerId}`);
      setSelectedBorrower(response.data);
      setIsModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load profile.');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

    return (
    <ProtectedRoute requiredPermissions={['adminOnly']} requiredPolicy={PERMISSIONS.POLICY_VIEW_USERS}>
      <div className="w-100 overflow-hidden position-relative">
        {/* Fixed Header */}
        <div className="p-3 p-lg-4 border-bottom user-chat-topbar">
          <h4 className="mb-4" style={{fontSize: '1rem'}}><i className="ri-group-line me-2" />Self-Onboarded Borrowers</h4>
          <div className="mb-0">
            <input
              type="text"
              placeholder="Search by name, phone, email, or ID..."
              value={searchTerm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="form-control"
              style={{fontSize: '0.85rem', maxWidth: '320px'}}
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="chat-conversation p-3 p-lg-4" style={{ height: 'calc(100vh - 180px)', overflowY: 'auto' }}>
          {isLoading && <p>Loading...</p>}
          {error && <p className="text-danger">{error}</p>}

          {!isLoading && !error && (
            <>
              <div className="table-responsive">
                <table className="table table-striped" style={{fontSize: '0.85rem'}}>
                  <thead className="table-light sticky-top">
                    <tr>
                      <th>Name</th>
                      <th>National ID</th>
                      <th>Phone Number</th>
                      <th>Email</th>
                      <th>Onboarded At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {borrowers.length > 0 ? (
                      borrowers.map((borrower) => (
                        <tr key={borrower.id} onClick={() => handleRowClick(borrower.id)} style={{cursor: 'pointer'}}>
                          <td>{`${borrower.firstName} ${borrower.otherName}`}</td>
                          <td>{borrower.nationalID}</td>
                          <td>{borrower.phoneNumber}</td>
                          <td>{borrower.emailAddress}</td>
                          <td>{new Date(borrower.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center text-muted">
                          No borrowers found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="d-flex justify-content-between align-items-center mt-3">
                <div style={{fontSize: '0.85rem'}}>
                  Page {page} of {totalPages}
                </div>
                <div className="d-flex align-items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="btn btn-sm btn-dark"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="btn btn-sm btn-dark"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Profile Modal - Fixed */}
        {isModalOpen && (
          <>
            <div className="modal-backdrop fade show"></div>
            <div className="modal fade show" style={{ display: 'block' }} tabIndex={-1} role="dialog">
              <div className="modal-dialog modal-dialog-scrollable modal-xl">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Borrower Profile</h5>
                    <button type="button" className="btn-close" onClick={() => setIsModalOpen(false)}></button>
                  </div>
                  <div className="modal-body">
                    <p>Full details for {selectedBorrower?.firstName} {selectedBorrower?.otherName}.</p>
                    {selectedBorrower && (
                      <div className="container-fluid">
                        <div className="row">
                          <ProfileDetail label="Full Name" value={`${selectedBorrower.firstName} ${selectedBorrower.otherName}`} />
                          <ProfileDetail label="National ID" value={selectedBorrower.nationalID} />
                          <ProfileDetail label="Date of Birth" value={selectedBorrower.dob ? new Date(selectedBorrower.dob).toLocaleDateString() : 'N/A'} />
                          <ProfileDetail label="Gender" value={selectedBorrower.gender} />
                          <ProfileDetail label="Phone Number" value={selectedBorrower.phoneNumber} />
                          <ProfileDetail label="Email" value={selectedBorrower.emailAddress} />
                          <ProfileDetail label="Physical Address" value={selectedBorrower.physicalAddress} />
                          <ProfileDetail label="Postal Address" value={selectedBorrower.postalAddress} />
                          <ProfileDetail label="Phone Type" value={selectedBorrower.phoneType} />
                          <ProfileDetail label="Color" value={selectedBorrower.color} />
                          <ProfileDetail label="Memory" value={selectedBorrower.memory} />
                          <ProfileDetail label="Phone State" value={selectedBorrower.phoneState} />
                          <ProfileDetail label="Device Price" value={selectedBorrower.deviceCashPrice.toFixed(2)} />
                          <ProfileDetail label="Deposit" value={selectedBorrower.deposit.toFixed(2)} />
                          <ProfileDetail label="Amount Financed" value={selectedBorrower.amountFinanced.toFixed(2)} />
                          <ProfileDetail label="Total Due" value={selectedBorrower.totalDue.toFixed(2)} />
                          <ProfileDetail label="Loan Tenure" value={`${selectedBorrower.loanTenure} months`} />
                          <ProfileDetail label="Payment Type" value={selectedBorrower.paymentType} />
                        </div>
                        <div className="row border-top pt-4 mt-4">
                          <div className="col-md-3"><PhotoDisplay label="Borrower Photo" path={selectedBorrower.borrowerPhotoPath} /></div>
                          <div className="col-md-3"><PhotoDisplay label="ID Front" path={selectedBorrower.idFrontPhotoPath} /></div>
                          <div className="col-md-3"><PhotoDisplay label="ID Back" path={selectedBorrower.idBackPhotoPath} /></div>
                          <div className="col-md-3"><PhotoDisplay label="Passport Photo" path={selectedBorrower.passportPhotoPath} /></div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Close</button>
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