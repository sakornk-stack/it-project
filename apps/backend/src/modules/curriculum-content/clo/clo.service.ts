import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CourseService } from '../course/course.service';
import { CreateCloDto } from './dto/create-clo.dto';
import { UpdateCloDto } from './dto/update-clo.dto';

@Injectable()
export class CloService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courseService: CourseService,
  ) {}

  async create(dto: CreateCloDto) {
    await this.courseService.findActiveByIdOrThrow(dto.courseId);
    await this.assertCodeAvailable(dto.courseId, dto.code);
    return this.prisma.clo.create({ data: dto });
  }

  findAll() {
    return this.prisma.clo.findMany({ where: { isActive: true } });
  }

  // Controller-facing reads, limited to the caller's curricula — see
  // CourseService.findAllInCurricula.
  findAllInCurricula(curriculum: Prisma.CurriculumWhereInput) {
    return this.prisma.clo.findMany({
      where: { isActive: true, course: { curriculum } },
    });
  }

  async findOneInCurricula(id: string, curriculum: Prisma.CurriculumWhereInput) {
    const clo = await this.prisma.clo.findFirst({
      where: { id, isActive: true, course: { curriculum } },
    });
    if (!clo) {
      throw new NotFoundException(`CLO ${id} not found`);
    }
    return clo;
  }

  async findOne(id: string) {
    const clo = await this.prisma.clo.findUnique({ where: { id } });
    if (!clo) {
      throw new NotFoundException(`CLO ${id} not found`);
    }
    return clo;
  }

  // Used by CloPloMappingService to validate a dependent relationship and
  // to resolve the course a CLO belongs to (for the cross-curriculum check).
  async findActiveByIdOrThrow(id: string) {
    const clo = await this.prisma.clo.findUnique({ where: { id } });
    if (!clo || !clo.isActive) {
      throw new NotFoundException(`Active CLO ${id} not found`);
    }
    return clo;
  }

  async update(id: string, dto: UpdateCloDto) {
    const { courseId } = await this.findOne(id);

    if (dto.code) {
      await this.assertCodeAvailable(courseId, dto.code, id);
    }

    return this.prisma.clo.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);

    const activeMappingCount = await this.prisma.cloPloMapping.count({
      where: { cloId: id, isActive: true },
    });
    if (activeMappingCount > 0) {
      throw new ConflictException(
        `Cannot deactivate CLO ${id}: ${activeMappingCount} active CLO-PLO mapping(s) still reference it`,
      );
    }

    return this.prisma.clo.update({ where: { id }, data: { isActive: false } });
  }

  private async assertCodeAvailable(
    courseId: string,
    code: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.clo.findFirst({
      where: { courseId, code, isActive: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `CLO code "${code}" is already in use within this course`,
      );
    }
  }
}
