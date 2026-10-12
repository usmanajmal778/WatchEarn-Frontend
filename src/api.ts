import type { AdClaimResult, AdCompletion, AdTask, AdWatchSession, AdminMathChallenge, AdminVideoPromotionSubmission, MathChallengeClaim, MathChallengeSubmission, MathQuestionCycle, MathQuestionSubmitResult, ReferralSummary, VideoPromotionSubmission, WithdrawalProof } from './types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';

const getToken = () => localStorage.getItem('watchearn_token') || '';
const getAdminToken = () => localStorage.getItem('watchearn_admin_token') || '';

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: Record<string, unknown> | string | FormData | null;
};

async function request<T>(path: string, options: RequestOptions = {}, tokenOverride?: string | null): Promise<T> {
  const headers = new Headers(options.headers || {});
  const token = tokenOverride === undefined ? getToken() : tokenOverride;

  const bodyValue = typeof options.body === 'string' || options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined;

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && typeof options.body !== 'string' && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    body: bodyValue as BodyInit | null | undefined,
    headers
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof data === 'string' ? data : data?.message || 'Request failed.';
    throw Object.assign(new Error(message), { status: response.status });
  }

  return data as T;
}

export const authApi = {
  register: (payload: Record<string, unknown>) => request<{ message: string }>('/auth/register', { method: 'POST', body: payload }),
  login: (payload: Record<string, unknown>) => request<{ token: string; user: any }>('/auth/login', { method: 'POST', body: payload }),
  me: () => request<{ user: any }>('/auth/me'),
  changePassword: (payload: Record<string, unknown>) => request<{ message: string }>('/auth/change-password', { method: 'POST', body: payload }),
  adminLogin: (payload: Record<string, unknown>) => request<{ token: string; user: any }>('/admin/auth', { method: 'POST', body: payload }, null),
  adminMe: () => request<{ user: any }>('/admin/auth/me', {}, getAdminToken())
};

export const publicConfigApi = {
  get: () => request<{ officialWhatsAppUrl: string }>('/public-config')
};

const getAnonymousId = (key: string) => {
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key, value);
  }
  return value;
};

const getAnonymousSessionId = () => {
  let value = sessionStorage.getItem('watchearn_analytics_session');
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem('watchearn_analytics_session', value);
  }
  return value;
};

export const analyticsApi = {
  track: (page: string) => request<{ recorded: boolean }>('/analytics/visit', {
    method: 'POST',
    body: {
      visitorId: getAnonymousId('watchearn_analytics_visitor'),
      sessionId: getAnonymousSessionId(),
      page
    }
  })
};

export const taskApi = {
  list: () => request<{ tasks: AdTask[]; totalCompleted: number; progress: string; maximumPerDay: number; dailyLimitCents: number; rewardCents: number; demoMode: boolean; server_now: string }>('/tasks'),
  startAd: (id: number) => request<AdWatchSession>(`/tasks/${id}/start`, { method: 'POST' }),
  claimAd: (id: number, sessionId: string) =>
    request<AdClaimResult>(`/tasks/${id}/claim`, { method: 'POST', body: { sessionId } }),
  mathQuestions: () => request<MathQuestionCycle>('/math-tasks'),
  submitMathQuestion: (cycleId: number, questionId: number, answer: string) =>
    request<MathQuestionSubmitResult>(`/math-tasks/${cycleId}/questions/${questionId}/submit`, { method: 'POST', body: { answer } }),
  submitMathAnswers: (payload: { cycleId: number; answers: Array<{ questionId: number; answer: string }> }) =>
    request<MathChallengeSubmission>('/math-tasks/submit', { method: 'POST', body: payload }),
  claimMathReward: (cycleId: number) =>
    request<MathChallengeClaim>('/math-tasks/claim', { method: 'POST', body: { cycleId } })
};

export const transactionApi = {
  list: () => request<{ transactions: any[] }>('/transactions')
};

export const referralApi = {
  list: () => request<ReferralSummary>('/referrals')
};

export const promoApi = {
  redeem: (payload: Record<string, unknown>) => request<{ message: string }>('/promo/redeem', { method: 'POST', body: payload })
};

export const withdrawalApi = {
  list: () => request<{ withdrawals: any[] }>('/withdrawals'),
  config: () => request<{
    minimumCents: number;
    referralRequirement: number;
    paymentMethods: { EasyPaisa: boolean; JazzCash: boolean };
  }>('/withdrawal-config'),
  proofs: () => request<{ proofs: WithdrawalProof[] }>('/withdrawal-proofs'),
  send: (payload: Record<string, unknown>) => request<{ message: string }>('/withdrawals', { method: 'POST', body: payload })
};

export const videoPromotionApi = {
  submit: (payload: Record<string, unknown>) => request<{ message: string; submissionId: number }>('/video-promotions', { method: 'POST', body: payload }),
  listMine: () => request<{ submissions: VideoPromotionSubmission[] }>('/video-promotions')
};

const adminRequest = <T>(path: string, options: RequestOptions = {}) => request<T>(path, options, getAdminToken());

export const adminApi = {
  dashboard: () => adminRequest<any>('/admin/dashboard'),
  tasks: () => adminRequest<{ tasks: any[]; rewardCents: number; completions: AdCompletion[] }>('/admin/tasks'),
  mathChallenges: () => adminRequest<{ enabled: boolean; cycles: AdminMathChallenge[] }>('/admin/math-challenges'),
  createTask: (payload: { title: string; description: string; isActive: boolean; rewardCents: number }) =>
    adminRequest<{ id: number; message: string }>('/admin/tasks', { method: 'POST', body: payload }),
  updateTask: (id: number, payload: { title?: string; description?: string; isActive?: boolean; rewardCents?: number }) =>
    adminRequest<{ message: string }>(`/admin/tasks/${id}`, { method: 'PATCH', body: payload }),
  deleteTask: (id: number) => adminRequest<{ message: string }>(`/admin/tasks/${id}`, { method: 'DELETE' }),
  users: (query = '') => adminRequest<{ users: any[]; page: number; limit: number; total: number; totalPages: number }>(`/admin/users?${new URLSearchParams(query)}`),
  user: (id: number) => adminRequest<{ user: any; transactions: any[]; referrals: any[] }>(`/admin/users/${id}`),
  suspendUser: (id: number, status: 'active' | 'suspended') => adminRequest<{ message: string }>(`/admin/users/${id}/suspend`, { method: 'POST', body: { status } }),
  settings: () => adminRequest<{ settings: any[] }>('/admin/settings'),
  updateSetting: (payload: Record<string, unknown>) => adminRequest<{ message: string }>('/admin/settings', { method: 'PUT', body: payload }),
  promoCodes: () => adminRequest<{ promoCodes: any[] }>('/admin/promo-codes'),
  createPromo: (payload: Record<string, unknown>) => adminRequest<{ id: number; code: string; message: string }>('/admin/promo-codes', { method: 'POST', body: payload }),
  updatePromo: (id: number, payload: { isActive: boolean; expiresAt?: string | null }) => adminRequest<{ message: string }>(`/admin/promo-codes/${id}`, { method: 'PATCH', body: payload }),
  promoRedemptions: (id: number) => adminRequest<{ redemptions: any[] }>(`/admin/promo-codes/${id}/redemptions`),
  activityLogs: (page = 1) => adminRequest<{ logs: any[]; page: number; limit: number; total: number }>(`/admin/activity-logs?page=${page}`),
  withdrawals: (filters: Record<string, string> = {}) => adminRequest<{ withdrawals: any[] }>(`/admin/withdrawals?${new URLSearchParams(filters)}`),
  updateWithdrawal: (id: number, payload: Record<string, unknown>) => adminRequest<{ message: string }>(`/admin/withdrawals/${id}`, { method: 'PATCH', body: payload }),
  videoPromotions: (status = 'all') => adminRequest<{ submissions: AdminVideoPromotionSubmission[] }>(`/admin/video-promotions?status=${encodeURIComponent(status)}`),
  reviewVideoPromotion: (id: number, payload: { status: 'approved' | 'rejected'; reason?: string }) =>
    adminRequest<{ message: string; status: string; alreadyReviewed: boolean }>(`/admin/video-promotions/${id}`, { method: 'PATCH', body: payload }),
  verifications: () => adminRequest<{ verifications: any[] }>('/admin/verifications'),
  updateVerification: (id: number, payload: Record<string, unknown>) => adminRequest<{ message: string }>(`/admin/verifications/${id}`, { method: 'PATCH', body: payload })
};
