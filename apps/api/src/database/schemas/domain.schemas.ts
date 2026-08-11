import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export enum Tenurity { M0 = 'M0', M1 = 'M1', M1_PLUS = 'M1+' }
export enum Status { ACTIVE = 'ACTIVE', INACTIVE = 'INACTIVE', ARCHIVED = 'ARCHIVED' }

@Schema({ timestamps: true, collection: 'executives', optimisticConcurrency: true })
export class Executive {
  @Prop({ required: true, unique: true, trim: true }) employeeId: string;
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ required: true, lowercase: true, trim: true }) email: string;
  @Prop({ required: true }) doj: Date;
  @Prop({ required: true, enum: Status, default: Status.ACTIVE }) status: Status;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', index: true }) managerId?: string;
  @Prop({ required: true, index: true }) source: string;
  @Prop({ required: true, enum: Tenurity, index: true }) tenurity: Tenurity;
  @Prop({ default: true, index: true }) active: boolean;
}
export type ExecutiveDocument = HydratedDocument<Executive>;
export const ExecutiveSchema = SchemaFactory.createForClass(Executive);
ExecutiveSchema.index({ source: 1, tenurity: 1, active: 1 });

@Schema({ timestamps: true, collection: 'managerMappings' })
export class ManagerMapping {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Executive', required: true, index: true }) executiveId: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true }) managerId: string;
  @Prop({ required: true }) effectiveFrom: Date;
  @Prop() effectiveTo?: Date;
  @Prop({ required: true, min: 1 }) version: number;
  @Prop({ default: true }) active: boolean;
}
export const ManagerMappingSchema = SchemaFactory.createForClass(ManagerMapping);
ManagerMappingSchema.index({ executiveId: 1, version: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'monthlyMappings' })
export class MonthlyMapping {
  @Prop({ required: true, match: /^\d{4}-\d{2}$/, index: true }) month: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Executive', required: true }) executiveId: string;
  @Prop({ required: true }) source: string;
  @Prop({ required: true, enum: Tenurity }) tenurity: Tenurity;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) managerId?: string;
  @Prop({ required: true, min: 1 }) version: number;
  @Prop({ default: true }) immutable: boolean;
}
export const MonthlyMappingSchema = SchemaFactory.createForClass(MonthlyMapping);
MonthlyMappingSchema.index({ month: 1, executiveId: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'weeklyMappings' })
export class WeeklyMapping {
  @Prop({ required: true, index: true }) weekStart: Date;
  @Prop({ required: true, match: /^\d{4}-\d{2}$/ }) month: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Executive', required: true }) executiveId: string;
  @Prop({ required: true }) source: string;
  @Prop({ required: true, enum: Tenurity }) tenurity: Tenurity;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) managerId?: string;
  @Prop({ required: true, min: 1 }) version: number;
  @Prop({ default: true }) immutable: boolean;
}
export const WeeklyMappingSchema = SchemaFactory.createForClass(WeeklyMapping);
WeeklyMappingSchema.index({ weekStart: 1, executiveId: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'targetVersions' })
export class TargetVersion {
  @Prop({ required: true, index: true }) source: string;
  @Prop({ required: true, enum: Tenurity, index: true }) tenurity: Tenurity;
  @Prop({ required: true }) effectiveFrom: Date;
  @Prop() effectiveTo?: Date;
  @Prop({ required: true, min: 1 }) version: number;
  @Prop({ required: true, enum: Status, default: Status.ACTIVE }) status: Status;
  @Prop({ required: true, min: 0 }) revenue: number;
  @Prop({ required: true, min: 0 }) login: number;
  @Prop({ required: true, min: 0 }) demo: number;
  @Prop({ required: true, min: 0 }) license: number;
  @Prop({ required: true, min: 0 }) proPlatform: number;
  @Prop({ required: true, min: 0 }) arpl: number;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true }) createdBy: string;
}
export const TargetVersionSchema = SchemaFactory.createForClass(TargetVersion);
TargetVersionSchema.index({ source: 1, tenurity: 1, version: 1 }, { unique: true });
TargetVersionSchema.index({ source: 1, tenurity: 1, effectiveFrom: 1, effectiveTo: 1 });

@Schema({ timestamps: true, collection: 'targetMappings' })
export class TargetMapping {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'TargetVersion', required: true }) targetVersionId: string;
  @Prop({ required: true }) source: string;
  @Prop({ required: true, enum: Tenurity }) tenurity: Tenurity;
  @Prop({ default: true }) active: boolean;
}
export const TargetMappingSchema = SchemaFactory.createForClass(TargetMapping);

@Schema({ timestamps: true, collection: 'weeklyTargets' })
export class WeeklyTarget {
  @Prop({ required: true, index: true }) weekStart: Date;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Executive', required: true }) executiveId: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'TargetVersion', required: true }) targetVersionId: string;
  @Prop({ required: true, min: 0 }) revenue: number;
  @Prop({ required: true, type: Object }) metrics: Record<string, number>;
  @Prop({ default: true }) immutable: boolean;
}
export const WeeklyTargetSchema = SchemaFactory.createForClass(WeeklyTarget);
WeeklyTargetSchema.index({ weekStart: 1, executiveId: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'monthlyTargets' })
export class MonthlyTarget {
  @Prop({ required: true, index: true }) month: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Executive', required: true }) executiveId: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) managerId?: string;
  @Prop({ required: true, min: 0 }) revenue: number;
  @Prop({ required: true, type: Object }) metrics: Record<string, number>;
  @Prop({ default: true }) immutable: boolean;
}
export const MonthlyTargetSchema = SchemaFactory.createForClass(MonthlyTarget);
MonthlyTargetSchema.index({ month: 1, executiveId: 1 }, { unique: true });

function snapshotSchema(collection: string) {
  return new MongooseSchema({ period: { type: String, required: true, unique: true, index: true },
    version: { type: Number, required: true }, checksum: { type: String, required: true }, payload: { type: MongooseSchema.Types.Mixed, required: true },
    createdBy: { type: MongooseSchema.Types.ObjectId, ref: 'User' } }, { timestamps: true, collection, strict: true });
}
export const WeeklySnapshotSchema = snapshotSchema('weeklySnapshots');
export const MonthlySnapshotSchema = snapshotSchema('monthlySnapshots');

@Schema({ timestamps: true, collection: 'performance' })
export class Performance {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Executive', required: true, index: true }) executiveId: string;
  @Prop({ required: true, index: true }) weekStart: Date;
  @Prop({ default: 0, min: 0 }) actualRevenue: number;
  @Prop({ default: 0, min: 0 }) manualRevenue: number;
  @Prop({ required: true, type: Object, default: {} }) metrics: Record<string, number>;
}
export const PerformanceSchema = SchemaFactory.createForClass(Performance);
PerformanceSchema.index({ weekStart: 1, executiveId: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'bonusRules' })
export class BonusRule {
  @Prop({ required: true }) name: string;
  @Prop({ required: true, min: 1 }) version: number;
  @Prop({ required: true, type: [{ minAchievement: Number, maxAchievement: Number, rate: Number, multiplier: Number }] }) slabs: Array<{minAchievement:number;maxAchievement:number;rate:number;multiplier:number}>;
  @Prop({ type: Object, default: {} }) managerRules: Record<string, number>;
  @Prop({ required: true }) effectiveFrom: Date;
  @Prop() effectiveTo?: Date;
  @Prop({ default: true }) active: boolean;
}
export const BonusRuleSchema = SchemaFactory.createForClass(BonusRule);
BonusRuleSchema.index({ name: 1, version: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'incentives' })
export class Incentive {
  @Prop({ required: true, index: true }) month: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Executive', required: true }) executiveId: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) managerId?: string;
  @Prop({ required: true }) target: number;
  @Prop({ required: true }) eligibleRevenue: number;
  @Prop({ required: true }) achievement: number;
  @Prop({ required: true }) bonus: number;
  @Prop({ required: true }) incentive: number;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'BonusRule', required: true }) bonusRuleId: string;
  @Prop({ required: true }) calculationVersion: number;
  @Prop({ required: true, type: Object }) breakdown: Record<string, unknown>;
}
export const IncentiveSchema = SchemaFactory.createForClass(Incentive);
IncentiveSchema.index({ month: 1, executiveId: 1, calculationVersion: 1 }, { unique: true });

@Schema({ timestamps: true, collection: 'leaderboards' })
export class Leaderboard { @Prop({ required: true, index: true }) period: string; @Prop({ required: true }) dimension: string; @Prop({ required: true, type: Array }) entries: unknown[]; }
export const LeaderboardSchema = SchemaFactory.createForClass(Leaderboard);

@Schema({ timestamps: true, collection: 'auditLogs' })
export class AuditLog { @Prop({ required: true, index: true }) actorId: string; @Prop({ required: true, index: true }) module: string; @Prop({ required: true }) action: string; @Prop({ required: true }) entityType: string; @Prop({ required: true, index: true }) entityId: string; @Prop({ type: Object }) before?: unknown; @Prop({ type: Object }) after?: unknown; @Prop({ required: true }) reason: string; @Prop() correlationId?: string; @Prop() ip?: string; }
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ createdAt: -1, module: 1 });

@Schema({ timestamps: true, collection: 'users' })
export class User { @Prop({ required: true, unique: true, lowercase: true }) email: string; @Prop({ required: true }) name: string; @Prop({ select: false }) passwordHash?: string; @Prop() googleId?: string; @Prop({ type: [String], default: ['viewer'] }) roles: string[]; @Prop({ default: true }) active: boolean; @Prop({ select: false }) refreshTokenHash?: string; }
export const UserSchema = SchemaFactory.createForClass(User);
@Schema({ timestamps: true, collection: 'roles' })
export class Role { @Prop({ required: true, unique: true }) name: string; @Prop({ type: [String], default: [] }) permissions: string[]; @Prop() description?: string; }
export const RoleSchema = SchemaFactory.createForClass(Role);
@Schema({ timestamps: true, collection: 'permissions' })
export class Permission { @Prop({ required: true, unique: true }) key: string; @Prop({ required: true }) description: string; }
export const PermissionSchema = SchemaFactory.createForClass(Permission);

function integrationSchema(collection: string) { return new MongooseSchema({ mode: { type: String, required: true }, status: { type: String, required: true, index: true }, startedAt: Date, completedAt: Date, rowsProcessed: { type: Number, default: 0 }, watermark: Date, error: String, metadata: MongooseSchema.Types.Mixed }, { timestamps: true, collection }); }
export const SheetImportSchema = integrationSchema('sheetImports');
export const BigQueryJobSchema = integrationSchema('bigQueryJobs');
@Schema({ timestamps: true, collection: 'configuration' })
export class Configuration { @Prop({ required: true, unique: true }) key: string; @Prop({ required: true, type: Object }) value: unknown; @Prop({ required: true }) encrypted: boolean; @Prop({ required: true }) description: string; }
export const ConfigurationSchema = SchemaFactory.createForClass(Configuration);
