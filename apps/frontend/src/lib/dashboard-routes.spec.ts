import { homeRouteForRole, resolveHomeRoute } from './dashboard-routes';

describe('dashboard routes', () => {
  it('sends each admin tier to its own route tree', () => {
    expect(homeRouteForRole('SUPER_ADMIN')).toBe('/superadmin/system-overview');
    expect(homeRouteForRole('ADMIN')).toBe('/admin/overview');
  });

  it('prefers the highest role for an account holding several', () => {
    expect(resolveHomeRoute(['ADMIN', 'SUPER_ADMIN'])).toBe('/superadmin/system-overview');
  });
});
