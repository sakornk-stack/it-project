import { Module } from '@nestjs/common';
import { ScopeResolverService } from './scope-resolver.service';
import { CatalogScopeService } from './catalog-scope.service';
import { ScopeGuard } from '../guards/scope.guard';
import { InstructorOrScopeGuard } from '../guards/instructor-or-scope.guard';

// Leaf module — no imports. Depends only on PrismaService, which is
// @Global(), so this can be imported into DepartmentModule/ProgramModule
// without creating a cycle back through UserScopeModule (which already
// imports both of those for its own validation needs).
// InstructorOrScopeGuard lives here (not InstructorModule) because it
// needs ScopeResolverService — this module already owns that provider.
@Module({
  providers: [ScopeResolverService, CatalogScopeService, ScopeGuard, InstructorOrScopeGuard],
  exports: [ScopeResolverService, CatalogScopeService, ScopeGuard, InstructorOrScopeGuard],
})
export class ScopeModule {}
