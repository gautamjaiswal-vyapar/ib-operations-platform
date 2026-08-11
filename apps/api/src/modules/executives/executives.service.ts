import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Executive, Status, Tenurity } from '../../database/schemas/domain.schemas';
import { CreateExecutiveDto, UpdateExecutiveDto } from './executives.dto';
@Injectable()
export class ExecutivesService {
  constructor(@InjectModel(Executive.name) private readonly model: Model<Executive>) {}
  list(active?: boolean) { return this.model.find(active === undefined ? {} : { active }).sort({ name: 1 }).lean(); }
  async create(dto: CreateExecutiveDto) { if (await this.model.exists({ employeeId: dto.employeeId })) throw new ConflictException('Employee ID already exists'); return this.model.create({ ...dto, doj: new Date(dto.doj), tenurity: this.tenurity(dto.doj), active: dto.status === Status.ACTIVE }); }
  async update(id: string, dto: UpdateExecutiveDto) { const update: any = { ...dto }; if (dto.doj) { update.doj = new Date(dto.doj); update.tenurity = this.tenurity(dto.doj); } if (dto.status) update.active = dto.status === Status.ACTIVE; const item = await this.model.findByIdAndUpdate(id, update, { new: true, runValidators: true }); if (!item) throw new NotFoundException('Executive not found'); return item; }
  async refreshTenurity(asOf = new Date()) { const rows = await this.model.find({ active: true }, { doj: 1, tenurity: 1 }); const operations = rows.filter((row) => this.tenurity(row.doj, asOf) !== row.tenurity).map((row) => ({ updateOne: { filter: { _id: row._id }, update: { $set: { tenurity: this.tenurity(row.doj, asOf) } } } })); if (operations.length) await this.model.bulkWrite(operations); return { updated: operations.length }; }
  tenurity(doj: Date | string, asOf = new Date()): Tenurity { const start = new Date(doj); const months = (asOf.getUTCFullYear() - start.getUTCFullYear()) * 12 + asOf.getUTCMonth() - start.getUTCMonth(); if (months < 0) throw new ConflictException('DOJ cannot be in the future'); return months === 0 ? Tenurity.M0 : months === 1 ? Tenurity.M1 : Tenurity.M1_PLUS; }
}
