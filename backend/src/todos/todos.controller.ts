import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  CurrentMembership,
  CurrentUser,
  WorkspaceScoped,
} from '../common/decorators/workspace.decorators';
import type {
  AuthUser,
  WorkspaceMembershipContext,
} from '../common/types/request-context';
import {
  CreateTodoDto,
  ListTodosQueryDto,
  UpdateTodoDto,
} from './dto/todo.dto';
import { TodosService } from './todos.service';

@Controller('todos')
@WorkspaceScoped()
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get()
  list(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Query() query: ListTodosQueryDto,
  ) {
    return this.todosService.list(membership, user.id, query);
  }

  @Post()
  create(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTodoDto,
  ) {
    return this.todosService.create(membership, user.id, dto);
  }

  @Get(':todoId')
  getOne(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('todoId') todoId: string,
  ) {
    return this.todosService.findById(membership, user.id, todoId);
  }

  @Patch(':todoId')
  update(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('todoId') todoId: string,
    @Body() dto: UpdateTodoDto,
  ) {
    return this.todosService.update(membership, user.id, todoId, dto);
  }

  @Post(':todoId/complete')
  complete(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('todoId') todoId: string,
  ) {
    return this.todosService.complete(membership, user.id, todoId);
  }

  @Post(':todoId/archive')
  archive(
    @CurrentMembership() membership: WorkspaceMembershipContext,
    @CurrentUser() user: AuthUser,
    @Param('todoId') todoId: string,
  ) {
    return this.todosService.archive(membership, user.id, todoId);
  }
}
