import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CourseService } from '../course/course.service';
import { CreatePrerequisiteDto } from './dto/create-prerequisite.dto';
import { UpdatePrerequisiteDto } from './dto/update-prerequisite.dto';

@Injectable()
export class PrerequisiteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courseService: CourseService,
  ) {}

  async create(dto: CreatePrerequisiteDto) {
    if (dto.courseId === dto.prerequisiteCourseId) {
      throw new BadRequestException('A course cannot be its own prerequisite');
    }

    const course = await this.courseService.findActiveByIdOrThrow(
      dto.courseId,
    );
    const prerequisiteCourse = await this.courseService.findActiveByIdOrThrow(
      dto.prerequisiteCourseId,
    );

    // Prerequisite relationships are scoped to a single curriculum —
    // checked here at the service layer rather than a DB compound FK.
    if (course.curriculumId !== prerequisiteCourse.curriculumId) {
      throw new BadRequestException(
        `Course ${dto.courseId} and course ${dto.prerequisiteCourseId} do not belong to the same curriculum`,
      );
    }

    try {
      return await this.prisma.prerequisite.create({ data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Course ${dto.prerequisiteCourseId} is already a prerequisite of course ${dto.courseId}`,
        );
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.prerequisite.findMany();
  }

  // Controller-facing read, limited to the caller's curricula — see
  // CourseService.findAllInCurricula.
  findAllInCurricula(curriculum: Prisma.CurriculumWhereInput) {
    return this.prisma.prerequisite.findMany({ where: { course: { curriculum } } });
  }

  async findOneInCurricula(id: string, curriculum: Prisma.CurriculumWhereInput) {
    const prerequisite = await this.prisma.prerequisite.findFirst({
      where: { id, course: { curriculum } },
    });
    if (!prerequisite) {
      throw new NotFoundException(`Prerequisite ${id} not found`);
    }
    return prerequisite;
  }

  async findOne(id: string) {
    const prerequisite = await this.prisma.prerequisite.findUnique({
      where: { id },
    });
    if (!prerequisite) {
      throw new NotFoundException(`Prerequisite ${id} not found`);
    }
    return prerequisite;
  }

  // Only groupId can change — courseId/prerequisiteCourseId identify the
  // row (see UpdatePrerequisiteDto).
  async update(id: string, dto: UpdatePrerequisiteDto) {
    await this.findOne(id);
    return this.prisma.prerequisite.update({ where: { id }, data: dto });
  }

  // No soft-delete: Prerequisite is a mapping-style entity (like
  // UserRole/UserAuthMethod), not a hierarchy entity — CRUD directly.
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.prerequisite.delete({ where: { id } });
  }
}
