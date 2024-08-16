import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateUserDto, RegisterUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { IUser } from 'src/auth/users.interface';
import aqp from 'api-query-params';
import { Permission } from 'src/permissions/Schemas/permission.schema';
import { Role, RoleDocument } from 'src/roles/Schemas/role.schema';
import { USER_ROLE } from 'src/databases/sample';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: SoftDeleteModel<UserDocument>,
    @InjectModel(Role.name) private roleModel: SoftDeleteModel<RoleDocument>,
  ) {}

  // hash password
  hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }

  async create(createUserDt: CreateUserDto, iuser: IUser) {
    if (
      await this.userModel.findOne({
        email: createUserDt.email,
      })
    ) {
      throw new BadRequestException(
        `Email ${createUserDt.email} đã tồn tại, vui lòng điền email khác`,
      );
    }
    //call hash password
    createUserDt.password = await this.hashPassword(createUserDt.password);

    //create a new user
    let user = await this.userModel.create({
      ...createUserDt,
      createdBy: { _id: iuser?._id, email: iuser?.email },
    });
    return {
      _id: user?._id,
      createdAt: user?.createdAt,
    };
  }

  async findAll(currentPage: number, limit: number, qs: string) {
    const { filter, sort, population } = aqp(qs);

    delete filter.current;
    delete filter.pageSize;

    let offset = (+currentPage - 1) * +limit;
    let defaultLimit = +limit ? +limit : 10;

    const totalItems = (await this.userModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / defaultLimit);

    const result = await this.userModel
      .find(filter)
      .skip(offset)
      .limit(defaultLimit)
      .sort(sort as any)
      .select('-password')
      .populate(population)
      .exec();

    return {
      meta: {
        current: currentPage, //trang hiện tại
        pageSize: limit, //số lượng bản ghi đã lấy
        pages: totalPages, //tổng số trang với điều kiện query
        total: totalItems, // tổng số phần tử (số bản ghi)
      },
      result,
    };
  }

  findOne(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) return 'Not found';

    return this.userModel
      .findById(id)
      .select('-password')
      .populate({ path: 'role', select: { name: 1, _id: 1 } });
  }

  async update(updateUserDto: UpdateUserDto, iuser: IUser) {
    updateUserDto.password = await this.hashPassword(updateUserDto.password);
    return await this.userModel.updateOne(
      { _id: updateUserDto._id },
      { ...updateUserDto, updatedBy: { _id: iuser._id, email: iuser.email } },
    );
  }

  async remove(id: string, iuser: IUser) {
    if (!mongoose.Types.ObjectId.isValid(id))
      throw new BadRequestException('Không tồn tại ID');

    if ((await this.userModel.findById(id))?.email === 'admin@gmail.com')
      throw new BadRequestException('ADMIN không đọc xóa');

    await this.userModel.updateOne(
      { _id: id },
      { deletedBy: { _id: iuser?._id, email: iuser?.email } },
    );

    return await this.userModel.softDelete({ _id: id });
  }

  async register(registerUserDto: RegisterUserDto) {
    if (
      await this.userModel.findOne({
        email: registerUserDto.email,
      })
    ) {
      throw new BadRequestException(
        `Email ${registerUserDto.email} đã tồn tại, vui lòng điền email khác`,
      );
    }

    const userRole = await this.roleModel.findOne({ name: USER_ROLE });

    registerUserDto.password = await this.hashPassword(
      registerUserDto.password,
    );
    //create a new user
    let user = await this.userModel.create({
      ...registerUserDto,
      role: userRole?._id,
    });

    return {
      _id: user?._id,
      createdAt: user?.createdAt,
    };
  }

  findOneByUsername(username: string) {
    return this.userModel.findOne({ email: username }).populate({
      path: 'role',
      select: { name: 1 },
    });
  }

  isValidPassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }
  updateUserToken = (refreshToken: string, _id: string) => {
    return this.userModel.updateOne({ _id }, { refreshToken });
  };

  findUserByToken = (refreshToken: string) => {
    return this.userModel.findOne({ refreshToken }).populate({
      path: 'role',
      select: { name: 1 },
    });
  };
}
