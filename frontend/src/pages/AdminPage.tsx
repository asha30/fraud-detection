import { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Users,
  UserCheck,
  BrainCircuit,
  ShieldCheck,
  Edit3,
  Ban,
  Rocket,
  RefreshCw,
} from 'lucide-react';
// import { useNavigate } from 'react-router-dom';
import PageWrapper from '../components/PageWrapper';
import Badge from '../components/Badge';
import ToggleSwitch from '../components/ToggleSwitch';
import { useAuth } from '../context/AuthContext';
import { useAdminUsers, type AdminUser, type AdminUserRole } from '../hooks/admin/useAdminUsers';
import { useAdminModels } from '../hooks/admin/useAdminModels';
import { useAdminRules, type Rule, type RuleAction } from '../hooks/admin/useAdminRules';
import { useAdminMetrics } from '../hooks/admin/useAdminMetrics';
import AdminLoadingSkeleton from '../components/AdminLoadingSkeleton';

type TabKey = 'users' | 'models' | 'rules';

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '10px 16px',
    fontSize: 13,
    cursor: 'pointer',
    color: active ? '#1D9E75' : '#6b7280',
    fontWeight: active ? 500 : 400,
    border: 'none',
    background: 'transparent',
    borderBottom: active ? '2px solid #1D9E75' : '2px solid transparent',
  };
}

function roleToBadgeVariant(role: AdminUserRole): 'safe' | 'medium' | 'low' | 'high' {
  if (role === 'Admin') return 'high';
  if (role === 'Fraud Analyst') return 'safe';
  if (role === 'Risk Reviewer') return 'medium';
  if (role === 'Compliance Officer') return 'low';
  // backward compatibility if API returns older role names
  if (role === 'Senior Analyst') return 'safe';
  if (role === 'Investigator') return 'medium';
  if (role === 'ML Engineer') return 'low';
  return 'low';
}

function actionToBadgeVariant(action: RuleAction): 'high' | 'medium' | 'low' | 'safe' {
  if (action === 'block') return 'high';
  if (action === 'flag' || action === 'review') return 'medium';
  return 'low';
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17,24,39,0.25)',
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 520,
          background: '#ffffff',
          border: '0.5px solid #e5e7eb',
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

// (Field/inputStyle were part of an earlier version of this page; kept here originally
// but not used in the current UI.)

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>('users');

  const usersQ = useAdminUsers();
  const modelsQ = useAdminModels();
  const rulesQ = useAdminRules();
  const metricsQ = useAdminMetrics();

  const users = usersQ.data;
  const models = modelsQ.data;
  const rules = rulesQ.data;

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);

  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [creatingRule, setCreatingRule] = useState(false);

  // NOTE: kept as-is from your code. If you want strict API-only behavior, we can remove localUsers entirely.
  const [localUsers, setLocalUsers] = useState<AdminUser[] | null>(null);

  const visibleUsers = useMemo(() => {
    if (localUsers) return localUsers;
    return users ?? [];
  }, [localUsers, users]);

  // Avoid navigating during render; it can cause blank screens and unstable routing.
  // Render nothing until we know who the user is.
  if (!user) {
    return null;
  }

  if (user.role !== 'admin') {
    return (
      <PageWrapper>
        <div style={{ padding: 14, color: '#6b7280', fontSize: 13 }}>Access denied.</div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 12,
          marginBottom: 14,
          alignItems: 'stretch',
        }}
      >
        {(() => {
          const cards = [
            {
              label: 'Total Users',
              key: 'totalUsers',
              sub: 'All accounts',
              icon: Users,
              tint: '#1D9E75',
              bg: 'rgba(29,158,117,0.10)',
              border: 'rgba(29,158,117,0.18)',
            },
            {
              label: 'Active Analysts',
              key: 'activeAnalysts',
              sub: 'On-duty staff',
              icon: UserCheck,
              tint: '#2563eb',
              bg: 'rgba(37,99,235,0.10)',
              border: 'rgba(37,99,235,0.18)',
            },
            {
              label: 'Active Models',
              key: 'activeModels',
              sub: 'Deployed & enabled',
              icon: BrainCircuit,
              tint: '#7c3aed',
              bg: 'rgba(124,58,237,0.10)',
              border: 'rgba(124,58,237,0.18)',
            },
            {
              label: 'Active Rules',
              key: 'activeRules',
              sub: 'Real-time enforcement',
              icon: ShieldCheck,
              tint: '#f59e0b',
              bg: 'rgba(245,158,11,0.12)',
              border: 'rgba(245,158,11,0.22)',
            },
          ] as const;

          return cards.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.label}
                style={{
                  background: '#ffffff',
                  border: '0.5px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 14,
                  boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
                  transition: 'transform 120ms ease, box-shadow 120ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(16,24,40,0.08)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(16,24,40,0.06)';
                  e.currentTarget.style.transform = 'translateY(0px)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 6 }}>{c.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: '#111827', lineHeight: 1.1 }}>
                      {metricsQ.isLoading ? (
                        <AdminLoadingSkeleton lines={1} height={18} />
                      ) : metricsQ.isError ? (
                        <span style={{ color: '#E24B4A', fontSize: 12, fontWeight: 500 }}>Error</span>
                      ) : metricsQ.data ? (
                        (metricsQ.data as any)[c.key]
                      ) : (
                        '—'
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{c.sub}</div>
                  </div>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: c.bg,
                      border: `0.5px solid ${c.border}`,
                      flex: '0 0 auto',
                    }}
                  >
                    <Icon size={16} color={c.tint} />
                  </div>
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '0.5px solid #e5e7eb', marginBottom: 16 }}>
        <button type="button" style={tabButtonStyle(tab === 'users')} onClick={() => setTab('users')}>
          Users &amp; roles
        </button>
        <button type="button" style={tabButtonStyle(tab === 'models')} onClick={() => setTab('models')}>
          ML models
        </button>
        <button type="button" style={tabButtonStyle(tab === 'rules')} onClick={() => setTab('rules')}>
          Rule engine
        </button>
      </div>

      {tab === 'users' ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Users & roles</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Manage access, roles and analyst permissions.</div>
            </div>
            <button
              type="button"
              onClick={() => setCreatingUser(true)}
              style={{
                background: '#1D9E75',
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
              }}
            >
              <Plus size={16} />
              Add user
            </button>
          </div>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12,
              background: '#ffffff',
              border: '0.5px solid #e5e7eb',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
            }}
          >
            <thead>
              <tr style={{ background: '#f9fafb', borderTop: '0.5px solid #e5e7eb', borderBottom: '0.5px solid #e5e7eb' }}>
                {['Name', 'Email', 'Role', 'Status', 'Last login', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      fontSize: 11,
                      color: '#6b7280',
                      fontWeight: 500,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usersQ.isLoading ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14 }}>
                    <AdminLoadingSkeleton lines={3} />
                  </td>
                </tr>
              ) : usersQ.isError ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, color: '#E24B4A', fontSize: 12 }}>
                    Unable to load users.
                  </td>
                </tr>
              ) : visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, color: '#6b7280', fontSize: 12 }}>
                    No data available.
                  </td>
                </tr>
              ) : (
                visibleUsers.map((u) => (
                  <tr
                    key={u.id}
                    style={{ borderBottom: '0.5px solid #e5e7eb' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{u.name}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>{u.email}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge variant={roleToBadgeVariant(u.role)}>{u.role}</Badge>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background: u.status === 'active' ? '#1D9E75' : '#E24B4A',
                          }}
                        />
                        <span style={{ color: '#111827' }}>{u.status === 'active' ? 'Active' : 'Inactive'}</span>
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>{u.lastLogin ?? '-'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => setEditingUser(u)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            borderRadius: 8,
                            border: '0.5px solid #e5e7eb',
                            background: '#ffffff',
                            padding: '6px 10px',
                            fontSize: 12,
                            color: '#111827',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f9fafb';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#ffffff';
                          }}
                        >
                          <Edit3 size={14} color="#6b7280" />
                          Edit
                        </button>

                        <button
                          type="button"
                          title={u.status === 'active' ? 'Disable' : 'Enable'}
                          onClick={async () => {
                            const nextStatus = u.status === 'active' ? 'inactive' : 'active';

                            // Frontend-only optimistic update.
                            // Keep backend endpoints unchanged per requirement (FastAPI routes).
                            setLocalUsers((prev) => {
                              const base = prev ?? visibleUsers;
                              return base.map((x) => (x.id === u.id ? { ...x, status: nextStatus } : x));
                            });
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            borderRadius: 8,
                            border: '0.5px solid #e5e7eb',
                            background: '#ffffff',
                            padding: '6px 10px',
                            fontSize: 12,
                            color: '#111827',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f9fafb';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#ffffff';
                          }}
                        >
                          <Ban size={14} color="#6b7280" />
                          {u.status === 'active' ? 'Disable' : 'Enable'}
                        </button>

                        <button
                          type="button"
                          title="Delete"
                          onClick={async () => {
                            // Frontend-only optimistic update.
                            // Keep backend endpoints unchanged per requirement (FastAPI routes).
                            setLocalUsers((prev) => {
                              const base = prev ?? visibleUsers;
                              return base.filter((x) => x.id !== u.id);
                            });
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 34,
                            height: 30,
                            borderRadius: 8,
                            border: '0.5px solid #e5e7eb',
                            background: '#ffffff',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#fef2f2';
                            e.currentTarget.style.borderColor = '#fecaca';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#ffffff';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                          }}
                        >
                          <Trash2 size={14} color="#E24B4A" />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {creatingUser || editingUser ? (
            <Modal
              title={editingUser ? 'Edit user' : 'Add user'}
              onClose={() => {
                setCreatingUser(false);
                setEditingUser(null);
              }}
            >
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                User create/edit form is not implemented in this frontend build.
              </div>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingUser(false);
                    setEditingUser(null);
                  }}
                  style={{
                    border: '0.5px solid #e5e7eb',
                    background: '#ffffff',
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </Modal>
          ) : null}
        </div>
      ) : null}

      {tab === 'models' ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>ML models</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Model lifecycle, deployment and health.</div>
            </div>
            <button
              type="button"
              onClick={async () => {
                await modelsQ.refetch();
              }}
              style={{
                border: '0.5px solid #e5e7eb',
                background: '#ffffff',
                borderRadius: 10,
                padding: '8px 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontSize: 12,
                color: '#111827',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f9fafb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              <RefreshCw size={14} color="#6b7280" />
              Refresh
            </button>
          </div>

          {modelsQ.isLoading ? (
            <div style={{ background: '#ffffff', border: '0.5px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
              <AdminLoadingSkeleton lines={4} />
            </div>
          ) : modelsQ.isError ? (
            <div
              style={{
                background: '#ffffff',
                border: '0.5px solid #e5e7eb',
                borderRadius: 12,
                padding: 14,
                color: '#E24B4A',
                fontSize: 12,
              }}
            >
              Unable to load models.
            </div>
          ) : (models ?? []).length === 0 ? (
            <div
              style={{
                background: '#ffffff',
                border: '0.5px solid #e5e7eb',
                borderRadius: 12,
                padding: 14,
                color: '#6b7280',
                fontSize: 12,
              }}
            >
              No data available.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, alignItems: 'stretch' }}>
              {(models ?? []).map((m: any) => {
                const statusVariant = m.active ? 'safe' : 'low';
                return (
                  <div
                    key={m.id}
                    style={{
                      background: '#ffffff',
                      border: '0.5px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 14,
                      boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
                      transition: 'transform 120ms ease, box-shadow 120ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(16,24,40,0.08)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 1px 2px rgba(16,24,40,0.06)';
                      e.currentTarget.style.transform = 'translateY(0px)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{m.model}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                          Version <span style={{ color: '#111827', fontWeight: 500 }}>{m.version}</span> • {m.type}
                        </div>
                      </div>
                      <Badge variant={statusVariant}>{m.active ? 'Active' : 'Disabled'}</Badge>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>Accuracy</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginTop: 5 }}>{m.auc}%</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>Last trained</div>
                        <div style={{ fontSize: 12, color: '#111827', marginTop: 6 }}>{m.lastTrained ?? '—'}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        style={{
                          border: '0.5px solid #e5e7eb',
                          background: '#ffffff',
                          borderRadius: 10,
                          padding: '8px 10px',
                          fontSize: 12,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 7,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#ffffff';
                        }}
                        onClick={async () => {
                          // Keep existing UI behavior, but avoid calling non-existent /api/* routes.
                          // (FastAPI endpoints currently integrated: /admin/metrics only.)
                          await modelsQ.refetch();
                        }}
                      >
                        <RefreshCw size={14} color="#6b7280" />
                        Retrain
                      </button>
                      <button
                        type="button"
                        style={{
                          border: '0.5px solid rgba(29,158,117,0.35)',
                          background: 'rgba(29,158,117,0.10)',
                          borderRadius: 10,
                          padding: '8px 10px',
                          fontSize: 12,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 7,
                          color: '#1D9E75',
                          fontWeight: 500,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(29,158,117,0.16)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(29,158,117,0.10)';
                        }}
                        onClick={async () => {
                          await modelsQ.refetch();
                        }}
                      >
                        <Rocket size={14} color="#1D9E75" />
                        Deploy
                      </button>
                      <button
                        type="button"
                        style={{
                          border: '0.5px solid rgba(226,75,74,0.35)',
                          background: 'rgba(226,75,74,0.08)',
                          borderRadius: 10,
                          padding: '8px 10px',
                          fontSize: 12,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 7,
                          color: '#E24B4A',
                          fontWeight: 500,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(226,75,74,0.12)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(226,75,74,0.08)';
                        }}
                        onClick={async () => {
                          await modelsQ.refetch();
                        }}
                      >
                        <Ban size={14} color="#E24B4A" />
                        Disable
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'rules' ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Rule engine</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Fraud detection rules and enforcement actions.</div>
            </div>
            <button
              type="button"
              onClick={() => setCreatingRule(true)}
              style={{
                background: '#1D9E75',
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
              }}
            >
              <Plus size={16} />
              Add rule
            </button>
          </div>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12,
              background: '#ffffff',
              border: '0.5px solid #e5e7eb',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
            }}
          >
            <thead>
              <tr style={{ background: '#f9fafb', borderTop: '0.5px solid #e5e7eb', borderBottom: '0.5px solid #e5e7eb' }}>
                {['Rule name', 'Severity', 'Trigger count', 'Status', 'Action'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      fontSize: 11,
                      color: '#6b7280',
                      fontWeight: 500,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rulesQ.isLoading ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14 }}>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div className="skeleton" style={{ height: 10, width: '60%', borderRadius: 999 }} />
                      <div className="skeleton" style={{ height: 10, width: '90%', borderRadius: 999 }} />
                      <div className="skeleton" style={{ height: 10, width: '75%', borderRadius: 999 }} />
                    </div>
                  </td>
                </tr>
              ) : rulesQ.isError ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14, color: '#b91c1c', fontSize: 12 }}>
                    Unable to load rules.
                  </td>
                </tr>
              ) : (rules ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14, color: '#6b7280', fontSize: 12 }}>
                    No data available.
                  </td>
                </tr>
              ) : (
                (rules ?? []).map((r) => {
                  const severity: 'high' | 'medium' | 'low' =
                    r.action === 'block' ? 'high' : r.action === 'alert' || r.action === 'flag' ? 'medium' : 'low';

                  return (
                    <tr
                      key={r.id}
                      style={{ borderBottom: '0.5px solid #e5e7eb' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f9fafb';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>{r.name}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <Badge variant={severity}>{severity.toUpperCase()}</Badge>
                      </td>
                      <td style={{ padding: '10px 12px' }}>{r.triggeredToday}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <Badge variant={r.active ? 'safe' : 'low'}>{r.active ? 'Active' : 'Disabled'}</Badge>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                          <Badge variant={actionToBadgeVariant(r.action)}>{r.action.toUpperCase()}</Badge>
                          <ToggleSwitch
                            checked={r.active}
                            onToggle={async () => {
                              // Keep UI responsive without calling non-existent /api/* routes.
                              await rulesQ.refetch();
                            }}
                          />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {creatingRule || editingRule ? (
            <Modal
              title={editingRule ? 'Edit rule' : 'Add rule'}
              onClose={() => {
                setCreatingRule(false);
                setEditingRule(null);
              }}
            >
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                Rule create/edit form is not implemented in this frontend build.
              </div>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingRule(false);
                    setEditingRule(null);
                  }}
                  style={{
                    border: '0.5px solid #e5e7eb',
                    background: '#ffffff',
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </Modal>
          ) : null}
        </div>
      ) : null}
    </PageWrapper>
  );
}
