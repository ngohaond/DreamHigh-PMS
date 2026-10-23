import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ClassesService, type ClassesAuthUser } from './classes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateClassDto,
  ListClassesQueryDto,
  UpdateClassDto,
} from './dto/create-class.dto';

type RequestWithUser = Request & { user: ClassesAuthUser };

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  /** Danh sách lớp học có lọc + phân trang. */
  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'TEACHER')
  list(@Query() query: ListClassesQueryDto, @Request() req: RequestWithUser) {
    return this.classesService.listClasses(query, req.user);
  }

  /** Tạo lớp học mới. */
  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Body() body: CreateClassDto, @Request() req: RequestWithUser) {
    return this.classesService.createClass(body, req.user);
  }

  /**
   * Chi tiết lớp học theo mã — route cũ, giữ nguyên để không phá FE hiện tại.
   * Không gắn @Roles: quyền xem được kiểm tra theo branch/giáo viên trong service,
   * nên lớp không tồn tại vẫn trả 404 đúng như trước.
   */
  @Get(':code')
  getClassDetails(@Param('code') code: string, @Request() req: RequestWithUser) {
    return this.classesService.getClassDetails(code, req.user);
  }

  /** Cập nhật lớp học. */
  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateClassDto,
    @Request() req: RequestWithUser,
  ) {
    return this.classesService.updateClass(id, body, req.user);
  }
}
