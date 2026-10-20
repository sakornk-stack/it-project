import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateCurriculumRequirementDto } from './create-curriculum-requirement.dto';

// Parent is immutable: ScopeGuard only checks the requirement's current curriculum,
// so accepting a new curriculumId would let a requirement move outside the caller's scope.
// categoryId stays editable — the service checks it belongs to the same curriculum.
export class UpdateCurriculumRequirementDto extends PartialType(
  OmitType(CreateCurriculumRequirementDto, ['curriculumId'] as const),
) {}
