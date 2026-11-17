import type {
  ActiveAdvertisingStatus,
  AdvertisingObjective,
  BillingEvent,
  OptimizationGoal,
} from '@/types/advertising';

export const objectiveOptions: Array<{ title: string; value: AdvertisingObjective }> = [
  { title: 'Awareness', value: 'OUTCOME_AWARENESS' },
  { title: 'Traffic', value: 'OUTCOME_TRAFFIC' },
  { title: 'Engagement', value: 'OUTCOME_ENGAGEMENT' },
  { title: 'Leads', value: 'OUTCOME_LEADS' },
  { title: 'App promotion', value: 'OUTCOME_APP_PROMOTION' },
  { title: 'Sales', value: 'OUTCOME_SALES' },
];

export const campaignStatusOptions = [
  { title: 'Draft', value: 'draft' },
  { title: 'Publishing', value: 'publishing' },
  { title: 'Active', value: 'active' },
  { title: 'Paused', value: 'paused' },
  { title: 'Archived', value: 'archived' },
  { title: 'Error', value: 'error' },
];

export const liveStatusOptions: Array<{ title: string; value: ActiveAdvertisingStatus }> = [
  { title: 'Active', value: 'active' },
  { title: 'Paused', value: 'paused' },
  { title: 'Archived', value: 'archived' },
];

export const optimizationGoalOptions: Array<{ title: string; value: OptimizationGoal }> = [
  { title: 'Reach', value: 'REACH' },
  { title: 'Impressions', value: 'IMPRESSIONS' },
  { title: 'Link clicks', value: 'LINK_CLICKS' },
  { title: 'Landing page views', value: 'LANDING_PAGE_VIEWS' },
  { title: 'Post engagement', value: 'POST_ENGAGEMENT' },
  { title: 'Conversations', value: 'CONVERSATIONS' },
  { title: 'Lead generation', value: 'LEAD_GENERATION' },
  { title: 'Value', value: 'VALUE' },
  { title: 'Offsite conversions', value: 'OFFSITE_CONVERSIONS' },
];

export const billingEventOptions: Array<{ title: string; value: BillingEvent }> = [
  { title: 'Impressions', value: 'IMPRESSIONS' },
  { title: 'Link clicks', value: 'LINK_CLICKS' },
  { title: 'Post engagement', value: 'POST_ENGAGEMENT' },
  { title: 'ThruPlay', value: 'THRUPLAY' },
];

export const callToActionOptions = [
  { title: 'Learn more', value: 'LEARN_MORE' },
  { title: 'Shop now', value: 'SHOP_NOW' },
  { title: 'Sign up', value: 'SIGN_UP' },
  { title: 'Contact us', value: 'CONTACT_US' },
  { title: 'Send message', value: 'MESSAGE_PAGE' },
  { title: 'Book now', value: 'BOOK_NOW' },
  { title: 'Download', value: 'DOWNLOAD' },
  { title: 'Get offer', value: 'GET_OFFER' },
  { title: 'Subscribe', value: 'SUBSCRIBE' },
  { title: 'Apply now', value: 'APPLY_NOW' },
  { title: 'WhatsApp message', value: 'WHATSAPP_MESSAGE' },
];

export const specialCategoryOptions = [
  { title: 'No special category', value: 'NONE' },
  { title: 'Housing', value: 'HOUSING' },
  { title: 'Employment', value: 'EMPLOYMENT' },
  { title: 'Credit', value: 'CREDIT' },
  { title: 'Social issues and politics', value: 'ISSUES_ELECTIONS_POLITICS' },
  { title: 'Online gambling and gaming', value: 'ONLINE_GAMBLING_AND_GAMING' },
];

export const toDateTimeInput = (value: string | null): string => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (part: number): string => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

export const fromDateTimeInput = (value: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};
