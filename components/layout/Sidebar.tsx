'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import ChatList from '../chat/ChatList';
import { useAuth } from '../providers/AuthProvider';


export default function Sidebar() {
  const [activeSection, setActiveSection] = useState<'chats' | 'contacts' | 'users' | 'assignments' | 'settings' | 'merchants' | 'prospects' | 'influencers'>('chats');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();

  // hide secondary for pages that should not show the secondary menu/chat list  
  const hideSecondary = pathname?.toLowerCase().startsWith('/dashboard/settings') || 
                        pathname?.toLowerCase().startsWith('/dashboard/contacts');

  const activeClass = "nav-link active";
  const inactiveClass = "nav-link";

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const isAdmin = user?.role === 'Admin';

  // derive current primary section from pathname so secondary content follows direct navigation too
  const primaryFromPath = pathname?.toLowerCase().split('/').filter(Boolean)[1] ?? 'chats';

   useEffect(() => {    
    if (typeof window !== 'undefined' && window.bootstrap) {
      // Initialize all tooltips
      const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
      tooltipTriggerList.forEach((tooltipTriggerEl) => {
        // @ts-expect-error: window.bootstrap.Tooltip is not typed in TS
        new window.bootstrap.Tooltip(tooltipTriggerEl);
      });
    }
  }, []);

  // keep activeSection in sync with URL so clicking other links (navigation) highlights correctly
  useEffect(() => {
    const segments = pathname?.toLowerCase().split('/').filter(Boolean) ?? [];
    const afterDashboard = segments[1] ?? ''; // segment after /dashboard/
    let newActive: typeof activeSection = 'chats';

    if (segments.length === 1 && segments[0] === 'dashboard') {
      newActive = 'chats';
    } else if (!afterDashboard || afterDashboard === 'chats') {
      newActive = 'chats';
    } else if (afterDashboard === 'contacts') {
      newActive = 'contacts';
    } else if (['users','assignments','settings','merchants','prospects','influencers', 'selfonboardedborrowers'].includes(afterDashboard)) {
      if (afterDashboard === 'selfonboardedborrowers') {
        newActive = 'prospects';
      } else {
        newActive = afterDashboard as typeof activeSection;
      }
    } else {
      // default to chats for unrecognized segments
      newActive = 'chats';
    }

    setActiveSection(newActive);

    // Keep dropdowns open when navigating inside the same primary section (e.g. /dashboard/users -> /dashboard/users/register).
    // Only close the open dropdown when the primary section actually changed away from that dropdown.
    if (openDropdown && newActive !== openDropdown) {
      setOpenDropdown(null);
    }
    // Intentionally only depend on pathname so we react to URL changes.
    // (Removed unused eslint-disable-next-line directive)
  }, [pathname]);

  const toggleDropdown = (key: string) => {
    setOpenDropdown(prev => (prev === key ? null : key));
    // ensure clicking a menu also sets it active and removes highlight from others
    setActiveSection(key as typeof activeSection);
  };

  const renderSecondary = () => {
    // Show users submenu when the users dropdown is open OR the current primary path is 'users'
    if (openDropdown === 'users' || primaryFromPath === 'users') {
      return (
        <div className='p-4'>
          <h4 className="mb-3">User Management</h4>
          <ul className='list-unstyled chat-list'>
            <li>
              <Link href="/dashboard/users/register" className="border-top">
                <i className="ri-user-add-line me-2" />Register New User
              </Link>
            </li>
            <li>
              <Link href="/dashboard/users" className="border-top">
                <i className="ri-group-line me-2" />View Users
              </Link>
            </li>
          </ul>
        </div>
      );
    }

    // when hiding secondary show nothing
    if (hideSecondary) return null;

    switch (primaryFromPath) {
      case 'merchants':
        return (
          <div className='p-4'>
            <h4 className="mb-3">Merchant Management</h4>
            <ul className='list-unstyled chat-list'>
              <li>
                <Link href="/dashboard/merchants/addMerchant" className="border-top">
                  <i className="ri-function-add-line me-2" />Add Merchant
                </Link>
              </li>
              <li>
                <Link href="/dashboard/merchants/viewMerchants" className="border-top">
                  <i className="ri-function-line me-2" />View Merchants
                </Link>
              </li>
            </ul>
          </div>
        );

      case 'prospects':
      case 'selfonboardedborrowers':
        return (
          <div className='p-4'>
            <h4 className="mb-3">Prospect Management</h4>
            <ul className='list-unstyled chat-list'>
              <li>
                <Link href="/dashboard/prospects" className="border-top">
                  <i className="ri-user-star-line me-2"></i>View Prospects
                </Link>
              </li>
              <li>
                <Link href="/dashboard/prospects/customers" className="border-top">
                  <i className="ri-user-follow-line me-2"></i>Converted Customers
                </Link>
              </li>
              <li>
                <Link href="/dashboard/selfOnboardedBorrowers" className="border-top">
                  <i className="ri-user-received-2-line me-2"></i>Self-Onboarded
                </Link>
              </li>
            </ul>
          </div>
        );

      case 'influencers':
        return (
          <div className='p-4'>
            <h4 className="mb-3">Influencer Management</h4>
            <ul className='list-unstyled chat-list'>
              <li>
                <Link href="/dashboard/influencers" className="border-top">
                  <i className="ri-group-line me-2"></i>View Influencers
                </Link>
              </li>
              <li>
                <Link href="/dashboard/influencers/addInfluencer" className="border-top">
                  <i className="ri-user-add-line me-2"></i>Add Influencer
                </Link>
              </li>
            </ul>
          </div>
        );

      case 'contacts':
        return null; // Contacts page has its own full-width content

      // default to chat list for other sections (including dashboard root)
      default:
        return (
          <ChatList />
        );
    }
  };

  return (
    <>
      <div className="side-menu flex-lg-column me-lg-1 ms-lg-0">
        <div className="navbar-brand-box">
          <a href="#" className="logo logo-dark">
            <span className="logo-sm">
              <img src="images/logo.png" alt="" height={30} />
            </span>
          </a>
          <a href="#" className="logo logo-light">
            <span className="logo-sm">
              <img src="images/logo.png" alt="" height={30} />
            </span>
          </a>
        </div>
        <div className="flex-lg-column my-auto">
          <ul className="nav nav-pills side-menu-nav justify-content-center" role="tablist">
            <Link href="/dashboard" className="nav-item" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-placement="right" aria-label="Chats" title='Chats'>
              <button
                onClick={() => { setActiveSection('chats'); setOpenDropdown(null); }}
                className={`${activeSection === 'chats' ? activeClass : inactiveClass}`}
              >
                <i className="ri-message-3-line" />
              </button>
            </Link>

            <Link href="/dashboard/contacts" className="nav-item" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-placement="right" aria-label="Contacts" title='Contacts'>
              <button
                onClick={() => { setActiveSection('contacts'); setOpenDropdown(null); }}
                className={`${activeSection === 'contacts' ? activeClass : inactiveClass}`}
              >
                <i className="ri-contacts-book-line" />
              </button>
            </Link>
            
            {isAdmin && (
              <li className="nav-item" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-placement="right" aria-label="Users" title="Users">
                {/* Navigate to users page and keep the Users secondary menu open */}
                <button
                  onClick={() => { setActiveSection('users'); setOpenDropdown('users'); router.push('/dashboard/users'); }}
                  aria-expanded={activeSection === 'users' || openDropdown === 'users'}
                  className={`${activeSection === 'users' ? activeClass : inactiveClass}`}
                >
                  <i className="ri-group-line" />
                </button>
              </li>
            )}

            {isAdmin && (
              <Link href="/dashboard/merchants/viewMerchants" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-placement="right" aria-label="Merchants" title="Merchants" className="nav-item">
                <button
                  onClick={() => { setActiveSection('merchants'); setOpenDropdown(null); }}
                  className={`${activeSection === 'merchants' ? activeClass : inactiveClass}`}
                >
                  <i className="ri-store-2-line" />
                </button>
              </Link>
            )}

            {isAdmin && (
              <Link href="/dashboard/prospects" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-placement="right" aria-label="Prospects" title="Prospects" className="nav-item">
                <button
                  onClick={() => { setActiveSection('prospects'); setOpenDropdown(null); }}
                  className={`${activeSection === 'prospects' ? activeClass : inactiveClass}`}
                >
                  <i className="ri-user-star-line" />
                </button>
              </Link>
            )}

            {isAdmin && (
              <Link href="/dashboard/influencers" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-placement="right" aria-label="Influencers" title="Influencers" className="nav-item">
                <button
                  onClick={() => { setActiveSection('influencers'); setOpenDropdown(null); }}
                  className={`${activeSection === 'influencers' ? activeClass : inactiveClass}`}
                >
                  <i className="ri-group-3-line" />
                </button>
              </Link>
            )}


            {isAdmin && (
              <Link href="/dashboard/stats" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-placement="right" aria-label="Stats" title="Messaging Stats" className="nav-item">
                <button
                  onClick={() => { setActiveSection('stats'); setOpenDropdown(null); }}
                  className={`${activeSection === 'stats' ? activeClass : inactiveClass}`}
                >
                  <i className="ri-bar-chart-2-line" />
                </button>
              </Link>
            )}

            {isAdmin && (
              <Link href="/dashboard/assignments" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-placement="right" aria-label="Assignments" title="Assignments" className="nav-item">
                <button
                  onClick={() => { setActiveSection('assignments'); setOpenDropdown(null); }}
                  className={`${activeSection === 'assignments' ? activeClass : inactiveClass}`}
                >
                  <i className="ri-user-shared-line" />
                </button>
              </Link>
            )}

          </ul>
        </div>
        <div className="flex-lg-column d-none d-lg-block">
          <ul className="nav side-menu-nav justify-content-center">
            <li className="nav-item" onClick={() => { setActiveSection('settings'); setOpenDropdown(null); }}>
              <Link href="/dashboard/settings" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-placement="right" aria-label="Settings" title="Settings" className="nav-link light-dark-mode">
                <i className="ri-settings-2-line" />
              </Link>
            </li>
            <li className="nav-item">
              <a className="nav-link light-dark-mode" data-bs-toggle="tooltip" data-bs-trigger="hover" data-bs-placement="right" aria-label="Logout" href="#" onClick={handleLogout} title="Logout">
                <i className="ri-logout-circle-line" />
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className='chat-leftsidebar me-lg-1 ms-lg-0'>
        {renderSecondary()}
      </div>
    </>
  );
}