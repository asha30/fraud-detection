import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Bell,
  FileText,
  LayoutDashboard,
  LogOut,
  Radio,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { useAlertStore } from '../stores/useAlertStore';
import { initGlobalStream } from '../hooks/useLiveStream';
import { useLiveStreamStore } from '../stores/useLiveStreamStore';

const TOPBAR_HEIGHT_PX = 52;
const SIDEBAR_WIDTH_PX = 220;

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#9ca3af',
  letterSpacing: 0.8,
  textTransform: 'uppercase',
  padding: '10px 10px 4px',
};

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  badge?: React.ReactNode;
};

function Topbar() {
  const navigate = useNavigate();
  const title = usePageTitle();
  const unreadCount = useAlertStore((s) => s.unreadCount);

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const runAppSearch = (rawQuery: string) => {
    const q = rawQuery.trim().toLowerCase();

    // Clear previous highlights
    document.querySelectorAll<HTMLElement>('[data-app-search-hit="true"]').forEach((el) => {
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.background = '';
      el.dataset.appSearchHit = 'false';
    });

    if (!q) return;

    // Search within the main content area (Outlet content)
    const root = document.querySelector<HTMLElement>('main');
    if (!root) return;

    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;

        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        // avoid script/style and hidden content
        if (parent.closest('script, style')) return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let current: Node | null;
    while ((current = walker.nextNode())) {
      textNodes.push(current as Text);
    }

    // Highlight matching parent elements (closest block)
    const hits: HTMLElement[] = [];
    for (const t of textNodes) {
      if (t.nodeValue?.toLowerCase().includes(q)) {
        const el = t.parentElement;
        if (el) hits.push(el);
      }
    }

    const uniqueHits = Array.from(new Set(hits));

    uniqueHits.slice(0, 20).forEach((el) => {
      const hitEl = el.closest('section, tr, li, div, article') as HTMLElement | null;
      const target = hitEl ?? el;
      target.dataset.appSearchHit = 'true';
      target.style.outline = '2px solid #1D9E75';
      target.style.outlineOffset = '2px';
      target.style.background = '#E1F5EE';
    });

    const first = uniqueHits[0]?.closest('section, tr, li, div, article') as HTMLElement | null;
    (first ?? uniqueHits[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: SIDEBAR_WIDTH_PX,
        right: 0,
        height: TOPBAR_HEIGHT_PX,
        background: '#ffffff',
        borderBottom: '0.5px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        zIndex: 40,
      }}
    >
      <div style={{ flex: 1, fontSize: 15, fontWeight: 500, color: '#111827' }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAppSearch(query);
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#f3f4f6',
              border: '0.5px solid #e5e7eb',
              padding: '7px 10px',
              borderRadius: 8,
              fontSize: 13,
              color: '#111827',
            }}
          >
            <Search size={16} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                // live search while typing
                runAppSearch(e.target.value);
              }}
              placeholder="Search…"
              aria-label="Search"
              style={{
                width: 220,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 13,
                color: '#111827',
              }}
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  runAppSearch('');
                  inputRef.current?.focus();
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#6b7280',
                  fontSize: 14,
                  lineHeight: '14px',
                  padding: 0,
                }}
                aria-label="Clear search"
                title="Clear"
              >
                ×
              </button>
            ) : null}
          </div>
        </form>

        <button
          type="button"
          onClick={() => navigate('/alerts')}
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f3f4f6',
            border: '0.5px solid #e5e7eb',
            padding: '7px 10px',
            borderRadius: 8,
            fontSize: 13,
            color: '#111827',
            cursor: 'pointer',
          }}
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell size={16} />
          {unreadCount > 0 ? (
            <span
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 8,
                height: 8,
                borderRadius: 999,
                background: '#ef4444',
              }}
            />
          ) : null}
        </button>
      </div>
    </header>
  );
}

function Sidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const unreadCount = useAlertStore((s) => s.unreadCount);

  const navItems: NavItem[] = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard size={17} />,
    },
    {
      to: '/transaction',
      label: 'Transaction Form',
      icon: <FileText size={17} />,
    },
    {
      to: '/analytics',
      label: 'Analytics',
      icon: <AreaChart size={17} />,
    },
    {
      to: '/live-stream',
      label: 'Live Stream',
      icon: <Radio size={17} />,
    },
    {
      to: '/alerts',
      label: 'Alert Monitoring',
      icon: <Bell size={17} />,
      badge:
        unreadCount > 0 ? (
          <span
            style={{
              marginLeft: 'auto',
              background: '#ef4444',
              color: '#ffffff',
              borderRadius: 999,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 500,
              lineHeight: '14px',
              minWidth: 22,
              textAlign: 'center',
            }}
          >
            {unreadCount}
          </span>
        ) : null,
    },
  ];

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: SIDEBAR_WIDTH_PX,
        height: '100vh',
        background: '#ffffff',
        borderRight: '0.5px solid #e5e7eb',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top section */}
      <div
        style={{
          height: 52,
          borderBottom: '0.5px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 12px',
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: '#1D9E75',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto',
          }}
        >
          <ShieldCheck size={15} color="#ffffff" />
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: -0.2,
            color: '#111827',
            whiteSpace: 'nowrap',
          }}
        >
          FraudShield AI
        </div>
      </div>

      {/* Navigation section */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8 }}>
        <div style={sectionLabelStyle}>MAIN</div>

        {navItems
          .filter((i) => !(i.adminOnly && user?.role !== 'admin'))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              data-hoverable="true"
              className="fs-nav-item"
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 10px',
                margin: '1px 8px',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 13,
                ...(isActive
                  ? {
                      background: '#E1F5EE',
                      color: '#0F6E56',
                      fontWeight: 500,
                    }
                  : {
                      background: 'transparent',
                      color: '#111827',
                      fontWeight: 400,
                    }),
              })}
            >
              <span style={{ display: 'inline-flex' }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge}
            </NavLink>
          ))}

        <div style={sectionLabelStyle}>OPERATIONS</div>
      </div>

      {/* Bottom section */}
      <div
        style={{
          marginTop: 'auto',
          borderTop: '0.5px solid #e5e7eb',
          padding: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 10px',
            borderRadius: 8,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f3f4f6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              background: '#E1F5EE',
              color: '#0F6E56',
              fontSize: 12,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: '0 0 auto',
            }}
          >
            {user?.avatarInitials ?? 'U'}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
              {user?.name ?? 'User'}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{user?.role ?? ''}</div>
          </div>
          <LogOut
            size={16}
            color="#9ca3af"
            style={{ cursor: 'pointer', flex: '0 0 auto' }}
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          />
        </div>
      </div>

      <style>{`
        a[data-hoverable="true"]:hover { background: #f3f4f6; color: #111827; }
        a.fs-nav-item[aria-current="page"] svg { color: #1D9E75; }
        a.fs-nav-item:not([aria-current="page"]) svg { color: #6b7280; }
      `}</style>
    </aside>
  );
}

function MainContent() {
  return (
    <main
      style={{
        marginLeft: SIDEBAR_WIDTH_PX,
        paddingTop: TOPBAR_HEIGHT_PX,
        height: '100vh',
        minWidth: 0,
        background: '#ffffff',
      }}
    >
      <div style={{ height: '100%', overflowY: 'auto', padding: 20 }}>
        <Outlet />
      </div>
    </main>
  );
}

export default function AppShell() {
  const incrementUnread = useAlertStore((s) => s.incrementUnread);
  const push = useLiveStreamStore((s) => s.push);

  useEffect(() => {
    initGlobalStream(push);
  }, [push]);

  useEffect(() => {
    // legacy alert socket — no-op if not connected
  }, [incrementUnread]);

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', color: '#111827' }}>
      <Sidebar />
      <Topbar />
      <MainContent />
    </div>
  );
}
