import { DocumentBuilder } from '@nestjs/swagger';

// Shared by main.ts (live /api/docs outside production) and the offline
// openapi:export script, so both describe the API identically.
export function buildOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle('EduAnalyzeAI API')
    .setDescription(
      'Academic progress tracking and learning outcome analytics system',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
}
