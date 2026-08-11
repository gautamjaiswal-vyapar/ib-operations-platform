import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Status, TargetVersion, Tenurity } from '../../database/schemas/domain.schemas';
export interface CreateTarget { source:string; tenurity:Tenurity; effectiveFrom:string; revenue:number; login:number; demo:number; license:number; proPlatform:number; arpl:number; }
@Injectable()
export class TargetsService {
  constructor(@InjectModel(TargetVersion.name) private readonly model: Model<TargetVersion>) {}
  list(includeArchived = false) { return this.model.find(includeArchived ? {} : { status: Status.ACTIVE }).sort({ source: 1, tenurity: 1, version: -1 }).lean(); }
  async createVersion(input: CreateTarget, userId: string) {
    const effectiveFrom = new Date(input.effectiveFrom); if (Number.isNaN(effectiveFrom.valueOf())) throw new ConflictException('Invalid effective date');
    const previous = await this.model.findOne({ source: input.source, tenurity: input.tenurity, status: Status.ACTIVE }).sort({ version: -1 });
    const version = (previous?.version ?? 0) + 1;
    if (previous) { const effectiveTo = new Date(effectiveFrom); effectiveTo.setUTCDate(effectiveTo.getUTCDate() - 1); previous.status = Status.ARCHIVED; previous.effectiveTo = effectiveTo; await previous.save(); }
    try { return await this.model.create({ ...input, effectiveFrom, version, status: Status.ACTIVE, createdBy: userId }); }
    catch (error) { if (previous) { previous.status = Status.ACTIVE; previous.effectiveTo = undefined; await previous.save(); } throw error; }
  }
  async resolve(source: string, tenurity: Tenurity, asOf: Date) { const target = await this.model.findOne({ source, tenurity, effectiveFrom: { $lte: asOf }, $or: [{ effectiveTo: null }, { effectiveTo: { $gte: asOf } }] }).sort({ version: -1 }).lean(); if (!target) throw new NotFoundException(`No target for ${source}/${tenurity}`); return target; }
}
