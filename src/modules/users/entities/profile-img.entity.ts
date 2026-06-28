import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { CloudinaryFileEntity } from '../../../database/entities/cloudinary-file.entity';
import { User } from './user.entity';

@Entity('profile-images')
export class ProfileImage extends CloudinaryFileEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @OneToOne(() => User, (user) => user.profileImage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
