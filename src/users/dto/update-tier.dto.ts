import { IsIn } from 'class-validator';

export class UpdateTierDto {
  @IsIn(['free', 'premium'])
  tier: 'free' | 'premium';
}
