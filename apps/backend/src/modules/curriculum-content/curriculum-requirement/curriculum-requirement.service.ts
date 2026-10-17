import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CurriculumService } from '../../organization/curriculum/curriculum.service';
import { CourseCategoryService } from '../course-category/course-category.service';
import { CreateCurriculumRequirementDto } from './dto/create-curriculum-requirement.dto';
import { UpdateCurriculumRequirementDto } from './dto/update-curriculum-requirement.dto';

@Injectable()
export class CurriculumRequirementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculumService: CurriculumService,
    private readonly courseCategoryService: CourseCategoryService,
  ) {}

  async create(dto: CreateCurriculumRequirementDto) {
    await this.curriculumService.findActiveByIdOrThrow(dto.curriculumId);
    const category = await this.courseCategoryService.findActiveByIdOrThrow(
      dto.categoryId,
    );

    if (category.curriculumId !== dto.curriculumId) {
      throw new BadRequestException(
        `Course category ${dto.categoryId} does not belong to curriculum ${dto.curriculumId}`,
      );
    }

    try {
      return await this.prisma.curriculumRequirement.create({ data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Course category ${dto.categoryId} already has a curriculum requirement`,
        );
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.curriculumRequirement.findMany();
  }

  // Controller-facing read, limited to the caller's curricula — see
  // CourseService.findAllInCurricula.
  findAllInCurricula(curriculum: Prisma.CurriculumWhereInput) {
    return this.prisma.curriculumRequirement.findMany({ where: { curriculum } });
  }

  async findOneInCurricula(id: string, curriculum: Prisma.CurriculumWhereInput) {
    const requirement = await this.prisma.curriculumRequirement.findFirst({
      where: { id, curriculum },
    });
    if (!requirement) {
      throw new NotFoundException(`Curriculum requirement ${id} not found`);
    }
    return requirement;
  }

  async findOne(id: string) {
    const requirement = await this.prisma.curriculumRequirement.findUnique({
      where: { id },
    });
    if (!requirement) {
      throw new NotFoundException(`Curriculum requirement ${id} not found`);
    }
    return requirement;
  }

  async update(id: string, dto: UpdateCurriculumRequirementDto) {
    const requirement = await this.findOne(id);

    if (dto.curriculumId) {
      await this.curriculumService.findActiveByIdOrThrow(dto.curriculumId);
    }
    const curriculumId = dto.curriculumId ?? requirement.curriculumId;

    if (dto.categoryId) {
      const category = await this.courseCategoryService.findActiveByIdOrThrow(
        dto.categoryId,
      );
      if (category.curriculumId !== curriculumId) {
        throw new BadRequestException(
          `Course category ${dto.categoryId} does not belong to curriculum ${curriculumId}`,
        );
      }
    }

    try {
      return await this.prisma.curriculumRequirement.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Course category ${dto.categoryId} already has a curriculum requirement`,
        );
      }
      throw error;
    }
  }

  // No soft-delete: CurriculumRequirement is a mapping-style entity (like
  // UserRole/UserAuthMethod), not a hierarchy entity — CRUD directly.
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.curriculumRequirement.delete({ where: { id } });
  }
}
