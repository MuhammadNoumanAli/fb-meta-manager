const ROLE_LABELS: Record<string, string> = {
  platform_admin: 'Platform admin',
  agency_owner: 'Agency owner',
  agency_admin: 'Agency admin',
  agency_staff: 'Agency staff',
  business_owner: 'Business owner',
  business_admin: 'Business admin',
  business_viewer: 'Viewer',
};

export const formatRole = (role: string): string =>
  ROLE_LABELS[role] ?? role.replace(/_/g, ' ');

export const formatAccessType = (accessType: string): string => {
  switch (accessType) {
    case 'platform':
      return 'Platform access';
    case 'agency':
      return 'Managed by agency';
    default:
      return 'Direct member';
  }
};

export const formatStatus = (status: string): string =>
  status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
