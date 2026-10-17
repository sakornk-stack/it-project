import { CurriculumService } from './curriculum.service';

function setup() {
  const findMany = jest.fn().mockResolvedValue([]);
  const service = new CurriculumService({ curriculum: { findMany } } as never, {} as never);
  return { service, findMany };
}

describe('CurriculumService.findInactiveInPrograms', () => {
  it('lists only deactivated curricula of the given programs', async () => {
    const { service, findMany } = setup();
    await service.findInactiveInPrograms(['p1', 'p2']);
    expect(findMany.mock.calls[0][0].where).toEqual({
      isActive: false,
      programId: { in: ['p1', 'p2'] },
    });
  });

  it('matches nothing when the caller scope covers no program', async () => {
    const { service, findMany } = setup();
    await service.findInactiveInPrograms([]);
    expect(findMany.mock.calls[0][0].where.programId).toEqual({ in: [] });
  });
});
