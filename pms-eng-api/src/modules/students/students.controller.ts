import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ParseIntPipe, Query, Request } from '@nestjs/common';
import { StudentsService, type StudentsAuthUser } from './students.service';
import { UpdateStudentStatusDto } from './dto/update-student-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

type RequestWithUser = Request & { user: StudentsAuthUser };

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  findAll(@Query() query: any, @Request() req: RequestWithUser) {
    return this.studentsService.findAll(query, req.user);
  }

  @Get('parents')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  findAllParents(@Query('search') search: string) {
    return this.studentsService.findAllParents(search);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'TEACHER')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req: RequestWithUser) {
    return this.studentsService.findOne(id, req.user);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  create(@Body() body: any) {
    return this.studentsService.create(body);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateStudentStatusDto,
    @Request() req: RequestWithUser,
  ) {
    return this.studentsService.updateStatus(id, body, req.user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @Request() req: RequestWithUser,
  ) {
    return this.studentsService.update(id, body, req.user);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  delete(@Param('id', ParseIntPipe) id: number, @Request() req: RequestWithUser) {
    return this.studentsService.delete(id, req.user);
  }
}
