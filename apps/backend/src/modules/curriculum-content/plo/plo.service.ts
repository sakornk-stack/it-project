import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CurriculumService } from '../../organization/curriculum/curriculum.service';
import { CreatePloDto } from './dto/create-plo.dto';
import { UpdatePloDto } from './dto/update-plo.dto';

@Injectable()
export class PloService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculumService: CurriculumService,
  ) {}

  async create(dto: CreatePloDto) {
    await this.curriculumService.findActiveByIdOrThrow(dto.curriculumId);
    await this.assertCodeAvailable(dto.curriculumId, dto.code);
    return this.prisma.plo.create({ data: dto });
  }

  findAll() {
    return this.prisma.plo.findMany({ where: { isActive: true } });
  }

  // Controller-facing reads, limited to the caller's curricula — see
  // CourseService.findAllInCurricula.
  findAllInCurricula(curriculum: Prisma.CurriculumWhereInput) {
    return this.prisma.plo.findMany({ where: { isActive: true, curriculum } });
  }

  async findOneInCurricula(id: string, curriculum: Prisma.CurriculumWhereInput) {
    const plo = await this.prisma.plo.findFirst({
      where: { id, isActive: true, curriculum },
    });
    if (!plo) {
      throw new NotFoundException(`PLO ${id} not found`);
    }
    return plo;
  }

  async findOne(id: string) {
    const plo = await this.prisma.plo.findUnique({ where: { id } });
    if (!plo) {
      throw new NotFoundException(`PLO ${id} not found`);
    }
    return plo;
  }

  // Used by CloPloMappingService to validate a dependent relationship.
  async findActiveByIdOrThrow(id: string) {
    const plo = await this.prisma.plo.findUnique({ where: { id } });
    if (!plo || !plo.isActive) {
      throw new NotFoundException(`Active PLO ${id} not found`);
    }
    return plo;
  }

  async update(id: string, dto: UpdatePloDto) {
    const { curriculumId } = await this.findOne(id);

    if (dto.code) {
      await this.assertCodeAvailable(curriculumId, dto.code, id);
    }

    return this.prisma.plo.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);

    const activeMappingCount = await this.prisma.cloPloMapping.count({
      where: { ploId: id, isActive: true },
    });
    if (activeMappingCount > 0) {
      throw new ConflictException(
        `Cannot deactivate PLO ${id}: ${activeMappingCount} active CLO-PLO mapping(s) still reference it`,
      );
    }

    return this.prisma.plo.update({ where: { id }, data: { isActive: false } });
  }

  private async assertCodeAvailable(
    curriculumId: string,
    code: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.plo.findFirst({
      where: { curriculumId, code, isActive: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `PLO code "${code}" is already in use within this curriculum`,
      );
    }
  }
}
