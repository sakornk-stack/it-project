import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CloService } from '../clo/clo.service';
import { CourseService } from '../course/course.service';
import { PloService } from '../plo/plo.service';
import { CreateCloPloMappingDto } from './dto/create-clo-plo-mapping.dto';
import { UpdateCloPloMappingDto } from './dto/update-clo-plo-mapping.dto';

@Injectable()
export class CloPloMappingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloService: CloService,
    private readonly ploService: PloService,
    private readonly courseService: CourseService,
  ) {}

  async create(dto: CreateCloPloMappingDto) {
    const clo = await this.cloService.findActiveByIdOrThrow(dto.cloId);
    const plo = await this.ploService.findActiveByIdOrThrow(dto.ploId);

    // Clo is two hops from Curriculum (Clo -> Course -> Curriculum), unlike
    // Course.category which is one hop — so this can't be enforced with a
    // compound FK trick and is checked here instead, same reasoning as
    // PrerequisiteService's cross-curriculum check.
    const course = await this.courseService.findActiveByIdOrThrow(
      clo.courseId,
    );
    if (course.curriculumId !== plo.curriculumId) {
      throw new BadRequestException(
        `CLO ${dto.cloId} (course curriculum ${course.curriculumId}) and PLO ${dto.ploId} (curriculum ${plo.curriculumId}) do not belong to the same curriculum`,
      );
    }

    try {
      return await this.prisma.cloPloMapping.create({ data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `PLO ${dto.ploId} is already mapped to CLO ${dto.cloId}`,
        );
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.cloPloMapping.findMany({ where: { isActive: true } });
  }

  // Controller-facing reads, limited to the caller's curricula (a mapping's CLO
  // and PLO share one curriculum) — see CourseService.findAllInCurricula.
  findAllInCurricula(curriculum: Prisma.CurriculumWhereInput) {
    return this.prisma.cloPloMapping.findMany({
      where: { isActive: true, plo: { curriculum } },
    });
  }

  async findOneInCurricula(id: string, curriculum: Prisma.CurriculumWhereInput) {
    const mapping = await this.prisma.cloPloMapping.findFirst({
      where: { id, isActive: true, plo: { curriculum } },
    });
    if (!mapping) {
      throw new NotFoundException(`CLO-PLO mapping ${id} not found`);
    }
    return mapping;
  }

  async findOne(id: string) {
    const mapping = await this.prisma.cloPloMapping.findUnique({
      where: { id },
    });
    if (!mapping) {
      throw new NotFoundException(`CLO-PLO mapping ${id} not found`);
    }
    return mapping;
  }

  async update(id: string, dto: UpdateCloPloMappingDto) {
    await this.findOne(id);
    return this.prisma.cloPloMapping.update({ where: { id }, data: dto });
  }

  // Soft-delete (unlike Prerequisite) — see CONVENTIONS.md §7 note: this
  // mapping backs Achievement/PLO % calculations, so hard-deleting it would
  // make past dashboard values unreproducible.
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.cloPloMapping.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
