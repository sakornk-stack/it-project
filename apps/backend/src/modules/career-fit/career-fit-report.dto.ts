import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Grade } from '@prisma/client';

export class CareerFitCourseDto {
  @ApiProperty({ description: 'รหัสวิชา' })
  code!: string;

  @ApiProperty({ description: 'ชื่อวิชา' })
  name!: string;
}

export class CareerFitTopCourseDto extends CareerFitCourseDto {
  @ApiProperty({ enum: Grade, description: 'เกรดที่ได้ (ครั้งล่าสุด)' })
  grade!: Grade;
}

export class CareerFitEntryDto {
  @ApiProperty() careerId!: string;

  @ApiProperty({ description: 'ชื่อสายอาชีพ' })
  careerName!: string;

  @ApiProperty({ enum: ['OK', 'INSUFFICIENT_DATA'] })
  status!: 'OK' | 'INSUFFICIENT_DATA';

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'คะแนนความเหมาะสม 0-100 (ว่างเมื่อข้อมูลไม่เพียงพอ)',
  })
  score!: number | null;

  @ApiProperty({ nullable: true, enum: ['HIGH', 'MEDIUM', 'LOW'] })
  level!: 'HIGH' | 'MEDIUM' | 'LOW' | null;

  @ApiProperty({ description: 'สัดส่วนวิชาของสายที่มีเกรด 0-1' })
  coverage!: number;

  @ApiProperty() gradedCourseCount!: number;
  @ApiProperty() totalCourseCount!: number;

  @ApiProperty({ type: [CareerFitTopCourseDto], description: 'วิชาเด่น' })
  topCourses!: CareerFitTopCourseDto[];

  @ApiProperty({ type: [CareerFitCourseDto], description: 'วิชาแนะนำที่ยังไม่ได้เรียน' })
  recommendedCourses!: CareerFitCourseDto[];

  @ApiPropertyOptional({ description: 'ข้อความอธิบายสำหรับผู้ใช้' })
  message?: string;
}

export class CareerFitReportDto {
  @ApiProperty({ enum: ['OK', 'NO_GRADES', 'NO_CAREERS'] })
  status!: 'OK' | 'NO_GRADES' | 'NO_CAREERS';

  @ApiProperty({ description: 'ข้อความอธิบายสถานะ' })
  message!: string;

  @ApiProperty({ type: [CareerFitEntryDto] })
  careers!: CareerFitEntryDto[];
}
