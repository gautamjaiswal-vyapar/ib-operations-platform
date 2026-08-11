import { AnyBulkWriteOperation, FilterQuery, Model, PipelineStage, UpdateQuery } from 'mongoose';

export abstract class BaseRepository<T> {
  protected constructor(protected readonly model: Model<T>) {}
  find(filter: FilterQuery<T> = {}, limit = 100, skip = 0): Promise<unknown[]> { return this.model.find(filter).limit(Math.min(limit, 500)).skip(skip).lean().exec() as Promise<unknown[]>; }
  findOne(filter: FilterQuery<T>): Promise<unknown | null> { return this.model.findOne(filter).lean().exec() as Promise<unknown | null>; }
  findById(id: string): Promise<unknown | null> { return this.model.findById(id).lean().exec() as Promise<unknown | null>; }
  create(data: Partial<T>): Promise<unknown> { return this.model.create(data) as Promise<unknown>; }
  update(id: string, update: UpdateQuery<T>): Promise<unknown | null> { return this.model.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean().exec() as Promise<unknown | null>; }
  bulkUpsert(items: Array<{ filter: FilterQuery<T>; update: UpdateQuery<T> }>): Promise<unknown> {
    const operations = items.map(({ filter, update }) => ({ updateOne: { filter, update, upsert: true } })) as AnyBulkWriteOperation<any>[];
    return this.model.bulkWrite(operations, { ordered: false }) as Promise<unknown>;
  }
  aggregate<R>(pipeline: PipelineStage[]): Promise<R[]> { return this.model.aggregate<R>(pipeline).exec(); }
}
