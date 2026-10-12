import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import {
  ArrowDownCircle,
  ArrowUpRight,
  Activity,
  BarChart3,
  BadgeCheck,
  Banknote,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  CirclePlay,
  Clock3,
  Brain,
  Eye,
  ExternalLink,
  FileText,
  Gift,
  Home,
  ListChecks,
  LogOut,
  MessageCircle,
  Search,
  Settings,
  Tag,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  UserCircle2,
  Wallet,
  Video,
  XCircle
} from 'lucide-react';
import { adminApi, analyticsApi, authApi, promoApi, publicConfigApi, referralApi, taskApi, transactionApi, videoPromotionApi, withdrawalApi } from './api';
import type { AdCompletion, AdTask, AdminMathChallenge, AdminVideoPromotionSubmission, MathQuestionCycle, ReferralSummary, Tab, Transaction, User, VideoPromotionSubmission, WithdrawalProof } from './types';

const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const formatCountdown = (seconds: number) => {
  const hours = Math.floor(Math.max(0, seconds) / 3600);
  const minutes = Math.floor((Math.max(0, seconds) % 3600) / 60);
  return `${hours}h ${minutes}m`;
};
const formatClockCountdown = (seconds: number) => {
  const totalSeconds = Math.max(0, seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};
const parseRewardCents = (value: string) => {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fractional = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number((fractional + '00').slice(0, 2));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
};

const defaultAuth = {
  fullName: '',
  email: '',
  password: '',
  repeatPassword: '',
  referralCode: ''
};

type AppMessage = { type: 'success' | 'error' | 'info'; text: string };
type WithdrawalFeedback = { type: 'success' | 'error'; title: string; text: string };
type AdminSection = 'overview' | 'analytics' | 'users' | 'withdrawals' | 'promos' | 'tasks' | 'math-challenges' | 'activity' | 'settings' | 'video-promotions';

function WhatsAppChannelCard({ channelUrl, loading, error, buttonLabel = 'Join Official Channel' }: {
  channelUrl: string;
  loading: boolean;
  error: string;
  buttonLabel?: string;
}) {
  let safeChannelUrl = '';
  try {
    const parsedChannelUrl = new URL(channelUrl);
    if (parsedChannelUrl.protocol === 'https:') safeChannelUrl = parsedChannelUrl.toString();
  } catch {
    safeChannelUrl = '';
  }
  const channelError = error || (channelUrl && !safeChannelUrl ? 'The configured channel link is unavailable.' : '');

  return (
    <section className="whatsapp-channel-card">
      <span className="whatsapp-channel-icon"><MessageCircle size={21} aria-hidden="true" /></span>
      <div className="whatsapp-channel-content">
        <h3>Official WhatsApp Channel</h3>
        <p>Join our official channel for announcements, updates, promo codes, and important rewards information.</p>
        {channelError ? <p className="whatsapp-channel-error" role="status">{channelError}</p> : null}
        <a
          className={`whatsapp-join-button${safeChannelUrl ? '' : ' disabled'}`}
          href={safeChannelUrl || undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!safeChannelUrl}
          onClick={(event) => {
            if (!safeChannelUrl) event.preventDefault();
          }}
        >
          <MessageCircle size={17} aria-hidden="true" />
          {loading ? 'Loading channel…' : buttonLabel}
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

function Toast({ message }: { message: AppMessage | null }) {
  if (!message) return null;
  return (
    <div className={`toast-message ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'} aria-live={message.type === 'error' ? 'assertive' : 'polite'}>
      <span className="toast-indicator" aria-hidden="true" />
      <span>{message.text}</span>
    </div>
  );
}

function AvailableBalanceCard({ balanceCents }: { balanceCents: number }) {
  return (
    <div className="overview-card highlight">
      <div>
        <span>Available balance</span>
        <h3>{formatMoney(balanceCents)}</h3>
      </div>
      <div className="chip"><Wallet size={16} /> Active</div>
    </div>
  );
}

function App() {
  const [view, setView] = useState<'auth' | 'dashboard' | 'admin'>('auth');
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [tab, setTab] = useState<Tab>('home');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<AdTask[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawalConfig, setWithdrawalConfig] = useState({
    minimumCents: 2000,
    referralRequirement: 100,
    paymentMethods: { EasyPaisa: true, JazzCash: true }
  });
  const [videoSubmissions, setVideoSubmissions] = useState<VideoPromotionSubmission[]>([]);
  const [withdrawalProofs, setWithdrawalProofs] = useState<WithdrawalProof[]>([]);
  const [withdrawalProofIndex, setWithdrawalProofIndex] = useState(0);
  const [proofsError, setProofsError] = useState('');
  const [adminVideoSubmissions, setAdminVideoSubmissions] = useState<AdminVideoPromotionSubmission[]>([]);
  const [adminVideoStatus, setAdminVideoStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [adminSection, setAdminSection] = useState<AdminSection>('overview');
  const [adminTasks, setAdminTasks] = useState<any[]>([]);
  const [adminTaskCompletions, setAdminTaskCompletions] = useState<AdCompletion[]>([]);
  const [adminMathChallenges, setAdminMathChallenges] = useState<AdminMathChallenge[]>([]);
  const [adminTaskForm, setAdminTaskForm] = useState({ title: '', description: '', reward: '0.10' });
  const [editingAdminTaskId, setEditingAdminTaskId] = useState<number | null>(null);
  const [adminTaskSaving, setAdminTaskSaving] = useState(false);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminUsersTotal, setAdminUsersTotal] = useState(0);
  const [adminUsersPage, setAdminUsersPage] = useState(1);
  const [adminUsersTotalPages, setAdminUsersTotalPages] = useState(1);
  const [adminUserQuery, setAdminUserQuery] = useState('');
  const [adminUserStatusFilter, setAdminUserStatusFilter] = useState('');
  const [selectedAdminUser, setSelectedAdminUser] = useState<any>(null);
  const [adminWithdrawals, setAdminWithdrawals] = useState<any[]>([]);
  const [withdrawalFilters, setWithdrawalFilters] = useState({ status: '', paymentMethod: '', user: '', from: '', to: '' });
  const [adminPromoCodes, setAdminPromoCodes] = useState<any[]>([]);
  const [promoForm, setPromoForm] = useState({ code: '', reward: '', expiresAt: '', usageLimit: '1', eligibility: 'all', description: '' });
  const [createdPromo, setCreatedPromo] = useState<any>(null);
  const [promoRedemptions, setPromoRedemptions] = useState<any[]>([]);
  const [selectedPromoId, setSelectedPromoId] = useState<number | null>(null);
  const [adminActivityLogs, setAdminActivityLogs] = useState<any[]>([]);
  const [adminActivityPage, setAdminActivityPage] = useState(1);
  const [adminSettings, setAdminSettings] = useState<Record<string, string>>({});
  const [trafficRange, setTrafficRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoSubmitting, setVideoSubmitting] = useState(false);
  const [videoSubmissionLoading, setVideoSubmissionLoading] = useState(false);
  const [videoReviewReasons, setVideoReviewReasons] = useState<Record<number, string>>({});
  const [referrals, setReferrals] = useState<ReferralSummary['referrals']>([]);
  const [referralSummary, setReferralSummary] = useState<ReferralSummary | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [adminData, setAdminData] = useState<any>(null);
  const [showMessage, setShowMessage] = useState<AppMessage | null>(null);
  const [officialWhatsAppUrl, setOfficialWhatsAppUrl] = useState('');
  const [whatsAppConfigLoading, setWhatsAppConfigLoading] = useState(true);
  const [whatsAppConfigError, setWhatsAppConfigError] = useState('');
  const [withdrawalFeedback, setWithdrawalFeedback] = useState<WithdrawalFeedback | null>(null);
  const [taskLoading, setTaskLoading] = useState(true);
  const [taskError, setTaskError] = useState('');
  const [taskProgress, setTaskProgress] = useState({ totalCompleted: 0, maximumPerDay: 10, dailyLimitCents: 100, rewardCents: 10, demoMode: true });
  const [adsMode, setAdsMode] = useState<'ads' | 'math'>('ads');
  const [activeAdId, setActiveAdId] = useState<number | null>(null);
  const [adStartingId, setAdStartingId] = useState<number | null>(null);
  const [adClaimingId, setAdClaimingId] = useState<number | null>(null);
  const [mathCycle, setMathCycle] = useState<MathQuestionCycle | null>(null);
  const [mathLoading, setMathLoading] = useState(false);
  const [mathError, setMathError] = useState('');
  const [mathAnswers, setMathAnswers] = useState<Record<number, string>>({});
  const [submittingQuestionId, setSubmittingQuestionId] = useState<number | null>(null);
  const [mathSubmitting, setMathSubmitting] = useState(false);
  const [mathClaiming, setMathClaiming] = useState(false);
  const [authForm, setAuthForm] = useState(defaultAuth);
  const [changePasswordForm, setChangePasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('watchearn_token') || localStorage.getItem('watchearn_admin_token')));
  const toastTimeout = useRef<number | null>(null);
  const expiredMathCycleRef = useRef<number | null>(null);
  const cooldownRefreshRef = useRef(new Set<number>());
  const videoStatuses = useRef<Record<number, VideoPromotionSubmission['status']>>({});

  const token = localStorage.getItem('watchearn_token') || '';
  const adminToken = localStorage.getItem('watchearn_admin_token') || '';
  const isAdminRoute = pathname.replace(/\/+$/, '') === '/admin';

  const navigate = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setPathname(window.location.pathname);
  };

  const notify = (message: AppMessage) => {
    if (toastTimeout.current !== null) {
      window.clearTimeout(toastTimeout.current);
    }
    setShowMessage(message);
    toastTimeout.current = window.setTimeout(() => {
      setShowMessage(null);
      toastTimeout.current = null;
    }, 3000);
  };

  useEffect(() => () => {
    if (toastTimeout.current !== null) {
      window.clearTimeout(toastTimeout.current);
    }
  }, []);

  useEffect(() => {
    const syncPathname = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', syncPathname);
    return () => window.removeEventListener('popstate', syncPathname);
  }, []);

  const refreshAdTasks = async () => {
    const result = await taskApi.list();
    setTasks(result.tasks);
    setTaskProgress({
      totalCompleted: result.totalCompleted,
      maximumPerDay: result.maximumPerDay,
      dailyLimitCents: result.dailyLimitCents,
      rewardCents: result.rewardCents,
      demoMode: result.demoMode
    });
    for (const task of result.tasks) {
      if (task.status !== 'Cooldown' || task.remaining_seconds > 0) {
        cooldownRefreshRef.current.delete(task.id);
      }
    }
    return result;
  };

  useEffect(() => {
    if (isAdminRoute) setAuthMode('login');
  }, [isAdminRoute]);

  useEffect(() => {
    let active = true;
    publicConfigApi.get()
      .then(({ officialWhatsAppUrl: url }) => {
        if (active) setOfficialWhatsAppUrl(url);
      })
      .catch((error: unknown) => {
        if (active) setWhatsAppConfigError(error instanceof Error ? error.message : 'Unable to load the official channel link.');
      })
      .finally(() => {
        if (active) setWhatsAppConfigLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const page = view === 'dashboard' ? tab : view;
    if (page === 'admin') return;
    void analyticsApi.track(page).catch((error: unknown) => {
      console.warn('Could not record anonymous WatchEarn visit.', error);
    });
  }, [view, tab]);

  const refreshDashboard = async (currentUser?: User | null) => {
    if (!currentUser || currentUser.role === 'admin') return;

    setTaskLoading(true);
    setTaskError('');
    const [taskRes, txRes, refRes, withdrawalRes, withdrawalConfigRes, userRes] = await Promise.allSettled([
      taskApi.list(),
      transactionApi.list(),
      referralApi.list(),
      withdrawalApi.list(),
      withdrawalApi.config(),
      authApi.me()
    ]);

    if (taskRes.status === 'fulfilled') {
      setTasks(taskRes.value.tasks);
      setTaskProgress({
        totalCompleted: taskRes.value.totalCompleted,
        maximumPerDay: taskRes.value.maximumPerDay,
        dailyLimitCents: taskRes.value.dailyLimitCents,
        rewardCents: taskRes.value.rewardCents,
        demoMode: taskRes.value.demoMode
      });
    } else {
      setTasks([]);
      setTaskError(taskRes.reason instanceof Error ? taskRes.reason.message : 'Unable to load ads.');
    }
    setTaskLoading(false);

    if (txRes.status === 'fulfilled') setTransactions(txRes.value.transactions || []);
    if (refRes.status === 'fulfilled') {
      setReferrals(refRes.value.referrals || []);
      setReferralSummary(refRes.value);
    }
    if (withdrawalRes.status === 'fulfilled') setWithdrawals(withdrawalRes.value.withdrawals || []);
    if (withdrawalConfigRes.status === 'fulfilled') setWithdrawalConfig(withdrawalConfigRes.value);
    if (userRes.status === 'fulfilled') setUser(userRes.value.user as User);

    const dashboardError = [txRes, refRes, withdrawalRes, withdrawalConfigRes, userRes].find((result) => result.status === 'rejected');
    if (dashboardError?.status === 'rejected') throw dashboardError.reason;
  };

  const refreshMathQuestions = async () => {
    setMathLoading(true);
    setMathError('');
    try {
      const cycle = await taskApi.mathQuestions();
      setMathCycle(cycle);
      if (expiredMathCycleRef.current === cycle.cycleId && cycle.status !== 'reward_claimed') {
        expiredMathCycleRef.current = null;
      }
      setMathAnswers((current) => cycle.cycleId === mathCycle?.cycleId ? current : {});
    } catch (error) {
      setMathError(error instanceof Error ? error.message : 'Unable to load the current math questions.');
    } finally {
      setMathLoading(false);
    }
  };

  const startAd = async (task: AdTask) => {
    setAdStartingId(task.id);
    try {
      const session = await taskApi.startAd(task.id);
      setTasks((current) => current.map((entry) => entry.id === task.id
        ? {
            ...entry,
            status: session.remainingSeconds > 0 ? 'Watching' : 'Claim Reward',
            remaining_seconds: session.remainingSeconds,
            session_id: session.sessionId,
            cooldown_ends_at: null
          }
        : entry));
      setActiveAdId(task.id);
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Could not start this ad.' });
      try {
        await refreshAdTasks();
      } catch {
        setTaskError('Ad status could not be refreshed. Please retry.');
      }
    } finally {
      setAdStartingId(null);
    }
  };

  const claimAdReward = async () => {
    if (activeAdId === null) return;
    const task = tasks.find((entry) => entry.id === activeAdId);
    if (!task?.session_id || task.status !== 'Claim Reward' || task.remaining_seconds > 0) return;

    setAdClaimingId(task.id);
    try {
      const result = await taskApi.claimAd(task.id, task.session_id);
      setUser((current) => current ? {
        ...current,
        balance_cents: result.balanceCents,
        total_earnings_cents: result.totalEarningsCents
      } : current);
      setActiveAdId(null);
      setAdClaimingId(null);
      notify({ type: 'success', text: 'Reward Added Successfully!' });
      setTaskError('');
      try {
        await refreshAdTasks();
      } catch (error) {
        setTaskError(error instanceof Error ? error.message : 'Reward was added, but ad statuses could not be refreshed.');
      }
      void transactionApi.list().then((response) => setTransactions(response.transactions || [])).catch((error: unknown) => {
        console.error('Reward was added, but transaction history could not be refreshed.', error);
      });
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Could not claim this ad reward.' });
      try {
        await refreshAdTasks();
      } catch (refreshError) {
        setTaskError(refreshError instanceof Error ? refreshError.message : 'Ad status could not be refreshed.');
      }
    } finally {
      setAdClaimingId(null);
    }
  };

  const submitSingleMathQuestion = async (questionId: number) => {
    if (!mathCycle || submittingQuestionId !== null || mathCycle.status === 'reward_claimed') return;
    const rawAnswer = (mathAnswers[questionId] ?? '').trim();
    if (!rawAnswer) {
      notify({ type: 'error', text: 'Please enter an answer before submitting.' });
      return;
    }
    setSubmittingQuestionId(questionId);
    try {
      const result = await taskApi.submitMathQuestion(mathCycle.cycleId, questionId, rawAnswer);
      if (result.isCorrect && result.credited) {
        setUser((current) => current ? {
          ...current,
          balance_cents: result.balanceCents,
          total_earnings_cents: result.totalEarningsCents
        } : current);
        setMathCycle((current) => {
          if (!current) return current;
          const updatedQuestions = current.questions.map((q) =>
            q.id === questionId ? { ...q, correct: true, incorrect: false } : q
          );
          const correctCount = result.correctCount;
          const completed = correctCount === 10;
          return {
            ...current,
            status: completed ? 'reward_claimed' : 'in_progress',
            correctCount,
            rewardCents: result.rewardCents || correctCount * 10,
            remainingSeconds: completed ? (result.remainingSeconds || 86400) : current.remainingSeconds,
            questions: updatedQuestions
          };
        });
        notify({ type: 'success', text: 'Correct! You earned $0.10.' });
        void transactionApi.list().then((response) => setTransactions(response.transactions || [])).catch(() => {});
      } else {
        setMathCycle((current) => {
          if (!current) return current;
          return {
            ...current,
            questions: current.questions.map((q) =>
              q.id === questionId ? { ...q, correct: false, incorrect: true } : q
            )
          };
        });
        notify({ type: 'error', text: 'Incorrect answer. Please try again.' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not submit your answer.';
      notify({ type: 'error', text: message });
      if (/no longer current|refresh the challenge|completed and locked|already been completed/i.test(message)) {
        await refreshMathQuestions();
      }
    } finally {
      setSubmittingQuestionId(null);
    }
  };

  const submitMathAnswers = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!mathCycle || mathCycle.status === 'ready_to_claim' || mathCycle.status === 'reward_claimed') return;
    setMathSubmitting(true);
    try {
      const result = await taskApi.submitMathAnswers({
        cycleId: mathCycle.cycleId,
        answers: mathCycle.questions.map((question) => ({
          questionId: question.id,
          answer: mathAnswers[question.id] || ''
        }))
      });
      setMathCycle((current) => current ? {
        ...current,
        status: result.status,
        incorrectQuestionIds: result.incorrectQuestionIds,
        correctCount: result.correctCount,
        rewardCents: result.rewardCents,
        answeredCount: current.totalQuestions,
        questions: current.questions.map((question) => ({
          ...question,
          correct: !result.incorrectQuestionIds.includes(question.id),
          incorrect: result.incorrectQuestionIds.includes(question.id)
        }))
      } : current);
      notify({
        type: result.status === 'incorrect' ? 'error' : 'success',
        text: result.message
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not submit your answer.';
      notify({ type: 'error', text: message });
      if (/no longer current|refresh the challenge/i.test(message)) await refreshMathQuestions();
    } finally {
      setMathSubmitting(false);
    }
  };

  const claimMathReward = async () => {
    if (!mathCycle || mathCycle.status !== 'ready_to_claim' || mathClaiming) return;
    setMathClaiming(true);
    try {
      const result = await taskApi.claimMathReward(mathCycle.cycleId);
      setUser((current) => current ? {
        ...current,
        balance_cents: result.balanceCents,
        total_earnings_cents: result.totalEarningsCents
      } : current);
      setMathCycle((current) => current ? {
        ...current,
        status: 'reward_claimed',
        correctCount: result.correctCount,
        rewardCents: result.rewardCents,
        endsAt: result.cooldownEndsAt,
        remainingSeconds: result.remainingSeconds
      } : current);
      notify({ type: 'success', text: result.message });
      void transactionApi.list().then((response) => setTransactions(response.transactions || [])).catch((error: unknown) => {
        console.error('Math reward was added, but transaction history could not be refreshed.', error);
      });
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Could not claim the math reward.' });
      await refreshMathQuestions();
    } finally {
      setMathClaiming(false);
    }
  };

  const refreshAdmin = async () => {
    try {
      const data = await adminApi.dashboard();
      setAdminData(data);
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load admin data.' });
    }
  };

  const refreshAdminTasks = async () => {
    try {
      const result = await adminApi.tasks();
      setAdminTasks(result.tasks);
      setAdminTaskCompletions(result.completions);
      setTaskProgress((current) => ({ ...current, rewardCents: result.rewardCents }));
      if (editingAdminTaskId === null) {
        setAdminTaskForm((current) => ({ ...current, reward: formatMoney(result.rewardCents).slice(1) }));
      }
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load task management data.' });
    }
  };

  const refreshVideoSubmissions = async () => {
    setVideoSubmissionLoading(true);
    try {
      const result = await videoPromotionApi.listMine();
      const approved = result.submissions.find((submission) => videoStatuses.current[submission.id] === 'pending' && submission.status === 'approved');
      videoStatuses.current = Object.fromEntries(result.submissions.map((submission) => [submission.id, submission.status]));
      setVideoSubmissions(result.submissions);
      if (approved) notify({ type: 'success', text: 'Your WatchEarn video was approved and the $5 reward was credited to your balance.' });
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load your video submissions.' });
    } finally {
      setVideoSubmissionLoading(false);
    }
  };

  const refreshWithdrawalProofs = async () => {
    setProofsError('');
    try {
      const result = await withdrawalApi.proofs();
      setWithdrawalProofs(result.proofs);
    } catch (error) {
      setProofsError(error instanceof Error ? error.message : 'Unable to load completed withdrawals.');
    }
  };

  const refreshAdminVideoSubmissions = async (status = adminVideoStatus) => {
    try {
      const result = await adminApi.videoPromotions(status);
      setAdminVideoSubmissions(result.submissions);
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load video submissions.' });
    }
  };

  const refreshAdminMathChallenges = async () => {
    try {
      const result = await adminApi.mathChallenges();
      setAdminMathChallenges(result.cycles);
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load math challenge records.' });
    }
  };

  const refreshAdminUsers = async (page = adminUsersPage) => {
    try {
      const query = new URLSearchParams({ page: String(page), limit: '25' });
      if (adminUserQuery.trim()) query.set('search', adminUserQuery.trim());
      if (adminUserStatusFilter) query.set('status', adminUserStatusFilter);
      const result = await adminApi.users(query.toString());
      setAdminUsers(result.users);
      setAdminUsersTotal(result.total);
      setAdminUsersPage(result.page);
      setAdminUsersTotalPages(Math.max(1, result.totalPages));
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load users.' });
    }
  };

  const refreshAdminWithdrawals = async (filters = withdrawalFilters) => {
    try {
      const result = await adminApi.withdrawals(Object.fromEntries(Object.entries(filters).filter(([, value]) => value)));
      setAdminWithdrawals(result.withdrawals);
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load withdrawal requests.' });
    }
  };

  const refreshAdminPromoCodes = async () => {
    try {
      const result = await adminApi.promoCodes();
      setAdminPromoCodes(result.promoCodes);
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load promo codes.' });
    }
  };

  const refreshAdminActivity = async (page = adminActivityPage) => {
    try {
      const result = await adminApi.activityLogs(page);
      setAdminActivityLogs(result.logs);
      setAdminActivityPage(result.page);
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load activity logs.' });
    }
  };

  const refreshAdminSettings = async () => {
    try {
      const result = await adminApi.settings();
      setAdminSettings(Object.fromEntries(result.settings.map((setting: { key: string; value: string }) => [setting.key, setting.value])));
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load settings.' });
    }
  };

  const openAdminSection = (section: AdminSection) => {
    setAdminSection(section);
    if (section === 'analytics' || section === 'overview') void refreshAdmin();
    if (section === 'users') void refreshAdminUsers(1);
    if (section === 'withdrawals') void refreshAdminWithdrawals();
    if (section === 'promos') void refreshAdminPromoCodes();
    if (section === 'tasks') void refreshAdminTasks();
    if (section === 'math-challenges') void refreshAdminMathChallenges();
    if (section === 'activity') void refreshAdminActivity(1);
    if (section === 'settings') void refreshAdminSettings();
    if (section === 'video-promotions') void refreshAdminVideoSubmissions();
  };

  const saveAdminTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = adminTaskForm.title.trim();
    const description = adminTaskForm.description.trim();
    const rewardCents = parseRewardCents(adminTaskForm.reward);
    if (!title || !description || rewardCents === null) {
      notify({ type: 'error', text: 'Enter a task title, description, and a reward greater than $0.00.' });
      return;
    }
    setAdminTaskSaving(true);
    try {
      const result = editingAdminTaskId === null
        ? await adminApi.createTask({ title, description, isActive: true, rewardCents })
        : await adminApi.updateTask(editingAdminTaskId, { title, description, rewardCents });
      notify({ type: 'success', text: result.message });
      setAdminTaskForm({ title: '', description: '', reward: formatMoney(taskProgress.rewardCents).slice(1) });
      setEditingAdminTaskId(null);
      await refreshAdminTasks();
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Could not save this task.' });
    } finally {
      setAdminTaskSaving(false);
    }
  };

  const toggleAdminTask = async (task: any) => {
    try {
      const result = await adminApi.updateTask(task.id, { isActive: !task.is_active });
      notify({ type: 'success', text: result.message });
      await refreshAdminTasks();
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Could not update task status.' });
    }
  };

  const deleteAdminTask = async (task: any) => {
    if (!window.confirm(`Archive "${task.title}"? The ad will be disabled and all completion history will be preserved.`)) return;
    try {
      const result = await adminApi.deleteTask(task.id);
      notify({ type: 'success', text: result.message });
      if (editingAdminTaskId === task.id) {
        setEditingAdminTaskId(null);
        setAdminTaskForm({ title: '', description: '', reward: formatMoney(taskProgress.rewardCents).slice(1) });
      }
      await refreshAdminTasks();
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Could not delete task.' });
    }
  };

  const loadAdminUser = async (id: number) => {
    try {
      const result = await adminApi.user(id);
      setSelectedAdminUser(result);
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load user details.' });
    }
  };

  const handleAdminWithdrawal = async (request: any, status: 'approved' | 'rejected' | 'paid') => {
    let adminNote = '';
    if (status === 'paid' && !window.confirm(`Confirm that withdrawal #${request.id} has actually been paid?`)) return;
    if (status === 'rejected') {
      adminNote = window.prompt(`Enter a reason for rejecting withdrawal #${request.id}:`)?.trim() || '';
      if (!adminNote) {
        notify({ type: 'error', text: 'A rejection reason is required.' });
        return;
      }
    }
    try {
      const result = await adminApi.updateWithdrawal(request.id, { status, adminNote });
      notify({ type: 'success', text: result.message });
      await Promise.all([refreshAdminWithdrawals(), refreshAdmin()]);
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Unable to update withdrawal.' });
    }
  };

  const handleCreatePromo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rewardCents = Math.round(Number(promoForm.reward) * 100);
    if (!Number.isSafeInteger(rewardCents) || rewardCents < 1) {
      notify({ type: 'error', text: 'Enter a valid promo reward amount.' });
      return;
    }
    try {
      const result = await adminApi.createPromo({
        code: promoForm.code,
        rewardCents,
        expiresAt: promoForm.expiresAt || null,
        usageLimit: Number(promoForm.usageLimit),
        eligibility: promoForm.eligibility,
        description: promoForm.description
      });
      setCreatedPromo({ ...result, reward_cents: rewardCents, expires_at: promoForm.expiresAt || null, usage_limit: Number(promoForm.usageLimit), status: 'active' });
      setPromoForm({ code: '', reward: '', expiresAt: '', usageLimit: '1', eligibility: 'all', description: '' });
      notify({ type: 'success', text: result.message });
      await refreshAdminPromoCodes();
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Could not create promo code.' });
    }
  };

  const copyPromoCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      notify({ type: 'success', text: 'Promo code copied.' });
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Could not copy promo code.' });
    }
  };

  const sharePromoCode = (promo: any) => {
    const expiry = promo.expires_at ? new Date(promo.expires_at).toLocaleString() : 'no expiration date';
    const reward = formatMoney(Number(promo.reward_cents));
    const message = `WatchEarn Promo Code: ${promo.code}\n\nEligible users can redeem this code on WatchEarn before ${expiry}.\n\nReward: ${reward}\nRedemption is subject to the code's eligibility rules and usage limit.\n\nRedeem the code in the Daily promo code section of WatchEarn.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const copyPromoMessage = async (promo: any) => {
    const expiry = promo.expires_at ? new Date(promo.expires_at).toLocaleString() : 'no expiration date';
    const message = `WatchEarn Promo Code: ${promo.code}\n\nEligible users can redeem this code on WatchEarn before ${expiry}.\n\nReward: ${formatMoney(Number(promo.reward_cents))}\nRedemption is subject to the code's eligibility rules and usage limit.\n\nRedeem the code in the Daily promo code section of WatchEarn.`;
    try {
      await navigator.clipboard.writeText(message);
      notify({ type: 'success', text: 'Promo announcement copied. Publish it manually to your WhatsApp channel.' });
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Could not copy promo announcement.' });
    }
  };

  const updatePromoStatus = async (promo: any, isActive: boolean) => {
    try {
      const result = await adminApi.updatePromo(promo.id, { isActive });
      notify({ type: 'success', text: result.message });
      await refreshAdminPromoCodes();
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Could not update promo code.' });
    }
  };

  const expirePromoCode = async (promo: any) => {
    if (!window.confirm(`Expire promo code ${promo.code} immediately?`)) return;
    try {
      const result = await adminApi.updatePromo(promo.id, { isActive: false, expiresAt: new Date(Date.now() - 1000).toISOString() });
      notify({ type: 'success', text: result.message });
      await refreshAdminPromoCodes();
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Could not expire promo code.' });
    }
  };

  const loadPromoRedemptions = async (id: number) => {
    try {
      const result = await adminApi.promoRedemptions(id);
      setPromoRedemptions(result.redemptions);
      setSelectedPromoId(id);
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Could not load promo redemptions.' });
    }
  };

  useEffect(() => {
    const boot = async () => {
      if (isAdminRoute) {
        if (!adminToken) {
          setUser(null);
          setView('auth');
          setLoading(false);
          return;
        }
        try {
          setLoading(true);
          const res = await authApi.adminMe();
          setUser(res.user as User);
          setView('admin');
          await Promise.all([refreshAdmin(), refreshAdminVideoSubmissions('all')]);
        } catch {
          localStorage.removeItem('watchearn_admin_token');
          setUser(null);
          setView('auth');
        } finally {
          setLoading(false);
        }
        return;
      }

      if (!token) {
        setView('auth');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await authApi.me();
        const nextUser = res.user as User;
        if (nextUser.role !== 'user') {
          localStorage.removeItem('watchearn_token');
          setUser(null);
          setView('auth');
          return;
        }
        setUser(nextUser);
        setView('dashboard');
        await refreshDashboard(nextUser);
        await Promise.all([refreshVideoSubmissions(), refreshWithdrawalProofs()]);
      } catch {
        localStorage.removeItem('watchearn_token');
        setUser(null);
        setView('auth');
      } finally {
        setLoading(false);
      }
    };

    void boot();
  }, [token, adminToken, isAdminRoute]);

  useEffect(() => {
    if (view !== 'dashboard' || user?.role !== 'user') return;
    const interval = window.setInterval(() => void refreshWithdrawalProofs(), 60000);
    return () => window.clearInterval(interval);
  }, [view, user?.id]);

  useEffect(() => {
    if (view === 'dashboard' && tab === 'ads' && adsMode === 'math' && user?.role === 'user') {
      void refreshMathQuestions();
    }
  }, [view, tab, adsMode, user?.id]);

  useEffect(() => {
    if (view !== 'dashboard' || tab !== 'ads' || adsMode !== 'ads' || user?.role !== 'user') return;
    void refreshAdTasks().catch((error: unknown) => {
      setTaskError(error instanceof Error ? error.message : 'Unable to refresh ad statuses.');
    });
  }, [view, tab, adsMode, user?.id]);

  useEffect(() => {
    if (view !== 'dashboard' || tab !== 'ads' || adsMode !== 'ads') return;
    const interval = window.setInterval(() => {
      setTasks((current) => current.map((task) => {
        if ((task.status !== 'Watching' && task.status !== 'Cooldown') || task.remaining_seconds <= 0) return task;
        const remainingSeconds = Math.max(0, task.remaining_seconds - 1);
        return {
          ...task,
          remaining_seconds: remainingSeconds,
          status: task.status === 'Watching' && remainingSeconds === 0 ? 'Claim Reward' : task.status
        };
      }));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [view, tab, adsMode]);

  useEffect(() => {
    if (view !== 'dashboard' || tab !== 'ads' || adsMode !== 'ads') return;
    const expiredTasks = tasks.filter((task) =>
      task.status === 'Cooldown' && task.remaining_seconds <= 0 && !cooldownRefreshRef.current.has(task.id)
    );
    if (!expiredTasks.length) return;
    for (const task of expiredTasks) cooldownRefreshRef.current.add(task.id);
    void refreshAdTasks().catch((error: unknown) => {
      setTaskError(error instanceof Error ? error.message : 'Could not refresh an expired ad cooldown.');
    });
  }, [tasks, view, tab, adsMode]);

  useEffect(() => {
    if (view !== 'dashboard' || tab !== 'ads' || adsMode !== 'math' || !mathCycle) return;
    const interval = window.setInterval(() => {
      setMathCycle((current) => current
        ? { ...current, remainingSeconds: Math.max(0, current.remainingSeconds - 1) }
        : current);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [view, tab, adsMode, Boolean(mathCycle)]);

  useEffect(() => {
    if (view !== 'dashboard' || tab !== 'ads' || adsMode !== 'math' ||
        !mathCycle || mathCycle.status !== 'reward_claimed' || mathCycle.remainingSeconds > 0 || mathLoading ||
        expiredMathCycleRef.current === mathCycle.cycleId) return;
    expiredMathCycleRef.current = mathCycle.cycleId;
    void refreshMathQuestions();
  }, [view, tab, adsMode, mathCycle?.cycleId, mathCycle?.status, mathCycle?.remainingSeconds, mathLoading]);

  useEffect(() => {
    if (withdrawalProofs.length < 2) {
      setWithdrawalProofIndex(0);
      return;
    }
    const interval = window.setInterval(() => {
      setWithdrawalProofIndex((current) => (current + 1) % withdrawalProofs.length);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [withdrawalProofs.length]);

  useEffect(() => {
    if (view !== 'dashboard' || user?.role !== 'user') return;
    const interval = window.setInterval(() => void refreshVideoSubmissions(), 30000);
    return () => window.clearInterval(interval);
  }, [view, user?.id]);

  useEffect(() => {
    if (window.location.pathname.replace(/\/+$/, '') === '/admin') return;
    const referralCode = new URLSearchParams(window.location.search).get('ref');
    if (referralCode) {
      setAuthForm((current) => ({ ...current, referralCode }));
      setAuthMode('register');
    }
  }, []);

  const handleFieldChange = (field: keyof typeof authForm, value: string) => {
    setAuthForm((current) => ({ ...current, [field]: value }));
  };

  const handleRegister = async () => {
    if (!authForm.fullName || !authForm.email || !authForm.password || !authForm.repeatPassword) {
      notify({ type: 'error', text: 'Please complete all registration fields.' });
      return;
    }

    if (authForm.password !== authForm.repeatPassword) {
      notify({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    try {
      setLoading(true);
      const response = await authApi.register({
        fullName: authForm.fullName,
        email: authForm.email,
        password: authForm.password,
        repeatPassword: authForm.repeatPassword,
        referralCode: authForm.referralCode
      });
      notify({ type: 'success', text: response.message });
      setAuthMode('login');
      setAuthForm({ ...defaultAuth });
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Unable to register.' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!authForm.email || !authForm.password) {
      notify({ type: 'error', text: 'Please provide your email and password.' });
      return;
    }

    try {
      setLoading(true);
      if (isAdminRoute) {
        const response = await authApi.adminLogin({ email: authForm.email, password: authForm.password });
        if (response.user.role !== 'admin') {
          throw new Error('Admin access is required for this page.');
        }
        localStorage.setItem('watchearn_admin_token', response.token);
        setUser(response.user as User);
        setView('admin');
        navigate('/admin');
        setAuthForm({ ...defaultAuth });
        await Promise.all([refreshAdmin(), refreshAdminVideoSubmissions('all')]);
        return;
      }
      const response = await authApi.login({ email: authForm.email, password: authForm.password });
      localStorage.setItem('watchearn_token', response.token);
      setUser(response.user as User);
      setView('dashboard');
      setAuthForm({ ...defaultAuth });
      await refreshDashboard(response.user as User);
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Login failed.' });
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    if (user?.role === 'admin' || isAdminRoute) {
      localStorage.removeItem('watchearn_admin_token');
    } else {
      localStorage.removeItem('watchearn_token');
    }
    setUser(null);
    setActiveAdId(null);
    setTasks([]);
    navigate('/');
    setView('auth');
    setTab('home');
  };

  const handlePromoRedeem = async () => {
    if (!promoCode.trim()) {
      notify({ type: 'error', text: 'Enter a promo code to redeem.' });
      return;
    }

    try {
      setLoading(true);
      const response = await promoApi.redeem({ code: promoCode });
      notify({ type: 'success', text: 'Promo code claimed successfully!' });
      setPromoCode('');
      if (user) {
        await refreshDashboard(user);
      }
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Unable to redeem promo code.' });
    } finally {
      setLoading(false);
    }
  };

  const handleVideoPromotionSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      platform: String(form.get('platform') || ''),
      videoUrl: String(form.get('videoUrl') || '').trim(),
      title: String(form.get('title') || '').trim(),
      description: String(form.get('description') || '').trim()
    };
    setVideoSubmitting(true);
    try {
      const result = await videoPromotionApi.submit(payload);
      formElement.reset();
      setVideoModalOpen(false);
      await refreshVideoSubmissions();
      notify({ type: 'success', text: result.message });
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Could not submit this video for review.' });
    } finally {
      setVideoSubmitting(false);
    }
  };

  const handleVideoPromotionReview = async (submission: AdminVideoPromotionSubmission, status: 'approved' | 'rejected') => {
    const reason = videoReviewReasons[submission.id]?.trim() || '';
    if (status === 'rejected' && !reason) {
      notify({ type: 'error', text: 'Enter a rejection reason before rejecting this video.' });
      return;
    }
    try {
      const result = await adminApi.reviewVideoPromotion(submission.id, {
        status,
        ...(status === 'rejected' ? { reason } : {})
      });
      notify({ type: 'success', text: result.message });
      await Promise.all([refreshAdminVideoSubmissions(), refreshAdmin()]);
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Could not review this video.' });
    }
  };

  const handleWithdrawal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setWithdrawalFeedback(null);
    const availableBalanceCents = Number(user?.balance_cents || 0);
    const minimumCents = withdrawalConfig.minimumCents;
    if (availableBalanceCents < minimumCents) {
      setWithdrawalFeedback({
        type: 'error',
        title: 'Insufficient Balance.',
        text: `Your minimum withdrawal amount is ${formatMoney(minimumCents)}.`
      });
      return;
    }

    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('amount'));
    const amountCents = Math.round(amount * 100);
    if (!Number.isFinite(amount) || amountCents < minimumCents || Math.abs(amount * 100 - amountCents) > 0.000001) {
      setWithdrawalFeedback({
        type: 'error',
        title: 'Invalid withdrawal amount',
        text: `Enter an amount of at least ${formatMoney(minimumCents)}, using up to two decimal places.`
      });
      return;
    }
    if (amountCents > availableBalanceCents) {
      setWithdrawalFeedback({
        type: 'error',
        title: 'Insufficient balance',
        text: 'The withdrawal amount cannot exceed your available balance.'
      });
      return;
    }

    const paymentMethod = form.get('paymentMethod');
    const accountHolderName = String(form.get('accountHolderName') || '').trim();
    const accountNumber = String(form.get('accountNumber') || '').trim();
    if ((paymentMethod !== 'EasyPaisa' && paymentMethod !== 'JazzCash') ||
        (paymentMethod === 'EasyPaisa' && !withdrawalConfig.paymentMethods.EasyPaisa) ||
        (paymentMethod === 'JazzCash' && !withdrawalConfig.paymentMethods.JazzCash) ||
        !accountHolderName || !accountNumber) {
      setWithdrawalFeedback({
        type: 'error',
        title: 'Payment details required',
        text: 'Select an enabled payment method and enter the account holder name and mobile wallet number.'
      });
      return;
    }

    const payload = {
      amount,
      paymentMethod,
      accountHolderName,
      accountNumber
    };

    try {
      setLoading(true);
      const response = await withdrawalApi.send(payload);
      setWithdrawalFeedback({ type: 'success', title: 'Withdrawal request submitted', text: response.message });
      formElement.reset();
      if (user) {
        try {
          await refreshDashboard(user);
        } catch (refreshError) {
          const detail = refreshError instanceof Error ? refreshError.message : 'Unknown refresh error.';
          notify({ type: 'error', text: `Withdrawal submitted, but account information could not be refreshed: ${detail}` });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Withdrawal failed.';
      setWithdrawalFeedback({ type: 'error', title: 'Withdrawal request not submitted', text: message });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!user?.referral_link) return;
    try {
      await navigator.clipboard.writeText(user.referral_link);
      notify({ type: 'success', text: 'Referral link copied.' });
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Could not copy referral link.' });
    }
  };

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get('currentPassword') || '');
    const newPassword = String(form.get('newPassword') || '');

    if (!currentPassword || !newPassword) {
      notify({ type: 'error', text: 'Both password fields are required.' });
      return;
    }

    try {
      setLoading(true);
      const response = await authApi.changePassword({ currentPassword, newPassword });
      notify({ type: 'success', text: response.message });
      setChangePasswordForm({ currentPassword: '', newPassword: '' });
      event.currentTarget.reset();
    } catch (error) {
      notify({ type: 'error', text: error instanceof Error ? error.message : 'Could not update password.' });
    } finally {
      setLoading(false);
    }
  };

  const adminStats = useMemo(() => {
    if (!adminData) {
      return [] as Array<{ label: string; value: string; icon: any }>;
    }
    return [
      { label: 'Total visits', value: String(adminData.totalVisits || 0), icon: Eye },
      { label: 'Page views', value: String(adminData.totalPageViews || 0), icon: FileText },
      { label: 'Unique visitors', value: String(adminData.uniqueVisitors || 0), icon: Users },
      { label: "Today's visitors", value: String(adminData.visitorsToday || 0), icon: Activity },
      { label: 'Registered users', value: String(adminData.totalMembers || 0), icon: UserCircle2 },
      { label: 'New today', value: String(adminData.registrationsToday || 0), icon: Sparkles },
      { label: 'Pending withdrawals', value: String(adminData.pendingWithdrawals || 0), icon: Wallet },
      { label: 'Pending amount', value: formatMoney(Number(adminData.pendingWithdrawalAmountCents || 0)), icon: Banknote },
      { label: 'Successfully paid', value: String(adminData.paidWithdrawals || 0), icon: CheckCircle2 },
      { label: 'Paid amount', value: formatMoney(Number(adminData.paidWithdrawalAmountCents || 0)), icon: Banknote },
      { label: 'Promo rewards', value: formatMoney(Number(adminData.promoRewardsCents || 0)), icon: Gift }
    ];
  }, [adminData]);

  if (isAdminRoute && user && user.role !== 'admin') {
    return (
      <main className="app-stage">
        <section className="app-device auth-device">
          <div className="auth-shell">
            <div className="auth-card">
              <div className="brand-row">
                <div className="brand-logo">W</div>
                <div><p className="eyebrow">Restricted area</p><h1>Admin access required</h1></div>
              </div>
              <p className="screen-hint">This account is not authorized to access the Admin Panel.</p>
              <button className="primary-btn" onClick={() => navigate('/')}>Return to WatchEarn</button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (loading && !user && !adminData) {
    return <div className="loading-screen">Loading WatchEarn...</div>;
  }

  if (view === 'auth') {
    return (
      <main className="app-stage">
        <section className="app-device auth-device">
          <div className="auth-shell">
            <div className="auth-card">
              <div className="brand-row">
                <div className="brand-logo">W</div>
                <div>
                  <p className="eyebrow">Watch. Earn. Grow.</p>
                  <h1>WatchEarn</h1>
                </div>
              </div>

              <div className="toggle-row">
                <button className={authMode === 'login' ? 'toggle active' : 'toggle'} onClick={() => setAuthMode('login')}>
                  {isAdminRoute ? 'Admin Login' : 'Login'}
                </button>
                {!isAdminRoute ? (
                  <button className={authMode === 'register' ? 'toggle active' : 'toggle'} onClick={() => setAuthMode('register')}>
                    Register
                  </button>
                ) : null}
              </div>

              <Toast message={showMessage} />

              {authMode === 'register' ? (
                <>
                  <input value={authForm.fullName} placeholder="Full name" onChange={(e) => handleFieldChange('fullName', e.target.value)} />
                  <input value={authForm.email} placeholder="Email address" type="email" onChange={(e) => handleFieldChange('email', e.target.value)} />
                  <input value={authForm.password} placeholder="Password" type="password" onChange={(e) => handleFieldChange('password', e.target.value)} />
                  <input value={authForm.repeatPassword} placeholder="Repeat password" type="password" onChange={(e) => handleFieldChange('repeatPassword', e.target.value)} />
                  <input value={authForm.referralCode} placeholder="Referral code (optional)" onChange={(e) => handleFieldChange('referralCode', e.target.value)} />
                  <button className="primary-btn" onClick={handleRegister} disabled={loading}>{loading ? 'Creating...' : 'Create account'}</button>
                </>
              ) : (
                <>
                  <input value={authForm.email} placeholder="Email address" type="email" onChange={(e) => handleFieldChange('email', e.target.value)} />
                  <input value={authForm.password} placeholder="Password" type="password" onChange={(e) => handleFieldChange('password', e.target.value)} />
                  <button className="primary-btn" onClick={handleLogin} disabled={loading}>{loading ? 'Signing in...' : 'Login'}</button>
                </>
              )}

              <div className="auth-footer">
                <small>Secure authentication • JWT protected routes • SQLite backend</small>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (view === 'admin' && user?.role === 'admin') {
    const trafficRows = adminData?.traffic?.[trafficRange] || [];
    const maxTraffic = Math.max(1, ...trafficRows.map((row: any) => Number(row.visits || 0)));
    const adminNavigation: Array<{ id: AdminSection; label: string; icon: typeof Home }> = [
      { id: 'overview', label: 'Dashboard Overview', icon: Home },
      { id: 'analytics', label: 'Website Analytics', icon: BarChart3 },
      { id: 'users', label: 'User Management', icon: Users },
      { id: 'withdrawals', label: 'Withdrawals', icon: Wallet },
      { id: 'promos', label: 'Promo Code Generator', icon: Tag },
      { id: 'tasks', label: 'Task Management', icon: ListChecks },
      { id: 'math-challenges', label: 'Math Challenges', icon: Brain },
      { id: 'video-promotions', label: 'Video Reward Management', icon: Video },
      { id: 'settings', label: 'Payment Settings', icon: Settings },
      { id: 'activity', label: 'Admin Activity Logs', icon: Activity }
    ];
    const sectionTitle = adminNavigation.find(({ id }) => id === adminSection)?.label || 'Dashboard Overview';
    return (
      <main className="app-stage">
        <section className="app-device admin-device">
          <Toast message={showMessage} />
          <div className="dashboard-shell admin-shell">
            <header className="topbar">
              <div>
                <p className="eyebrow">Owner workspace</p>
                <h2>WatchEarn Control Panel</h2>
              </div>
              <div className="topbar-actions">
                <span className="admin-identity"><ShieldCheck size={15} /> {user.full_name}</span>
                <button className="ghost-btn" onClick={logout}><LogOut size={16} /> Logout</button>
              </div>
            </header>

            <div className="admin-layout">
              <nav className="admin-sidebar" aria-label="Admin sections">
                {adminNavigation.map(({ id, label, icon: Icon }) => (
                  <button key={id} className={adminSection === id ? 'admin-nav-item active' : 'admin-nav-item'} onClick={() => openAdminSection(id)}>
                    <Icon size={17} /><span>{label}</span>
                  </button>
                ))}
              </nav>

              <section className="admin-main">
                <div className="admin-page-heading">
                  <div><p className="eyebrow">WatchEarn administration</p><h1>{sectionTitle}</h1></div>
                  <button className="secondary-btn small" onClick={() => openAdminSection(adminSection)}><RefreshCw size={14} /> Refresh</button>
                </div>

                {(adminSection === 'overview' || adminSection === 'analytics') && (
                  <>
                    <div className="admin-stats-grid">
                      {(adminSection === 'overview' ? adminStats : adminStats.slice(0, 6)).map(({ label, value, icon: Icon }) => (
                        <article className="admin-stat-card" key={label}>
                          <span className="admin-stat-icon"><Icon size={17} /></span>
                          <span>{label}</span><strong>{value}</strong>
                        </article>
                      ))}
                    </div>
                    <section className="panel-card admin-chart-panel">
                      <div className="video-review-header">
                        <div><p className="eyebrow">Recorded anonymous sessions</p><h3>{adminSection === 'analytics' ? 'Website traffic' : 'Traffic snapshot'}</h3></div>
                        <div className="traffic-range-tabs">
                          {(['daily', 'weekly', 'monthly'] as const).map((range) => (
                            <button className={trafficRange === range ? 'video-filter active' : 'video-filter'} key={range} onClick={() => setTrafficRange(range)}>{range}</button>
                          ))}
                        </div>
                      </div>
                      <div className="traffic-legend"><span><i /> Visits</span><span><i className="visitor-legend" /> Unique visitors</span></div>
                      {trafficRows.length ? (
                        <div className="traffic-chart" role="img" aria-label={`${trafficRange} visit and unique visitor chart`}>
                          {trafficRows.map((row: any) => (
                            <div className="traffic-bar-column" key={row.period}>
                              <div className="traffic-bar-values"><strong>{row.visits}</strong><small>{row.visitors} unique</small></div>
                              <div className="traffic-bar-track">
                                <span className="traffic-bar" style={{ height: `${Math.max(4, (Number(row.visits) / maxTraffic) * 100)}%` }} />
                                <span className="traffic-visitor-bar" style={{ height: `${Math.max(3, (Number(row.visitors) / maxTraffic) * 100)}%` }} />
                              </div>
                              <small className="traffic-date">{adminSection === 'analytics' && trafficRange === 'monthly' ? row.period : adminSection === 'analytics' && trafficRange === 'weekly' ? row.label : String(row.period).slice(-5)}</small>
                            </div>
                          ))}
                        </div>
                      ) : <div className="empty-state admin-empty-chart">No recorded visits in this period yet.</div>}
                    </section>
                    {adminSection === 'overview' && (
                      <section className="panel-card">
                        <div className="section-subheading"><h3>Recent Admin Activity</h3><button className="text-button" onClick={() => openAdminSection('activity')}>View logs</button></div>
                        <ul className="activity-list">
                          {(adminData?.recentActivity || []).length ? adminData.recentActivity.map((event: any) => (
                            <li key={event.id}><strong>{event.action}</strong><span>{formatDate(event.created_at)}</span></li>
                          )) : <li className="empty-state">No admin activity recorded yet.</li>}
                        </ul>
                      </section>
                    )}
                  </>
                )}

                {adminSection === 'users' && (
                  <section className="panel-card admin-data-panel">
                    <form className="admin-filter-row" onSubmit={(event) => { event.preventDefault(); void refreshAdminUsers(1); }}>
                      <label className="admin-search"><Search size={16} /><input value={adminUserQuery} onChange={(event) => setAdminUserQuery(event.target.value)} placeholder="Search name, email, or user ID" /></label>
                      <select value={adminUserStatusFilter} onChange={(event) => { setAdminUserStatusFilter(event.target.value); window.setTimeout(() => void refreshAdminUsers(1), 0); }}>
                        <option value="">All account statuses</option><option value="active">Active</option><option value="suspended">Suspended</option>
                      </select>
                      <button className="primary-btn small" type="submit">Search</button>
                    </form>
                    <p className="admin-result-count">{adminUsersTotal} registered users</p>
                    {selectedAdminUser && (
                      <div className="admin-user-detail">
                        <div className="video-review-header">
                          <div><p className="eyebrow">User details</p><h3>{selectedAdminUser.user.full_name} · #{selectedAdminUser.user.id}</h3></div>
                          <button className="ghost-btn" onClick={() => setSelectedAdminUser(null)}>Close</button>
                        </div>
                        <div className="admin-detail-grid">
                          <span>Email<strong>{selectedAdminUser.user.email}</strong></span>
                          <span>Balance<strong>{formatMoney(selectedAdminUser.user.balance_cents)}</strong></span>
                          <span>Registered<strong>{formatDate(selectedAdminUser.user.created_at)}</strong></span>
                          <span>Referred members<strong>{selectedAdminUser.referrals.filter((item: any) => Number(item.referrer_id) === selectedAdminUser.user.id).length}</strong></span>
                          <span>Recent ledger entries<strong>{selectedAdminUser.transactions.length}</strong></span>
                        </div>
                      </div>
                    )}
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead><tr><th>User</th><th>Registered</th><th>Status</th><th>Balance</th><th>Referrals</th><th>Verified</th><th>Paid withdrawals</th><th /></tr></thead>
                        <tbody>{adminUsers.map((item) => (
                          <tr key={item.id}>
                            <td><strong>#{item.id} · {item.full_name}</strong><small>{item.email}</small></td>
                            <td>{formatDate(item.created_at)}</td><td><span className={`admin-status ${item.status}`}>{item.status}</span></td>
                            <td>{formatMoney(item.balance_cents)}</td><td>{item.referral_count}</td><td>{item.verified_referral_count}</td><td>{item.completed_withdrawals}</td>
                            <td className="admin-table-actions"><button className="text-button" onClick={() => void loadAdminUser(item.id)}>Details</button><button className="text-button" onClick={async () => {
                              const status = item.status === 'active' ? 'suspended' : 'active';
                              try { await adminApi.suspendUser(item.id, status); notify({ type: 'success', text: 'User status updated.' }); await Promise.all([refreshAdminUsers(), refreshAdmin()]); }
                              catch (error) { notify({ type: 'error', text: error instanceof Error ? error.message : 'Unable to update user.' }); }
                            }}>{item.status === 'active' ? 'Suspend' : 'Activate'}</button></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                    <div className="admin-pagination">
                      <button className="secondary-btn small" disabled={adminUsersPage <= 1} onClick={() => void refreshAdminUsers(adminUsersPage - 1)}><ChevronLeft size={14} /> Previous</button>
                      <span>Page {adminUsersPage} of {adminUsersTotalPages}</span>
                      <button className="secondary-btn small" disabled={adminUsersPage >= adminUsersTotalPages} onClick={() => void refreshAdminUsers(adminUsersPage + 1)}>Next <ChevronRight size={14} /></button>
                    </div>
                  </section>
                )}

                {adminSection === 'withdrawals' && (
                  <section className="panel-card admin-data-panel">
                    <form className="admin-filter-row withdrawal-admin-filters" onSubmit={(event) => { event.preventDefault(); void refreshAdminWithdrawals(); }}>
                      <select value={withdrawalFilters.status} onChange={(event) => setWithdrawalFilters((current) => ({ ...current, status: event.target.value }))}>
                        <option value="">All statuses</option>{['pending', 'approved', 'rejected', 'paid'].map((status) => <option key={status}>{status}</option>)}
                      </select>
                      <select value={withdrawalFilters.paymentMethod} onChange={(event) => setWithdrawalFilters((current) => ({ ...current, paymentMethod: event.target.value }))}>
                        <option value="">All methods</option><option>EasyPaisa</option><option>JazzCash</option>
                      </select>
                      <input placeholder="User, email, or request ID" value={withdrawalFilters.user} onChange={(event) => setWithdrawalFilters((current) => ({ ...current, user: event.target.value }))} />
                      <input aria-label="From date" type="date" value={withdrawalFilters.from} onChange={(event) => setWithdrawalFilters((current) => ({ ...current, from: event.target.value }))} />
                      <input aria-label="To date" type="date" value={withdrawalFilters.to} onChange={(event) => setWithdrawalFilters((current) => ({ ...current, to: event.target.value }))} />
                      <button className="primary-btn small" type="submit">Filter</button>
                    </form>
                    <p className="withdrawal-admin-warning">Only mark a request as Paid after independently confirming the transfer was sent.</p>
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead><tr><th>Request</th><th>User</th><th>Amount</th><th>Method &amp; account</th><th>Requested</th><th>Status</th><th>Admin action</th></tr></thead>
                        <tbody>{adminWithdrawals.map((item) => (
                          <tr key={item.id}>
                            <td>#{item.id}<small>{formatDate(item.created_at)}</small></td>
                            <td><strong>{item.user_full_name} · #{item.user_id}</strong><small>{item.user_email}</small></td>
                            <td><strong>{formatMoney(item.amount_cents)}</strong></td>
                            <td>{item.payment_method}<small>{item.account_holder_name} · {item.account_number}</small></td>
                            <td>{formatDate(item.created_at)}</td><td><span className={`admin-status ${item.status}`}>{item.status}</span></td>
                            <td className="admin-table-actions">
                              {item.status === 'pending' ? <><button className="text-button" onClick={() => void handleAdminWithdrawal(item, 'approved')}>Approve</button><button className="text-button danger" onClick={() => void handleAdminWithdrawal(item, 'rejected')}>Reject</button></> : null}
                              {item.status === 'approved' ? <><button className="text-button paid-action" onClick={() => void handleAdminWithdrawal(item, 'paid')}>Mark Paid</button><button className="text-button danger" onClick={() => void handleAdminWithdrawal(item, 'rejected')}>Reject</button></> : null}
                              {['paid', 'rejected'].includes(item.status) ? <span className="admin-result-note">{item.admin_note || 'Completed'}</span> : null}
                            </td>
                          </tr>
                        ))}</tbody>
                      </table>
                      {!adminWithdrawals.length ? <p className="empty-state admin-empty">No withdrawal requests match these filters.</p> : null}
                    </div>
                  </section>
                )}

                {adminSection === 'promos' && (
                  <div className="admin-promo-layout">
                    <section className="panel-card admin-data-panel">
                      <h3>Generate Promo Code</h3>
                      <p className="admin-section-description">Leave code blank to generate a unique code securely on the server.</p>
                      <form className="admin-promo-form" onSubmit={handleCreatePromo}>
                        <label>Custom code <small>(optional)</small><input maxLength={32} value={promoForm.code} onChange={(event) => setPromoForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="e.g. WELCOME25" /></label>
                        <div className="admin-form-grid">
                          <label>Reward (USD)<input type="number" min="0.01" max="10000" step="0.01" required value={promoForm.reward} onChange={(event) => setPromoForm((current) => ({ ...current, reward: event.target.value }))} /></label>
                          <label>Max redemptions<input type="number" min="1" max="1000000" step="1" required value={promoForm.usageLimit} onChange={(event) => setPromoForm((current) => ({ ...current, usageLimit: event.target.value }))} /></label>
                        </div>
                        <div className="admin-form-grid">
                          <label>Expiration date/time<input type="datetime-local" value={promoForm.expiresAt} onChange={(event) => setPromoForm((current) => ({ ...current, expiresAt: event.target.value }))} /></label>
                          <label>Eligibility<select value={promoForm.eligibility} onChange={(event) => setPromoForm((current) => ({ ...current, eligibility: event.target.value }))}><option value="all">All eligible users</option><option value="verified">Approved-verified users</option></select></label>
                        </div>
                        <label>Internal description<textarea maxLength={500} value={promoForm.description} onChange={(event) => setPromoForm((current) => ({ ...current, description: event.target.value }))} placeholder="Internal campaign notes" rows={2} /></label>
                        <button className="primary-btn" type="submit"><Tag size={15} /> Generate Promo Code</button>
                      </form>
                      {createdPromo ? <div className="generated-promo-card">
                        <span className="eyebrow">Promo code created</span><strong>{createdPromo.code}</strong>
                        <span>{formatMoney(createdPromo.reward_cents)} reward · limit {createdPromo.usage_limit}{createdPromo.expires_at ? ` · expires ${formatDate(createdPromo.expires_at)}` : ' · no expiry'}</span>
                        <div className="promo-actions">
                          <button className="secondary-btn small" onClick={() => void copyPromoCode(createdPromo.code)}><Clipboard size={14} /> Copy code</button>
                          <button className="secondary-btn small" onClick={() => sharePromoCode(createdPromo)}><MessageCircle size={14} /> Share on WhatsApp</button>
                          <button className="text-button" onClick={() => void copyPromoMessage(createdPromo)}>Copy message</button>
                        </div>
                        <small>WhatsApp sharing prepares a message; publish it manually.</small>
                      </div> : null}
                    </section>
                    <section className="panel-card admin-data-panel">
                      <div className="section-subheading"><h3>Promo Codes</h3><span>{adminPromoCodes.length} total</span></div>
                      <div className="promo-admin-list">
                        {adminPromoCodes.map((promo) => (
                          <article className="promo-admin-card" key={promo.id}>
                            <div className="promo-admin-heading"><strong>{promo.code}</strong><span className={`admin-status ${promo.status}`}>{promo.status}</span></div>
                            <p>{formatMoney(Number(promo.reward_cents))} reward · {promo.redemption_count}/{promo.usage_limit} redeemed</p>
                            <small>{promo.description || (promo.eligibility === 'verified' ? 'Approved-verified users only' : 'All eligible users')} · {promo.expires_at ? `Expires ${new Date(promo.expires_at).toLocaleString()}` : 'No expiration'}</small>
                            <div className="promo-actions">
                              <button className="secondary-btn small" onClick={() => void copyPromoCode(promo.code)}><Clipboard size={13} /> Copy</button>
                              <button className="secondary-btn small" onClick={() => sharePromoCode(promo)}><MessageCircle size={13} /> WhatsApp</button>
                              <button className="text-button" onClick={() => void loadPromoRedemptions(promo.id)}>Redemptions</button>
                              {promo.status !== 'expired' ? <button className="text-button" onClick={() => void updatePromoStatus(promo, !promo.is_active)}>{promo.is_active ? 'Deactivate' : 'Activate'}</button> : null}
                              {promo.status !== 'expired' ? <button className="text-button danger" onClick={() => void expirePromoCode(promo)}>Expire now</button> : null}
                            </div>
                          </article>
                        ))}
                        {!adminPromoCodes.length ? <p className="empty-state">No promo codes have been created.</p> : null}
                      </div>
                      {selectedPromoId !== null ? <div className="promo-redemption-history">
                        <div className="section-subheading"><h4>Redemption history</h4><button className="text-button" onClick={() => { setSelectedPromoId(null); setPromoRedemptions([]); }}>Close</button></div>
                        {promoRedemptions.length ? promoRedemptions.map((entry) => (
                          <div className="promo-redemption-row" key={entry.id}><span>#{entry.user_id} · {entry.full_name}<small>{entry.email}</small></span><strong>{formatMoney(entry.amount_cents)}</strong><time>{formatDate(entry.redeemed_at)}</time></div>
                        )) : <p className="empty-state">No redemptions recorded for this code.</p>}
                      </div> : null}
                    </section>
                  </div>
                )}

                {adminSection === 'tasks' && (
                  <>
                    <section className="panel-card admin-data-panel">
                      <h3>{editingAdminTaskId === null ? 'Create task' : `Edit task #${editingAdminTaskId}`}</h3>
                      <p className="admin-section-description">
                        Manage the ten in-app ads, their individual rewards, and availability. Creating a new ad adds it to the ten-ad catalog while older task and completion records are retained.
                      </p>
                      <form className="admin-promo-form" onSubmit={(event) => void saveAdminTask(event)}>
                        <label>Ad title<input maxLength={100} required value={adminTaskForm.title} onChange={(event) => setAdminTaskForm((current) => ({ ...current, title: event.target.value }))} /></label>
                        <label>Description<textarea maxLength={500} required rows={3} value={adminTaskForm.description} onChange={(event) => setAdminTaskForm((current) => ({ ...current, description: event.target.value }))} /></label>
                        <label>Reward (USD)<input type="number" min="0.01" max="10000" step="0.01" required value={adminTaskForm.reward} onChange={(event) => setAdminTaskForm((current) => ({ ...current, reward: event.target.value }))} /></label>
                        <div className="promo-actions">
                          <button className="primary-btn small" type="submit" disabled={adminTaskSaving}>{adminTaskSaving ? 'Saving…' : editingAdminTaskId === null ? 'Create ad' : 'Save ad'}</button>
                          {editingAdminTaskId !== null ? <button className="secondary-btn small" type="button" onClick={() => { setEditingAdminTaskId(null); setAdminTaskForm({ title: '', description: '', reward: formatMoney(taskProgress.rewardCents).slice(1) }); }}>Cancel edit</button> : null}
                        </div>
                      </form>
                    </section>
                    <section className="panel-card admin-data-panel">
                      <div className="section-subheading"><h3>Ad tasks</h3><span>{adminTasks.length} / 10</span></div>
                      <div className="admin-table-wrap">
                        <table className="admin-table task-admin-table">
                          <thead><tr><th>Ad</th><th>Reward</th><th>Completions</th><th>Rewards credited</th><th>Status</th><th>Actions</th></tr></thead>
                          <tbody>{adminTasks.map((task) => (
                            <tr key={task.id}>
                              <td><strong>#{task.id} · {task.title}</strong><small>{task.description}</small></td>
                              <td>{formatMoney(Number(task.reward_cents))}</td>
                              <td>{Number(task.completion_count || 0)}</td>
                              <td>{formatMoney(Number(task.rewards_paid_cents || 0))}</td>
                              <td><span className={`admin-status ${task.is_active ? 'active' : 'inactive'}`}>{task.is_active ? 'Active' : 'Inactive'}</span></td>
                              <td className="admin-table-actions">
                                <button className="text-button" onClick={() => { setEditingAdminTaskId(task.id); setAdminTaskForm({ title: task.title, description: task.description, reward: (Number(task.reward_cents) / 100).toFixed(2) }); }}>Edit</button>
                                <button className="text-button" onClick={() => void toggleAdminTask(task)}>{task.is_active ? 'Deactivate' : 'Activate'}</button>
                                <button className="text-button danger" onClick={() => void deleteAdminTask(task)}>Archive</button>
                              </td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                      {!adminTasks.length ? <p className="empty-state">No ad tasks are configured.</p> : null}
                    </section>
                    <section className="panel-card admin-data-panel">
                      <div className="section-subheading"><h3>Genuine ad completions</h3><span>Latest {adminTaskCompletions.length}</span></div>
                      <div className="admin-table-wrap">
                        <table className="admin-table task-admin-table">
                          <thead><tr><th>User</th><th>Ad</th><th>Reward credited</th><th>Completed at</th></tr></thead>
                          <tbody>{adminTaskCompletions.map((completion) => (
                            <tr key={completion.id}>
                              <td><strong>{completion.username} · #{completion.user_id}</strong></td>
                              <td>{completion.task_title} · #{completion.task_id}</td>
                              <td>{formatMoney(completion.reward_cents)}</td>
                              <td>{completion.completed_at ? new Date(completion.completed_at).toLocaleString() : '—'}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                      {!adminTaskCompletions.length ? <p className="empty-state">No genuine ad reward completions have been recorded.</p> : null}
                    </section>
                  </>
                )}

                {adminSection === 'math-challenges' && (
                  <section className="panel-card admin-data-panel">
                    <div className="section-subheading"><h3>Math challenge attempts</h3><span>Latest {adminMathChallenges.length}</span></div>
                    <p className="admin-section-description">Challenge attempts and claimed rewards from verified database records.</p>
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead><tr><th>User / challenge</th><th>Submitted</th><th>Correct</th><th>Earned</th><th>Claim status</th><th>Claimed at</th></tr></thead>
                        <tbody>{adminMathChallenges.map((cycle) => (
                          <tr key={cycle.id}>
                            <td><strong>{cycle.username} · #{cycle.user_id}</strong><small>{cycle.email} · Cycle #{cycle.cycle_number} · Challenge #{cycle.id}</small></td>
                            <td>{cycle.answered_count}/10</td>
                            <td>{cycle.correct_count}/10</td>
                            <td>{formatMoney(cycle.reward_cents)}</td>
                            <td><span className={`admin-status ${cycle.reward_transaction_id ? 'active' : 'inactive'}`}>{cycle.reward_transaction_id ? 'Claimed' : 'Not claimed'}</span></td>
                            <td>{cycle.reward_claimed_at ? new Date(cycle.reward_claimed_at).toLocaleString() : '—'}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                    {!adminMathChallenges.length ? <p className="empty-state">No math challenge attempts have been recorded.</p> : null}
                  </section>
                )}

                {adminSection === 'settings' && (
                  <section className="panel-card admin-data-panel">
                    <h3>Payment Methods</h3>
                    <p className="admin-section-description">The existing withdrawal workflow supports these mobile wallets. No payment is sent automatically; admin confirmation is required before marking a request Paid.</p>
                    <div className="payment-settings-grid"><div><Smartphone size={18} /><strong>EasyPaisa</strong><span>Enabled · manual processing</span></div><div><Smartphone size={18} /><strong>JazzCash</strong><span>Enabled · manual processing</span></div></div>
                    <div className="settings-divider" />
                    <form className="admin-promo-form" onSubmit={async (event) => {
                      event.preventDefault();
                      const url = adminSettings.official_whatsapp_url || '';
                      try {
                        const result = await adminApi.updateSetting({ key: 'official_whatsapp_url', value: url });
                        setOfficialWhatsAppUrl(url);
                        notify({ type: 'success', text: result.message });
                      } catch (error) { notify({ type: 'error', text: error instanceof Error ? error.message : 'Could not update the channel link.' }); }
                    }}>
                      <h3>Official WhatsApp Channel</h3>
                      <label>Configured channel URL<input type="url" required value={adminSettings.official_whatsapp_url || ''} onChange={(event) => setAdminSettings((current) => ({ ...current, official_whatsapp_url: event.target.value }))} /></label>
                      <button className="primary-btn" type="submit">Save official channel link</button>
                    </form>
                    <p className="admin-section-description admin-rule-note">Withdrawal minimum: $20.00 · Requirement: 100 active referrals, each with at least two active referred members.</p>
                  </section>
                )}

                {adminSection === 'activity' && (
                  <section className="panel-card admin-data-panel">
                    <h3>Admin Activity Logs</h3>
                    <div className="admin-log-list">{adminActivityLogs.map((log) => (
                      <article className="admin-log-row" key={log.id}><span className="admin-log-icon"><Activity size={15} /></span><div><strong>{log.action}</strong><p>{log.details || 'No additional details.'}</p><small>{log.actor_name || (log.actor_id ? `Admin #${log.actor_id}` : 'System')} · {new Date(log.created_at).toLocaleString()}</small></div></article>
                    ))}{!adminActivityLogs.length ? <p className="empty-state">No activity logs recorded.</p> : null}</div>
                    <div className="admin-pagination"><button className="secondary-btn small" disabled={adminActivityPage <= 1} onClick={() => void refreshAdminActivity(adminActivityPage - 1)}><ChevronLeft size={14} /> Previous</button><span>Page {adminActivityPage}</span><button className="secondary-btn small" disabled={adminActivityLogs.length < 50} onClick={() => void refreshAdminActivity(adminActivityPage + 1)}>Next <ChevronRight size={14} /></button></div>
                  </section>
                )}

                {adminSection === 'video-promotions' && (
                  <section className="panel-card video-review-panel" aria-label="Video reward management">
                    <div className="video-review-header"><div><p className="eyebrow">Admin review queue</p><h3>Video Reward Management</h3></div></div>
                    <div className="video-status-filters" role="group" aria-label="Filter video submissions">
                      {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                        <button key={status} className={adminVideoStatus === status ? 'video-filter active' : 'video-filter'} onClick={() => { setAdminVideoStatus(status); void refreshAdminVideoSubmissions(status); }}>{status === 'all' ? 'All' : `${status[0].toUpperCase()}${status.slice(1)}`}</button>
                      ))}
                    </div>
                    <div className="video-review-list">
                      {adminVideoSubmissions.length ? adminVideoSubmissions.map((submission) => (
                        <article className="video-review-card" key={submission.id}>
                          <div className="video-review-title"><div><strong>{submission.title || `${submission.platform} video`}</strong><small>{submission.username} · User #{submission.user_id}</small></div><span className={`video-status ${submission.status}`}>{submission.status === 'pending' ? 'Pending Review' : submission.status}</span></div>
                          <div className="video-submission-meta"><span>{submission.platform}</span><span>Submitted {formatDate(submission.submitted_at)}</span>{submission.suspicious_duplicate ? <span className="duplicate-flag">Duplicate link flagged</span> : null}</div>
                          {submission.description ? <p className="video-description">{submission.description}</p> : null}
                          <a className="video-link" href={submission.video_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open submitted video</a>
                          {submission.status === 'pending' ? <div className="video-review-actions"><input value={videoReviewReasons[submission.id] || ''} maxLength={1000} placeholder="Rejection reason (required to reject)" aria-label={`Rejection reason for video ${submission.id}`} onChange={(event) => setVideoReviewReasons((current) => ({ ...current, [submission.id]: event.target.value }))} /><div className="video-review-buttons"><button className="primary-btn small" onClick={() => void handleVideoPromotionReview(submission, 'approved')}><Check size={14} /> Approve · $5</button><button className="secondary-btn small reject-video-btn" onClick={() => void handleVideoPromotionReview(submission, 'rejected')}>Reject</button></div></div> : submission.admin_reason ? <p className="video-rejection-reason">Review note: {submission.admin_reason}</p> : null}
                        </article>
                      )) : <p className="empty-state">No video submissions in this view.</p>}
                    </div>
                  </section>
                )}
              </section>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const activeAd = activeAdId === null ? null : tasks.find((task) => task.id === activeAdId) || null;
  const hasMathInput = Object.values(mathAnswers).some((answer) => answer.trim() !== '');
  const mathDisplayStatus = mathCycle?.status === 'not_started' && hasMathInput ? 'in_progress' : mathCycle?.status || 'not_started';
  const mathStatusLabels: Record<string, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    incorrect: 'Incorrect Answers',
    ready_to_claim: 'Ready to Claim',
    reward_claimed: 'Reward Claimed'
  };

  return (
    <main className="app-stage">
      <section className="app-device">
    <Toast message={showMessage} />
    <div className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Welcome back</p>
          <h2>{user?.full_name?.split(' ')[0] || 'Member'}</h2>
        </div>
        <div className="topbar-actions">
          <button className="avatar avatar-button" aria-label="Open profile" onClick={() => setTab('profile')}>
            {user?.full_name?.slice(0, 1).toUpperCase() || 'W'}
          </button>
        </div>
      </header>

      {tab === 'home' && (
        <div className="content-stack">
          <section className={`verified-payout-notice${proofsError ? ' has-error' : ''}`} aria-label="Verified payouts">
            <BadgeCheck className="verified-payout-icon" size={19} aria-hidden="true" />
            <div className="verified-payout-copy">
              <strong>Verified Payouts</strong>
              <span
                key={proofsError ? 'error' : withdrawalProofs[withdrawalProofIndex % Math.max(withdrawalProofs.length, 1)]?.paid_at || 'empty'}
                className="verified-payout-message"
                aria-live="polite"
              >
                {proofsError
                  ? 'Payout activity is temporarily unavailable'
                  : withdrawalProofs.length
                    ? `A member received a ${formatMoney(withdrawalProofs[withdrawalProofIndex % withdrawalProofs.length].amount_cents)} payout.`
                    : 'Recent payouts will appear here.'}
              </span>
            </div>
          </section>
          <AvailableBalanceCard balanceCents={user?.balance_cents || 0} />

          <div className="summary-grid">
            <div className="summary-card">
              <span>Today’s earnings</span>
              <strong>{formatMoney((transactions || []).filter((item) => item.created_at?.slice(0, 10) === new Date().toISOString().slice(0, 10) && item.amount_cents > 0).reduce((sum, item) => sum + Number(item.amount_cents), 0))}</strong>
            </div>
            <div className="summary-card">
              <span>Total lifetime</span>
              <strong>{formatMoney(user?.total_earnings_cents || 0)}</strong>
            </div>
            <div className="summary-card">
              <span>Ads in last 24h</span>
              <strong>{taskProgress.totalCompleted}/{taskProgress.maximumPerDay}</strong>
              <div className="progress-track summary-progress" role="progressbar" aria-label="Ad rewards claimed in the last 24 hours" aria-valuemin={0} aria-valuemax={taskProgress.maximumPerDay} aria-valuenow={taskProgress.totalCompleted}>
                <div className="progress-fill" style={{ width: `${Math.min(100, taskProgress.totalCompleted / taskProgress.maximumPerDay * 100)}%` }} />
              </div>
            </div>
            <div className="summary-card">
              <span>Active referrals</span>
              <strong>{referralSummary?.active_referrals ?? 0}</strong>
            </div>
          </div>

          <div className="quick-actions">
            <button className="primary-btn" onClick={() => setTab('ads')}><Smartphone size={16} /> View ads</button>
            <button className="secondary-btn" onClick={() => setTab('withdraw')}><ArrowDownCircle size={16} /> Withdraw</button>
            <button className="secondary-btn" onClick={handleCopyLink}><Gift size={16} /> Copy referral link</button>
            <button className="secondary-btn" onClick={() => document.getElementById('promo-entry')?.focus()}><Sparkles size={16} /> Promo code</button>
          </div>

          <div className="card-row">
            <WhatsAppChannelCard
              channelUrl={officialWhatsAppUrl}
              loading={whatsAppConfigLoading}
              error={whatsAppConfigError}
            />

            <div className="panel-card">
              <h3>Daily promo code</h3>
              <div className="promo-form">
                <input id="promo-entry" value={promoCode} placeholder="Enter promo code" onChange={(e) => setPromoCode(e.target.value)} />
                <button className="primary-btn" onClick={handlePromoRedeem}>Redeem</button>
              </div>
            </div>
          </div>

          <div className="panel-card">
            <h3>Recent transactions</h3>
            <ul className="activity-list">
              {(transactions || []).length ? transactions.slice(0, 6).map((item) => (
                <li key={item.id}><strong>{item.description}</strong><span className={item.amount_cents >= 0 ? 'amount-positive' : 'amount-negative'}>{item.amount_cents > 0 ? '+' : ''}{formatMoney(Number(item.amount_cents))}</span></li>
              )) : <li className="empty-state">No transactions yet. Verified earnings and account activity will appear here.</li>}
            </ul>
          </div>

          <section className="panel-card promotion-card promotion-card-bottom">
            <div className="promotion-heading">
              <span className="promotion-icon"><Video size={19} /></span>
              <div className="promotion-title">
                <p className="eyebrow">Creator rewards</p>
                <h3>Create a Video &amp; Earn $5</h3>
              </div>
              <span className="promotion-reward-badge"><Video size={13} /> $5 reward</span>
            </div>
            <p>Create a video about WatchEarn, share it on YouTube, TikTok, Facebook, or Instagram, and submit your video link for review.</p>
            <button className="primary-btn" onClick={() => setVideoModalOpen(true)}><Video size={16} /> Submit Your Video</button>
            <div className="video-submissions">
              <div className="section-subheading">
                <h4>Your video submissions</h4>
                <button className="text-button" onClick={() => void refreshVideoSubmissions()} disabled={videoSubmissionLoading}>
                  <RefreshCw size={13} /> {videoSubmissionLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
              {videoSubmissions.length ? (
                <div className="video-submission-list">
                  {videoSubmissions.map((submission) => (
                    <article className="video-submission-card" key={submission.id}>
                      <div className="video-review-title">
                        <div>
                          <strong>{submission.title || `${submission.platform} video`}</strong>
                          <small>{submission.platform} · Submitted {formatDate(submission.submitted_at)}</small>
                        </div>
                        <span className={`video-status ${submission.status}`}>{submission.status === 'pending' ? 'Pending' : submission.status}</span>
                      </div>
                      <a className="video-link" href={submission.video_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> View public video</a>
                      <p className="video-reward-status">
                        {submission.status === 'approved' ? `Reward credited: ${formatMoney(submission.reward_cents)}` : submission.status === 'rejected' ? 'No reward credited' : 'Reward: $5.00 if approved'}
                      </p>
                      {submission.status === 'rejected' && submission.admin_reason ? <p className="video-rejection-reason">Reason: {submission.admin_reason}</p> : null}
                    </article>
                  ))}
                </div>
              ) : <p className="empty-state">{videoSubmissionLoading ? 'Loading your video submissions…' : 'No video submissions yet.'}</p>}
            </div>
          </section>
        </div>
      )}

      {tab === 'ads' && (
        <div className="content-stack">
          <div className="ads-mode-switch" role="tablist" aria-label="Task type">
            <button className={adsMode === 'ads' ? 'active' : ''} role="tab" aria-selected={adsMode === 'ads'} onClick={() => setAdsMode('ads')}><CirclePlay size={15} /> Watch Ads</button>
            <button className={adsMode === 'math' ? 'active' : ''} role="tab" aria-selected={adsMode === 'math'} onClick={() => setAdsMode('math')}><Brain size={15} /> Math Tasks</button>
          </div>
          {adsMode === 'ads' ? <>
          <header className="ads-header">
            <div>
              <p className="eyebrow">In-app earning tasks</p>
              <h1>Watch &amp; Earn</h1>
              <p>Watch each promotion inside WatchEarn. Every ad has its own 24-hour reward cooldown.</p>
            </div>
            <span className="demo-pill"><CirclePlay size={13} /> {tasks.length} Ads</span>
          </header>
          <div className="ad-summary-strip">
            <div><strong>{tasks.filter((task) => task.status === 'Cooldown').length} / 10</strong><span>ads on cooldown</span></div>
            <p>Rewards are verified by WatchEarn. No external sites or tabs are opened.</p>
          </div>
          <p className="screen-hint">
            Start any available ad to begin its 10-second timer. Claim it when the timer finishes; that ad then becomes available again exactly 24 hours after the claim.
          </p>

          <div className="task-list">
            {taskLoading ? (
              <div className="panel-card task-loading" role="status"><span className="loading-spinner" /> Loading ads…</div>
            ) : taskError ? (
              <div className="panel-card task-error" role="alert">
                <strong>Ads could not be loaded</strong>
                <p>{taskError}</p>
                <button className="secondary-btn small" onClick={() => user && void refreshDashboard(user)}>Try again</button>
              </div>
            ) : tasks.length ? tasks.map((task) => {
              const progress = Math.min(100, Math.max(0, ((10 - task.remaining_seconds) / 10) * 100));
              const statusText = task.status === 'Cooldown'
                ? `Available again in ${formatClockCountdown(task.remaining_seconds)}`
                : task.status === 'Watching'
                  ? `Watching · ${formatClockCountdown(task.remaining_seconds)}`
                  : task.status;
              const statusClass = task.status === 'Available'
                ? 'available'
                : task.status === 'Watching'
                  ? 'progress'
                  : task.status === 'Claim Reward'
                    ? 'ready'
                    : task.status === 'Disabled'
                      ? 'disabled'
                      : 'limit';
              return (
                <article className="task-card ad-task-card" key={task.id}>
                  <div className="task-content">
                    <p className="task-title"><CirclePlay size={16} aria-hidden="true" /> {task.title}</p>
                    <small>{task.description}</small>
                    <div className="task-badges">
                      <span className="task-detail"><Clock3 size={12} /> 10-second watch</span>
                      <span className="task-detail demo-reward">Reward {formatMoney(task.reward_cents)}</span>
                    </div>
                    {task.status === 'Watching' || task.status === 'Claim Reward' ? (
                      <div className="ad-card-timer">
                        <span>{task.status === 'Watching' ? 'Please wait while your ad finishes.' : 'Your ad is ready to claim.'}</span>
                        <div className="progress-track" role="progressbar" aria-label={`${task.title} watch progress`} aria-valuemin={0} aria-valuemax={10} aria-valuenow={10 - task.remaining_seconds}>
                          <div className="progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="task-meta">
                    <span className={`status ${statusClass}`}>{statusText}</span>
                    {task.status === 'Available' ? (
                      <button className="primary-btn small" disabled={adStartingId !== null} onClick={() => void startAd(task)}>
                        {adStartingId === task.id ? <><span className="loading-spinner small-spinner" /> Starting…</> : <><CirclePlay size={14} /> Watch Ad</>}
                      </button>
                    ) : task.status === 'Watching' || task.status === 'Claim Reward' ? (
                      <button className={task.status === 'Claim Reward' ? 'primary-btn small' : 'secondary-btn small'} onClick={() => setActiveAdId(task.id)}>
                        {task.status === 'Claim Reward' ? 'Claim Reward' : 'Continue Watching'}
                      </button>
                    ) : (
                      <button className="secondary-btn small" disabled>
                        {task.status === 'Cooldown' ? statusText : 'Ad disabled'}
                      </button>
                    )}
                  </div>
                </article>
              );
            }) : <div className="panel-card empty-state">No ads are configured. Please contact WatchEarn support.</div>}
          </div>
          </> : <>
            <header className="ads-header math-header">
              <div>
                <p className="eyebrow">Daily math rewards</p>
                <h1>Math Challenge</h1>
                <p>Earn $0.10 immediately for each correct answer. Submit each question individually.</p>
              </div>
              <span className="demo-pill"><Brain size={13} /> 10 Questions · $0.10 each</span>
            </header>

            <div className="math-stats-card">
              <div className="math-stats-item">
                <span>Account balance</span>
                <strong>{formatMoney(user?.balance_cents || 0)}</strong>
              </div>
              <div className="math-stats-item">
                <span>Total rewards earned in challenge</span>
                <strong>{formatMoney((mathCycle?.correctCount || 0) * 10)}</strong>
              </div>
              <div className="math-stats-item">
                <span>Questions completed</span>
                <strong>{mathCycle?.correctCount || 0} / 10</strong>
              </div>
            </div>

            <section className="math-cycle-banner" aria-live="polite">
              <span className="math-cycle-icon"><Clock3 size={17} /></span>
              <div>
                <strong>
                  {mathCycle?.status === 'reward_claimed'
                    ? `New challenge available in ${formatCountdown(mathCycle?.remainingSeconds || 0)}`
                    : `Challenge status: ${mathCycle?.correctCount === 10 ? 'Completed' : (mathCycle?.correctCount || 0) > 0 ? 'In Progress' : 'Available'}`}
                </strong>
                <small>{mathCycle ? `Challenge #${mathCycle.cycleNumber} · 10 questions · $0.10 per correct answer` : 'The challenge is verified securely by WatchEarn.'}</small>
              </div>
              <button className="text-button" onClick={() => void refreshMathQuestions()} disabled={mathLoading || submittingQuestionId !== null}>
                <RefreshCw size={14} /> Refresh
              </button>
            </section>

            {mathCycle?.correctCount === 10 ? (
              <p className="math-reward-claimed" role="status">
                Challenge completed! All 10 questions answered correctly. You earned $1.00. Challenge is locked until the 24-hour cooldown expires.
              </p>
            ) : null}

            {mathLoading ? (
              <div className="panel-card task-loading" role="status"><span className="loading-spinner" /> Loading your question set…</div>
            ) : mathError ? (
              <div className="panel-card task-error" role="alert">
                <strong>Math questions could not be loaded</strong><p>{mathError}</p>
                <button className="secondary-btn small" onClick={() => void refreshMathQuestions()}>Try again</button>
              </div>
            ) : (
              <div className="math-challenge-form">
                <div className="math-question-list">
                  {mathCycle?.questions.map((question, index) => {
                    const isChecking = submittingQuestionId === question.id;
                    const isCompleted = question.correct;
                    const isIncorrect = !isCompleted && question.incorrect;
                    const statusText = isChecking
                      ? 'Checking Answer'
                      : isCompleted
                        ? 'Completed — Reward Paid'
                        : isIncorrect
                          ? 'Incorrect'
                          : 'Available';
                    const statusClass = isChecking
                      ? 'checking'
                      : isCompleted
                        ? 'completed'
                        : isIncorrect
                          ? 'incorrect'
                          : 'available';

                    return (
                      <article className={`math-question-card${isIncorrect ? ' incorrect' : ''}${isCompleted ? ' answered' : ''}`} key={`${mathCycle.cycleId}-${question.id}`}>
                        <span className="math-question-number">{index + 1}</span>
                        <div className="math-question-content">
                          <div className="math-question-header">
                            <strong>Question {index + 1}: {question.prompt} = ?</strong>
                            <span className={`math-question-status-badge ${statusClass}`}>
                              {isChecking ? <span className="loading-spinner small-spinner" /> : null}
                              {statusText}
                            </span>
                          </div>
                          {isCompleted ? <p className="math-answer-result correct">Correct! You earned $0.10.</p> : null}
                          {isIncorrect ? <p className="math-answer-result incorrect">Incorrect answer. Please try again.</p> : null}
                          <div className="math-answer-form">
                            <input
                              type="number"
                              step="1"
                              inputMode="numeric"
                              aria-label={`Answer to question ${index + 1}`}
                              placeholder="Your answer"
                              value={mathAnswers[question.id] ?? ''}
                              disabled={isCompleted || isChecking || mathCycle.status === 'reward_claimed' || submittingQuestionId !== null}
                              onChange={(event) => setMathAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  void submitSingleMathQuestion(question.id);
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="primary-btn small math-question-submit"
                              disabled={isCompleted || isChecking || mathCycle.status === 'reward_claimed' || submittingQuestionId !== null || !(mathAnswers[question.id] ?? '').trim()}
                              onClick={() => void submitSingleMathQuestion(question.id)}
                            >
                              {isChecking ? (
                                <><span className="loading-spinner small-spinner" /> Checking</>
                              ) : isCompleted ? (
                                'Completed'
                              ) : (
                                'Submit'
                              )}
                            </button>
                          </div>
                        </div>
                        {isCompleted ? (
                          <CheckCircle2 className="math-question-check correct" size={19} aria-label={`Question ${index + 1} completed`} />
                        ) : isIncorrect ? (
                          <XCircle className="math-question-check" size={19} aria-label={`Question ${index + 1} incorrect`} />
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </>}
        </div>
      )}

      {tab === 'withdraw' && (
        <div className="content-stack">
          <div className="panel-card">
            <h3>Withdraw funds</h3>
            <AvailableBalanceCard balanceCents={user?.balance_cents || 0} />
            <p className="withdraw-minimum-note">Minimum withdrawal is {formatMoney(withdrawalConfig.minimumCents)}.</p>
            <form onSubmit={handleWithdrawal} className="withdraw-form" noValidate>
              <div className="withdraw-field">
                <label htmlFor="withdrawal-amount">Withdrawal amount (USD)</label>
                <input id="withdrawal-amount" type="number" name="amount" placeholder="Amount in USD" min={(withdrawalConfig.minimumCents / 100).toFixed(2)} max={((user?.balance_cents || 0) / 100).toFixed(2)} step="0.01" inputMode="decimal" onChange={() => setWithdrawalFeedback(null)} />
              </div>
              <div className="payment-methods" role="group" aria-label="Payment method">
                <label className="payment-option">
                  <input type="radio" name="paymentMethod" value="EasyPaisa" defaultChecked={withdrawalConfig.paymentMethods.EasyPaisa} disabled={!withdrawalConfig.paymentMethods.EasyPaisa} onChange={() => setWithdrawalFeedback(null)} />
                  <span><strong>EasyPaisa</strong><small>{withdrawalConfig.paymentMethods.EasyPaisa ? 'Mobile wallet' : 'Currently unavailable'}</small></span>
                </label>
                <label className="payment-option">
                  <input type="radio" name="paymentMethod" value="JazzCash" defaultChecked={!withdrawalConfig.paymentMethods.EasyPaisa && withdrawalConfig.paymentMethods.JazzCash} disabled={!withdrawalConfig.paymentMethods.JazzCash} onChange={() => setWithdrawalFeedback(null)} />
                  <span><strong>JazzCash</strong><small>{withdrawalConfig.paymentMethods.JazzCash ? 'Mobile wallet' : 'Currently unavailable'}</small></span>
                </label>
              </div>
              <div className="withdraw-field">
                <label htmlFor="withdrawal-account-name">Account holder name</label>
                <input id="withdrawal-account-name" name="accountHolderName" placeholder="Account holder name" autoComplete="name" onChange={() => setWithdrawalFeedback(null)} />
              </div>
              <div className="withdraw-field">
                <label htmlFor="withdrawal-account-number">Mobile wallet/account number</label>
                <input id="withdrawal-account-number" name="accountNumber" placeholder="Mobile wallet/account number" autoComplete="tel" inputMode="tel" onChange={() => setWithdrawalFeedback(null)} />
              </div>
              {withdrawalFeedback && (
                <div className={`withdrawal-feedback ${withdrawalFeedback.type}`} role={withdrawalFeedback.type === 'error' ? 'alert' : 'status'} aria-live={withdrawalFeedback.type === 'error' ? 'assertive' : 'polite'}>
                  <strong>{withdrawalFeedback.title}</strong>
                  <p>{withdrawalFeedback.text}</p>
                </div>
              )}
              <button className="primary-btn" type="submit" disabled={loading}>{loading ? 'Submitting…' : 'Withdraw'}</button>
            </form>
          </div>

          <div className="panel-card">
            <h3>Withdrawals</h3>
            <ul className="activity-list">
              {(withdrawals || []).length ? withdrawals.slice(0, 6).map((item) => (
                <li key={item.id}><strong>{item.payment_method} · {formatDate(item.created_at)}</strong><span>{item.status} · {formatMoney(Number(item.amount_cents))}</span></li>
              )) : <li className="empty-state">No withdrawal requests yet.</li>}
            </ul>
          </div>
        </div>
      )}

      {tab === 'profile' && (
        <div className="content-stack">
          <div className="panel-card profile-card">
            <div className="profile-header">
              <div className="avatar">{user?.full_name?.slice(0, 1) || 'W'}</div>
              <div>
                <h3>{user?.full_name}</h3>
                <p>{user?.email}</p>
                <span className={`account-state ${user?.status === 'active' ? 'state-active' : ''}`}>{user?.status}</span>
              </div>
            </div>

            <div className="profile-grid">
              <div><span>Referral code</span><strong>{user?.referral_code}</strong></div>
              <div><span>Member since</span><strong>{formatDate(user?.created_at)}</strong></div>
              <div><span>Total referred members</span><strong>{referralSummary?.total_referred_members ?? 0}</strong></div>
              <div><span>Active referrals</span><strong>{referralSummary?.active_referrals ?? 0}</strong></div>
              <div><span>Inactive referrals</span><strong>{referralSummary?.inactive_referrals ?? 0}</strong></div>
              <div><span>Pending referral rewards</span><strong>{formatMoney(referralSummary?.pending_referral_rewards_cents ?? 0)}</strong></div>
              <div><span>Total referral rewards earned</span><strong>{formatMoney(referralSummary?.total_referral_rewards_earned_cents ?? 0)}</strong></div>
              <div><span>Ads on cooldown</span><strong>{tasks.filter((task) => task.status === 'Cooldown').length}</strong></div>
              <div><span>Available balance</span><strong>{formatMoney(user?.balance_cents || 0)}</strong></div>
              <div><span>Total earnings</span><strong>{formatMoney(user?.total_earnings_cents || 0)}</strong></div>
            </div>
            <div className="referral-link-card">
              <span>Your personal referral link</span>
              <strong>{referralSummary?.referral_link || user?.referral_link}</strong>
            </div>
            <div className="referral-actions">
              <button className="secondary-btn" onClick={handleCopyLink}><Gift size={15} /> Copy Referral Link</button>
              <button className="secondary-btn" onClick={async () => {
                if (!user?.referral_link) return;
                if (navigator.share) {
                  await navigator.share({ title: 'Join WatchEarn', url: user.referral_link });
                } else {
                  await handleCopyLink();
                }
              }}><ArrowUpRight size={15} /> Share invite</button>
            </div>
          </div>

          <div className="panel-card">
            <h3>Security</h3>
            <form className="promo-form" onSubmit={handleChangePassword}>
              <input type="password" name="currentPassword" placeholder="Current password" value={changePasswordForm.currentPassword} onChange={(e) => setChangePasswordForm((current) => ({ ...current, currentPassword: e.target.value }))} />
              <input type="password" name="newPassword" placeholder="New password" value={changePasswordForm.newPassword} onChange={(e) => setChangePasswordForm((current) => ({ ...current, newPassword: e.target.value }))} />
              <button type="submit" className="secondary-btn">Change password</button>
            </form>
          </div>

          <button type="button" className="ghost-btn profile-logout" onClick={logout}><LogOut size={16} /> Log out</button>
        </div>
      )}

      {videoModalOpen && (
        <div className="video-modal-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !videoSubmitting) setVideoModalOpen(false);
        }}>
          <section className="video-modal" role="dialog" aria-modal="true" aria-labelledby="video-modal-title">
            <div className="video-modal-heading">
              <div>
                <p className="eyebrow">Creator reward</p>
                <h2 id="video-modal-title">Submit a video for review</h2>
              </div>
              <button className="modal-close" type="button" aria-label="Close video submission" disabled={videoSubmitting} onClick={() => setVideoModalOpen(false)}>×</button>
            </div>
            <p className="video-guidelines">Your video must genuinely promote WatchEarn, comply with the platform’s rules, and remain publicly accessible for review. Never provide account passwords or private credentials. The $5 reward is credited only after admin approval.</p>
            <form className="video-submit-form" onSubmit={handleVideoPromotionSubmit}>
              <label htmlFor="video-platform">Platform</label>
              <select id="video-platform" name="platform" defaultValue="YouTube" required>
                <option>YouTube</option>
                <option>TikTok</option>
                <option>Facebook</option>
                <option>Instagram</option>
                <option>Other</option>
              </select>
              <label htmlFor="video-url">Public video URL</label>
              <input id="video-url" type="url" name="videoUrl" placeholder="https://…" maxLength={2048} required />
              <label htmlFor="video-title">Video title <span>(optional)</span></label>
              <input id="video-title" name="title" placeholder="Add a title" maxLength={160} />
              <label htmlFor="video-description">Short description <span>(optional)</span></label>
              <textarea id="video-description" name="description" placeholder="Tell us briefly about your WatchEarn promotion" maxLength={1000} rows={3} />
              <button className="primary-btn" type="submit" disabled={videoSubmitting}>{videoSubmitting ? 'Submitting…' : 'Submit for Review'}</button>
            </form>
          </section>
        </div>
      )}

      {activeAd ? (
          <div className="ad-watch-overlay" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget && adClaimingId === null) setActiveAdId(null);
          }}>
            <section className="ad-watch-modal" role="dialog" aria-modal="true" aria-labelledby="ad-watch-title">
              <div className="video-modal-heading">
                <div>
                  <p className="eyebrow">WatchEarn · secure ad session</p>
                  <h2 id="ad-watch-title">{activeAd.title}</h2>
                </div>
                <button className="modal-close" type="button" aria-label="Close ad session" disabled={adClaimingId !== null} onClick={() => setActiveAdId(null)}>×</button>
              </div>
              <p className="ad-watch-description">{activeAd.description}</p>
              <p className="ad-watch-instruction" aria-live="polite">
                {activeAd.status === 'Claim Reward' && activeAd.remaining_seconds === 0
                  ? 'Your ad has finished. You can claim your reward.'
                  : 'Please wait while your ad finishes.'}
              </p>
              <div className="ad-countdown" aria-live="polite" aria-atomic="true">
                <strong>{Math.max(0, activeAd.remaining_seconds)}</strong>
                <span>{activeAd.remaining_seconds > 0 ? 'seconds remaining' : 'Ready to claim'}</span>
              </div>
              <div className="ad-watch-progress">
                <div className="progress-track" role="progressbar" aria-label="Ad watch timer" aria-valuemin={0} aria-valuemax={10} aria-valuenow={Math.min(10, Math.max(0, 10 - activeAd.remaining_seconds))}>
                  <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, (10 - activeAd.remaining_seconds) * 10))}%` }} />
                </div>
                <span>{formatMoney(activeAd.reward_cents)} reward</span>
              </div>
              {activeAd.status === 'Disabled' || activeAd.status === 'Cooldown' ? (
                <p className="ad-watch-error">{activeAd.status === 'Disabled' ? 'This ad has been disabled.' : `Available again in ${formatClockCountdown(activeAd.remaining_seconds)}.`}</p>
              ) : null}
              <div className="ad-watch-actions">
                <button className="primary-btn" disabled={activeAd.status !== 'Claim Reward' || activeAd.remaining_seconds > 0 || adClaimingId !== null} onClick={() => void claimAdReward()}>
                  {adClaimingId === activeAd.id ? <><span className="loading-spinner small-spinner" /> Claiming…</> : 'Claim Reward'}
                </button>
                <button className="secondary-btn" disabled={adClaimingId !== null} onClick={() => setActiveAdId(null)}>Close</button>
              </div>
            </section>
          </div>
      ) : null}

      <nav className="bottom-nav">
        {[
          { id: 'home', label: 'Home', icon: Home },
          { id: 'ads', label: 'Ads', icon: Smartphone },
          { id: 'withdraw', label: 'Withdraw', icon: ArrowUpRight },
          { id: 'profile', label: 'Profile', icon: UserCircle2 }
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} className={tab === id ? 'nav-item active' : 'nav-item'} onClick={() => setTab(id as Tab)}>
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
      </section>
    </main>
  );
}

export default App;
