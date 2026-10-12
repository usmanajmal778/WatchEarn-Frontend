export type Tab = 'home' | 'ads' | 'withdraw' | 'profile';

export type Role = 'user' | 'admin';

export type UserStatus = 'active' | 'suspended';

export interface User {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  referral_code: string;
  referral_link: string;
  referred_by: number | null;
  status: UserStatus;
  balance_cents: number;
  total_earnings_cents: number;
  total_withdrawn_cents: number;
  created_at: string;
}

export type AdTaskStatus = 'Available' | 'Watching' | 'Claim Reward' | 'Cooldown' | 'Disabled';

export interface AdTask {
  id: number;
  title: string;
  description: string;
  reward_cents: number;
  status: AdTaskStatus;
  is_active: boolean;
  remaining_seconds: number;
  cooldown_ends_at: string | null;
  session_id: string | null;
}

export interface AdWatchSession {
  taskId: number;
  sessionId: string;
  startedAt: string;
  remainingSeconds: number;
  serverNow: string;
}

export interface AdClaimResult {
  message: string;
  rewardCents: number;
  balanceCents: number;
  totalEarningsCents: number;
  claimedAt: string;
}

export interface AdCompletion {
  id: number;
  user_id: number;
  username: string;
  task_id: number;
  task_title: string;
  reward_cents: number;
  completed_at: string;
}

export interface MathQuestion {
  id: number;
  prompt: string;
  incorrect: boolean;
  correct: boolean;
}

export type MathChallengeStatus = 'not_started' | 'in_progress' | 'incorrect' | 'ready_to_claim' | 'reward_claimed';

export interface MathQuestionSubmitResult {
  alreadyCompleted?: boolean;
  isCorrect: boolean;
  credited: boolean;
  message: string;
  rewardCents: number;
  balanceCents: number;
  totalEarningsCents: number;
  correctCount: number;
  cycleStatus: MathChallengeStatus;
  claimedAt?: string | null;
  cooldownEndsAt?: string | null;
  remainingSeconds: number;
  transactionId?: number;
}

export interface MathQuestionCycle {
  cycleId: number;
  cycleNumber: number;
  startedAt: string;
  endsAt: string;
  remainingSeconds: number;
  status: MathChallengeStatus;
  incorrectQuestionIds: number[];
  rewardCents: number;
  correctCount: number;
  questions: MathQuestion[];
  answeredCount: number;
  totalQuestions: number;
}

export interface MathChallengeSubmission {
  cycleId: number;
  status: 'incorrect' | 'ready_to_claim';
  incorrectQuestionIds: number[];
  correctCount: number;
  rewardCents: number;
  message: string;
}

export interface MathChallengeClaim {
  message: string;
  correctCount: number;
  rewardCents: number;
  balanceCents: number;
  totalEarningsCents: number;
  claimedAt: string;
  cooldownEndsAt: string;
  remainingSeconds: number;
  transactionId: number;
}

export interface AdminMathChallenge {
  id: number;
  user_id: number;
  cycle_number: number;
  started_at: string;
  ends_at: string;
  status: MathChallengeStatus;
  correct_count: number;
  reward_cents: number;
  reward_claimed_at: string | null;
  reward_transaction_id: number | null;
  username: string;
  email: string;
  answered_count: number;
}

export interface Transaction {
  id: number;
  user_id: number;
  type: string;
  amount_cents: number;
  description: string;
  status: string;
  created_at: string;
}

export interface Referral {
  id: number;
  full_name: string;
  status: 'active' | 'inactive';
  reward_status: 'pending' | 'paid';
  created_at: string;
}

export interface ReferralSummary {
  referrals: Referral[];
  total_referred_members: number;
  active_referrals: number;
  inactive_referrals: number;
  pending_referral_rewards_cents: number;
  total_referral_rewards_earned_cents: number;
  referral_link: string;
}

export type VideoPromotionStatus = 'pending' | 'approved' | 'rejected';
export type VideoPromotionPlatform = 'YouTube' | 'TikTok' | 'Facebook' | 'Instagram' | 'Other';

export interface VideoPromotionSubmission {
  id: number;
  platform: VideoPromotionPlatform;
  video_url: string;
  title: string | null;
  description: string | null;
  status: VideoPromotionStatus;
  admin_reason: string | null;
  submitted_at: string;
  reward_cents: number;
}

export interface AdminVideoPromotionSubmission extends VideoPromotionSubmission {
  user_id: number;
  username: string;
  suspicious_duplicate: number;
  reviewed_by: number | null;
  reviewed_at: string | null;
  reward_transaction_id: number | null;
}

export interface WithdrawalProof {
  username: string;
  amount_cents: number;
  payment_method: 'EasyPaisa' | 'JazzCash';
  paid_at: string;
  status: 'Paid';
}
